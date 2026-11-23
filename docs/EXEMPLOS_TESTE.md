# Roteiro de testes manual (Postman ou PowerShell)

**Não use usuários reais nem o MongoDB de produção na primeira rodada.** Para repetir o roteiro, serão necessárias três contas de testes: cliente, prestador com profissão Motorista, administrador. Para o administrador, é preciso que `User.role` seja `admin`. O Motorista deve ter `User.acessoExpiraEm` futuro (como os demais prestadores) e pelo menos um `aceitaPix`, `aceitaCartao` ou `aceitaDinheiro` habilitado em seu cadastro.

## Preparação

1. Configure em um backend de **staging**: `MOBILITY_MODULE_ENABLED=true`, `MOBILITY_BETA_USER_IDS=ID_MOTORISTA,ID_CLIENTE`, `MOBILITY_DATA_KEY` com 64 caracteres hex, `MOBILITY_ALLOW_APPROXIMATE_ROUTES=true` e `MOBILITY_MOTO_PASSENGER_ENABLED=false`. Mantenha `NODE_ENV=production` se a infraestrutura for igual à do Render.
2. Garanta que `User` / `Profissional` do motorista existam pelo fluxo atual do Tanamão+, com profissão contendo **Motorista**. Não cadastre como `role=motorista` antigo.
3. Use os tokens JWT fornecidos pelo login atual das três contas.
4. Com `MOBILITY_BETA_USER_IDS` configurado, somente os IDs permitidos (e administradores) podem executar o módulo. Isso evita exposição a outros usuários.
5. O backend cria índices no primeiro uso do Mongoose. Teste primeiro com uma **base MongoDB vazia de staging**.

## Preparar chamadas no PowerShell

```powershell
$base = 'https://SEU-BACKEND-STAGING.onrender.com'
$tokenMotorista = 'JWT_DA_CONTA_MOTORISTA'
$tokenCliente = 'JWT_DA_CONTA_CLIENTE'
$tokenAdmin = 'JWT_DO_ADMIN'
$hMotorista = @{Authorization="Bearer $tokenMotorista"}
$hCliente = @{Authorization="Bearer $tokenCliente"}
$hAdmin = @{Authorization="Bearer $tokenAdmin"}
function PutJson($path,$body,$h) { Invoke-RestMethod -Method Put -Uri "$base$path" -Headers $h -ContentType 'application/json' -Body ($body|ConvertTo-Json -Depth 9) }
function PatchJson($path,$body,$h) { Invoke-RestMethod -Method Patch -Uri "$base$path" -Headers $h -ContentType 'application/json' -Body ($body|ConvertTo-Json -Depth 9) }
function PostJson($path,$body,$h) { Invoke-RestMethod -Method Post -Uri "$base$path" -Headers $h -ContentType 'application/json' -Body ($body|ConvertTo-Json -Depth 9) }
```

## Cadastro e aprovação

```powershell
# 1. Dados de modalidades
PutJson '/api/mobilidade/motorista/perfil' @{ servicosSolicitados=@('corrida_carro','entrega_carro','frete_local');cidadeBase='Ponta Porã';ufBase='MS' } $hMotorista

# 2. CNH fictícia apenas em staging; o painel deve conferir o documento de teste
PutJson '/api/mobilidade/motorista/cnh' @{ numero='12345678901';categoria='B';validade='2028-11-19';ear=$true } $hMotorista

# 3. Veículo de teste; anote veiculo._id
PostJson '/api/mobilidade/motorista/veiculos' @{ tipo='carro';placa='ABC1D23';marca='Exemplo';modelo='Teste';ano=2022;capacidadeKg=200;capacidadeM3=1;lugares=4 } $hMotorista

# 4. Confira IDs no painel/API admin
Invoke-RestMethod -Uri "$base/api/admin/mobilidade/perfis" -Headers $hAdmin
Invoke-RestMethod -Uri "$base/api/mobilidade/motorista/veiculos" -Headers $hMotorista
```

Envie os arquivos JPG/PNG/PDF **somente de teste** usando Postman com `POST /api/mobilidade/motorista/documentos`, `multipart/form-data` com campos `tipo=cnh_frente`, `arquivo=<file>` e outro upload `tipo=crlv`, `veiculoId=<ID_VEICULO>`, `arquivo=<file>`. Não use fotos reais de CNH numa base de testes aberta.

