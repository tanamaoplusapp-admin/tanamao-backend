# Contrato de API — Tanamão+ Mobilidade

Base URL: `https://SEU_BACKEND/api/mobilidade`. Autorização: `Authorization: Bearer TOKEN` em **todas** as rotas. Os usuários são os `User` já existentes; motorista exige profissão **Motorista** no registro `Profissional`. Valores sempre em **centavos inteiros**.

## Motorista

| Método | Rota | Corpo ou uso |
|---|---|---|
| GET | `/catalogo` | Lista modalidades, veículos, recebimento direto |
| GET | `/motorista/perfil` | Lê perfil existente (404 se ainda não criou) |
| PUT | `/motorista/perfil` | `servicosSolicitados` (array), `cidadeBase`, `ufBase` |
| PUT | `/motorista/cnh` | `numero`, `categoria`, `validade`, `ear` |
| GET | `/motorista/documentos` | Metadados dos documentos próprios, sem arquivo |
| POST | `/motorista/documentos` | `multipart/form-data`: `arquivo`, `tipo`; `veiculoId` para CRLV/RNTRC |
| GET | `/motorista/veiculos` | Lista veículos cadastrados |
| POST | `/motorista/veiculos` | `tipo`, `placa`, `marca`, `modelo`, `ano`, `cor`, `capacidadeKg`, `capacidadeM3`, `lugares`, `rntrc` quando exigido |
| PUT | `/motorista/veiculos/:vehicleId` | Alterar veículo; retorna para análise |
| POST | `/motorista/veiculos/:vehicleId/selecionar` | Ativar veículo aprovado |
| POST | `/motorista/veiculos/:vehicleId/manutencoes` | `tipo`, `data`, `valorCentavos`, `quilometragem`, `litros`, `proximaTrocaKm` |
| GET | `/motorista/veiculos/:vehicleId/manutencoes` | Históricos e soma |
| GET | `/motorista/disponibilidade` | Lê online/offline |
| PATCH | `/motorista/disponibilidade` | `online:true`, `servicosAtivos:[...]` ou `online:false` |
| POST | `/motorista/localizacao` | `lat`, `lng` (latitude/longitude) |
| GET | `/motorista/resumo?periodo=hoje` | `hoje`, `semana`, `mes`, `total`: quantidade, quilômetros, valores, manutenção, plano e indicação |
| GET | `/motorista/ofertas` | Solicitações destinadas ao usuário logado |
| POST | `/motorista/ofertas/:jobId/aceitar` | Aceite atômico |
| POST | `/motorista/ofertas/:jobId/recusar` | Oferta é oferecida a outro motorista |
| GET | `/motorista/viagens` | Histórico próprio |
| GET | `/motorista/avaliacoes` | Avaliações de viagens recebidas |
| POST | `/motorista/viagens/:jobId/cheguei` | Passar de `aceita` a `no_local` |
| POST | `/motorista/viagens/:jobId/iniciar` | `{ "codigo": "123456" }` do cliente |
| POST | `/motorista/viagens/:jobId/finalizar` | `{ "codigo": "654321" }` do cliente |
| POST | `/motorista/viagens/:jobId/pagamento/recebido` | Apenas declaração de recebimento, sem banco |

## Cliente (ServicosHomeScreen, não ClienteHomeScreen)

| Método | Rota | Corpo ou uso |
|---|---|---|
| POST | `/cliente/cotacoes` | `{ "tipo":"corrida", "veiculo":"carro", "origem": LOCAL, "destino": LOCAL, "passageiros": 1, "preferenciaMotorista":"somente_mulheres" }` |
| POST | `/cliente/solicitacoes` | `{ "cotacaoId":"...", "metodoPagamento":"pix" }` |
| GET | `/cliente/solicitacoes` | Histórico das solicitações próprias |
| GET | `/solicitacoes/:jobId` | Detalhe, código de início e conclusão **apenas para o cliente** |
| GET | `/cliente/solicitacoes/:jobId/motorista` | Veículo e posição recente do motorista, apenas durante viagem ativa |
| POST | `/cliente/solicitacoes/:jobId/cancelar` | `{ "motivo":"..." }` (até o embarque/coleta) |
| POST | `/cliente/solicitacoes/:jobId/pagamento/avaliar` | `{ "decisao":"confirmar" }` ou `{ "decisao":"contestar", "observacao":"..." }` |
| POST | `/cliente/solicitacoes/:jobId/avaliacao` | `{ "nota":5, "comentario":"..." }` após conclusão |
| GET/POST | `/solicitacoes/:jobId/mensagens` | Chat vinculado à viagem, visível aos participantes |

