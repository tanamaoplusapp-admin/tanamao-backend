#!/bin/bash
# ============================================================
# 🧪 Testes automatizados de endpoints TáNaMão (usuário PROFISSIONAL)
# ============================================================

# === CONFIGURAÇÕES ===
HOST="http://localhost:5000"       # endereço do backend
TOKEN="SEU_TOKEN_JWT_AQUI"         # cole aqui um token válido de PROFISSIONAL
PROF_ID="SEU_ID_PROFISSIONAL_AQUI" # id do profissional no banco
SOLIC_ID="SEU_ID_SOLICITACAO_AQUI" # opcional, usado nos testes de aceitação

# === NÃO ALTERE ABAIXO ===
OUTFILE="test_results.log"
echo "🧾 Teste iniciado em $(date)" > $OUTFILE

function log_section() {
  echo -e "\n============================================================" | tee -a $OUTFILE
  echo "🔹 $1" | tee -a $OUTFILE
  echo "============================================================" | tee -a $OUTFILE
}

function run_test() {
  local name="$1"
  local cmd="$2"
  echo -e "\n➡️  $name" | tee -a $OUTFILE
  echo "CMD: $cmd" >> $OUTFILE
  echo "----" >> $OUTFILE
  eval $cmd 2>&1 | tee -a $OUTFILE | head -n 10
  echo -e "\n" >> $OUTFILE
}

# ============================================================
# 1. Health
# ============================================================
log_section "1️⃣ Healthcheck"
run_test "GET /health" "curl -s -i $HOST/health"

# ============================================================
# 2. Compat Routes & Notifications
# ============================================================
log_section "2️⃣ Compat & Notifications"
run_test "GET /api/notifications" "curl -s -i -H \"Authorization: Bearer $TOKEN\" \"$HOST/api/notifications\""
run_test "GET /api/professional/me" "curl -s -i -H \"Authorization: Bearer $TOKEN\" \"$HOST/api/professional/me\""
run_test "GET /api/users/me/profile" "curl -s -i -H \"Authorization: Bearer $TOKEN\" \"$HOST/api/users/me/profile\""

# ============================================================
# 3. Perfil Profissional (buscar, atualizar, banco, status)
# ============================================================
log_section "3️⃣ Perfil Profissional"
run_test "GET /api/profissionais/me" "curl -s -i -H \"Authorization: Bearer $TOKEN\" \"$HOST/api/profissionais/me\""
run_test "PUT /api/profissionais/me" "curl -s -i -X PUT -H \"Authorization: Bearer $TOKEN\" -H \"Content-Type: application/json\" -d '{\"name\":\"Teste Script\",\"phone\":\"(11)99999-9999\",\"bio\":\"Bio automatizada\"}' \"$HOST/api/profissionais/me\""
run_test "PUT /api/profissionais/me/banco" "curl -s -i -X PUT -H \"Authorization: Bearer $TOKEN\" -H \"Content-Type: application/json\" -d '{\"banco\":\"Banco Script\",\"agencia\":\"1234\",\"conta\":\"9999-9\",\"tipoConta\":\"corrente\",\"pix\":\"script@pix.com\"}' \"$HOST/api/profissionais/me/banco\""
run_test "PATCH /api/profissionais/me/status" "curl -s -i -X PATCH -H \"Authorization: Bearer $TOKEN\" -H \"Content-Type: application/json\" -d '{\"operationalStatus\":\"disponivel\",\"online\":true}' \"$HOST/api/profissionais/me/status\""

# ============================================================
# 4. Solicitações (polling e ações)
# ============================================================
log_section "4️⃣ Solicitações (polling e ações)"
run_test "GET /api/profissionais/:id/solicitacoes" "curl -s -i -H \"Authorization: Bearer $TOKEN\" \"$HOST/api/profissionais/$PROF_ID/solicitacoes\""
run_test "PATCH aceitar solicitação" "curl -s -i -X PATCH -H \"Authorization: Bearer $TOKEN\" \"$HOST/api/profissionais/$PROF_ID/solicitacoes/$SOLIC_ID/aceitar\""
run_test "PATCH cancelar solicitação" "curl -s -i -X PATCH -H \"Authorization: Bearer $TOKEN\" \"$HOST/api/profissionais/$PROF_ID/solicitacoes/$SOLIC_ID/cancelar\""
run_test "PATCH finalizar solicitação" "curl -s -i -X PATCH -H \"Authorization: Bearer $TOKEN\" \"$HOST/api/profissionais/$PROF_ID/solicitacoes/$SOLIC_ID/finalizar\""

# ============================================================
# 5. Resultado Final
# ============================================================
echo -e "\n✅ Testes concluídos. Verifique '$OUTFILE' para detalhes.\n"