```powershell
# 5. Após os documentos, aprovar CNH e veículo
PatchJson '/api/admin/mobilidade/perfis/ID_PERFIL/cnh' @{decisao='aprovar'} $hAdmin
PatchJson '/api/admin/mobilidade/veiculos/ID_VEICULO/aprovacao' @{decisao='aprovar'} $hAdmin
PatchJson '/api/admin/mobilidade/perfis/ID_PERFIL/aprovacao' @{decisao='aprovar';servicosAprovados=@('corrida_carro','entrega_carro','frete_local')} $hAdmin

# 6. Selecionar veículo, enviar GPS e entrar online
PostJson '/api/mobilidade/motorista/veiculos/ID_VEICULO/selecionar' @{} $hMotorista
PostJson '/api/mobilidade/motorista/localizacao' @{lat=-22.535;lng=-55.726} $hMotorista
PatchJson '/api/mobilidade/motorista/disponibilidade' @{online=$true;servicosAtivos=@('corrida_carro','entrega_carro','frete_local')} $hMotorista
```

## Tarifas, cotação e solicitação

```powershell
# 7. Administrador configura a tabela de tarifa de teste
PutJson '/api/admin/mobilidade/tarifas' @{servico='corrida_carro';uf='MS';cidade='ponta pora';bandeiradaCentavos=500;porKmCentavos=200;porMinutoCentavos=20;minimoCentavos=1200;ativo=$true} $hAdmin

# 8. Cliente pede cotação. Na beta, distância e tempo são aproximações.
$localA = @{endereco='Origem de teste';cidade='Ponta Porã';uf='MS';lat=-22.535;lng=-55.726}
$localB = @{endereco='Destino de teste';cidade='Ponta Porã';uf='MS';lat=-22.525;lng=-55.715}
$cotacao = PostJson '/api/mobilidade/cliente/cotacoes' @{tipo='corrida';veiculo='carro';origem=$localA;destino=$localB;passageiros=1} $hCliente
$cotacao.cotacao

# 9. Cliente escolhe um meio aceito pelo motorista, por exemplo Pix
$pedido = PostJson '/api/mobilidade/cliente/solicitacoes' @{cotacaoId=$cotacao.cotacao.id;metodoPagamento='pix'} $hCliente
$pedido.solicitacao
$pedido.codigos # Exclusivos do cliente! Necessários para início e conclusão.

# 10. Motorista recebe a oferta (também há Socket.IO e Push)
Invoke-RestMethod -Uri "$base/api/mobilidade/motorista/ofertas" -Headers $hMotorista
```

A partir daqui, substitua `ID_VIAGEM` pelo valor de `$pedido.solicitacao.id` e utilize **os códigos retornados ao cliente**, nunca os adivinhe. O fluxo é:

```powershell
PostJson '/api/mobilidade/motorista/ofertas/ID_VIAGEM/aceitar' @{} $hMotorista
PostJson '/api/mobilidade/motorista/viagens/ID_VIAGEM/cheguei' @{} $hMotorista
PostJson '/api/mobilidade/motorista/viagens/ID_VIAGEM/iniciar' @{codigo='CODIGO_INICIO'} $hMotorista
PostJson '/api/mobilidade/motorista/viagens/ID_VIAGEM/finalizar' @{codigo='CODIGO_CONCLUSAO'} $hMotorista
PostJson '/api/mobilidade/motorista/viagens/ID_VIAGEM/pagamento/recebido' @{} $hMotorista
PostJson '/api/mobilidade/cliente/solicitacoes/ID_VIAGEM/pagamento/avaliar' @{decisao='confirmar'} $hCliente
PostJson '/api/mobilidade/cliente/solicitacoes/ID_VIAGEM/avaliacao' @{nota=5;comentario='Atendimento de teste'} $hCliente
Invoke-RestMethod -Uri "$base/api/mobilidade/motorista/resumo?periodo=mes" -Headers $hMotorista
```

Não há débito em cartão, cobrança de Pix ou transação de Mercado Pago nesses endpoints. O registro é **declaração**, adequado ao modelo em que o motorista recebe diretamente.

## Testes de segurança que também precisam passar

- Uma conta fora da lista beta deve receber **403**.
- Um cliente não consegue acessar a viagem de outro cliente.
- Um motorista sem plano válido ou com CNH/veículo pendente recebe **403** ao tentar entrar online.
- Um motorista com `aceitaPix=false` não pode receber/aceitar oferta Pix.
- O cliente que prefere motorista mulher só deve receber ofertas de prestadoras compatíveis, conforme cadastro.
- Moto com passageiro deve ser bloqueada, salvo liberação específica de localidade.
- A mesma viagem não pode ser aceita por dois motoristas.
- O motorista não recebe códigos do cliente na oferta.
- Documentos de CNH só são baixados pela API do administrador autenticado.
- O frontend não pode determinar nem editar `valorCentavos` da viagem.
- Enviar forma de pagamento desconhecida deve retornar **400**.

## Depois

Com todos os testes de API passando, conectar primeiro o cadastro e aprovação no app/painel; depois a Home de Motorista; e por último **ServicosHomeScreen** para o passageiro. A tela `ClienteHomeScreen` não está ativa e não deve ser alterada.