Formato `LOCAL`:

```json
{"endereco":"Rua Exemplo, 100","cidade":"Ponta Porã","uf":"MS","lat":-22.535,"lng":-55.726}
```

Para entrega use `tipo:"entrega"`, `veiculo:"moto"` ou `"carro"`, `carga:{"descricao":"Envelope","pesoKg":1,"volumeM3":0.01}`. Para frete use `tipo:"frete"`, `veiculo:"van"` ou `"utilitario"`, etc. O backend determina local/intermunicipal/interestadual comparando cidade e UF **após a validação do geocoding no modo comercial**.

Preferência `preferenciaMotorista` opcional; quando omitida usa `User.preferenciaProfissional`, conforme regras do perfil. O gênero para comparação vem do `User` no servidor, não do payload. A preferência de atendimento da motorista também é respeitada.

## Administrador

Base URL: `/api/admin/mobilidade`. Somente `User.role="admin"`.

| Método | Rota | Corpo |
|---|---|---|
| GET | `/perfis?status=em_analise&page=1` | Fila administrativa |
| GET | `/perfis/:profileId` | Detalhe incluindo CNH descriptografada para revisão manual |
| PATCH | `/perfis/:profileId/cnh` | `{ "decisao":"aprovar" }` ou `reprovar`/`solicitar_reenvio` com motivo |
| PATCH | `/veiculos/:vehicleId/aprovacao` | `{ "decisao":"aprovar" }` ou `reprovar`/`suspender` com motivo |
| PATCH | `/perfis/:profileId/aprovacao` | `{ "decisao":"aprovar", "servicosAprovados":["corrida_carro"] }` ou rejeição/suspensão |
| GET | `/documentos/:documentId/download` | Download privado JPG/PNG/PDF |
| GET | `/tarifas` | Lista tarifas configuradas |
| PUT | `/tarifas` | `{ "servico":"corrida_carro", "uf":"MS", "cidade":"ponta pora", "bandeiradaCentavos":500, "porKmCentavos":200, "porMinutoCentavos":20, "porKgCentavos":0, "porM3Centavos":0, "minimoCentavos":1200, "ativo":true }` |
| GET | `/solicitacoes?status=ofertada` | Fila e status |
| POST | `/solicitacoes/:jobId/cancelar` | `{ "motivo":"..." }` |
| POST | `/solicitacoes/:jobId/desbloquear-pin` | Desbloqueio manual após tentativas incorretas |

Modalidades: `corrida_carro`, `corrida_moto`, `entrega_moto`, `entrega_carro`, `frete_local`, `frete_intermunicipal`, `frete_interestadual`.

**Ordem de aprovação:** enviar CNH + foto; cadastrar veículo + CRLV; aprovar CNH; aprovar veículo; aprovar modalidades; selecionar veículo; atualizar GPS; entrar online. A CNH deve ter EAR, quando exigido para a atividade, conforme regra conservadora desta primeira versão. Para frete interestadual exige preenchimento e documento RNTRC, sujeito à conferência aplicável.

## Tempo real

Namespace Socket.IO: `/mobilidade`, com JWT do `AuthContext` existente em `auth.token`. O servidor insere o usuário apenas na sua sala autenticada e emite eventos como `oferta:nova`, `oferta:expirada`, `solicitacao:status`, `viagem:atualizada`, `viagem:localizacao`, `viagem:mensagem`, `viagem:pagamento`, `viagem:avaliacao`, `perfil:aprovacao`.

O cliente **não envia** eventos `join` para salas arbitrárias nesse namespace. O cliente deverá consumir as novas APIs, mas nenhuma alteração ao Socket.IO do chat legado foi feita.

## Cobranças e planos

O motorista seleciona `Pix`, `Cartão` e/ou `Dinheiro` por meio dos campos que já existem em seu perfil profissional. O serviço calcula **preço**, mas não realiza **pagamento**: nenhuma cobrança de corrida é criada no Mercado Pago. `pagamento.status` é declaratório (`pendente`, `informado_recebido`, `confirmado_cliente` ou `contestado`). A **PlanosScreen**, os bônus de indicação e as rotas de cobrança de planos permanecem inalteradas. Para entrar online o acesso (`User.acessoExpiraEm`) deve estar ativo.
