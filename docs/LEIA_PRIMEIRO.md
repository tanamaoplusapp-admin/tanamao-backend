# Tanamão+ — Backend Mobilidade (versão de integração para testes)

## O que este pacote altera

Base: `backend.zip`, `server.js`, `package(3).json` e `package-lock(1).json` recebidos na conversa.

- Adiciona `GET/PUT/POST/PATCH /api/mobilidade/...` para cliente e motorista.
- Adiciona `/api/admin/mobilidade/...` para aprovação **manual** no painel.
- Reutiliza `User`, `Profissional`, autenticação JWT, acesso por `User.acessoExpiraEm`, código de indicação, Pix/cartão/dinheiro, Firebase Push e Socket.IO.
- Adiciona modelos MongoDB próprios, sem alterar `User.js`, `Profissional.js`, sistemas de planos ou rotas `/api/motorista`, `/api/drivers`, `/api/frete` e `/api/entregas` existentes.
- Em `server.js`, somente registra as duas rotas, namespace Socket.IO autenticado e redespacho de ofertas.
- **Não mexe no frontend nem em bibliotecas Expo; Expo SDK 54 continua.**
- `package.json` e `package-lock.json` do backend permanecem **sem alterações**.

## Fluxo completo exposto pelas APIs

1. Prestador já existente escolhe a profissão **Motorista** no cadastro/perfil tradicional.
2. Cadastra modalidades: corrida de carro/moto (onde permitido), entrega de carro/moto, frete local/intermunicipal/interestadual.
3. Registra CNH, veículos e envia documentos por upload privado (GridFS do MongoDB).
4. Administrador consulta a documentação e aprova **separadamente** CNH, veículo e modalidades.
5. Motorista com plano válido, forma de recebimento configurada e veículo aprovado envia GPS e fica online.
6. Cliente faz cotação, informando origem/destino, veículo, carga e preferência de atendimento, quando cabível.
7. A API calcula tarifa automaticamente com distância e duração (ou aproximação apenas no beta controlado), sem criar cobranças bancárias da viagem.
8. A API oferece a solicitação ao motorista elegível mais próximo em distância geográfica, por Socket.IO e Firebase Push. Redistribui se recusar ou expirar.
9. Motorista aceita, chega, inicia com código do cliente e finaliza com outro código.
10. Cliente paga diretamente ao motorista com Pix, cartão ou dinheiro, conforme os meios já escolhidos pelo prestador. O app apenas registra declarações, não concilia pagamentos no banco.
11. Cliente pode avaliar a viagem; o registro também é gravado no modelo `Avaliacao` já usado pelo Tanamão+.
12. A Home do Motorista poderá ler quilômetros, valores, quantidade de viagens, plano/indicações, histórico e manutenção, usando endpoints do módulo.

## Regras preservadas

- **A plataforma cobra apenas planos.** Viagens não passam pelo Mercado Pago da plataforma; sem split, comissão ou retenção.
- **Um cadastro de profissional, um plano de acesso e um código de indicação.** Não existe novo `User.role`.
- Os meios de recebimento vêm dos booleanos `Profissional.aceitaPix`, `.aceitaCartao`, `.aceitaDinheiro`.
- A preferência da cliente vem de `User.preferenciaProfissional`; a restrição de atendimento do prestador vem de `User.preferenciaAtendimento`. A aplicação é **no backend**, antes de oferecer/aceitar a viagem.
- Uma viagem aberta por cliente e uma viagem assumida por motorista por vez nesta versão (para evitar conflitos).
- Moto com passageiro fica **desabilitada por padrão** e exige liberação por localidade após análise regulatória.
- Aprovação de CNH **manual**: conferência visual não equivale à verificação online do status oficial do documento.
- Documento privado, chave de criptografia separada e auditoria das decisões administrativas.

## Importante: o que NÃO está homologado

- Não houve conexão com MongoDB/Render reais nem execução com passageiros ou veículos reais.
- Os testes automatizados são testes **isolados de regras**; não substituem testes de API completos e em staging.
- A tela do painel ADM ainda precisa consumir `/api/admin/mobilidade`; não foi alterada aqui.
- A Home de Motorista e a inclusão em `ServicosHomeScreen.js` ainda precisam ser ligadas a estas APIs; não foi alterado o app Expo.
- O rastreamento em segundo plano precisa ser integrado e testado no **Expo Dev Client**, com permissões nativas e políticas de privacidade adequadas. O backend aceita localização em primeiro plano.
- A ordenação inicial das ofertas usa **proximidade por distância geográfica**, não tempo real de trânsito até a coleta.
- A Google Routes API retorna distância e duração; a Geocoding API confirma cidades/UF para impedir troca de jurisdição/tarifa usando dados inventados no frontend. É necessário configurar chaves e ativar as APIs Google correspondentes para uso comercial.
- Estimativa aproximada (`MOBILITY_ALLOW_APPROXIMATE_ROUTES=true`) é **somente para beta com usuários autorizados**, sem cobranças reais.
- A regulamentação de transporte de passageiros por moto e de fretes de carga varia conforme cidade, atividade e veículo. Não ativar comercialmente sem validação jurídica/administrativa.

## Ordem segura de instalação

1. Crie uma nova branch Git ou clone de testes do backend e faça backup do deploy atual.
2. Copie **somente** os novos arquivos e o `server.js` deste pacote; não sobrescreva dados reais do MongoDB. Para a instalação completa, use o ZIP do backend integral fornecido separadamente.
3. Confira as diferenças com `git diff` e execute `node --check server.js` e `node --test tests/mobilidade.test.js`.
4. Rode uma instância **staging**, preferencialmente com MongoDB staging separado, e as variáveis da seção seguinte.
5. Teste o fluxo em `EXEMPLOS_TESTE.md` com **dois usuários de testes e um admin**.
6. Deixe `MOBILITY_MODULE_ENABLED` ausente ou `false` em produção até tudo estar homologado.
7. Só depois integre as novas telas no Expo SDK 54. Uma mudança de backend, isoladamente, não exige nova development build nativa.

## Variáveis de ambiente

```env
# Desligado por padrão; habilitar SOMENTE no serviço de teste.
MOBILITY_MODULE_ENABLED=true
# IDs de usuários de teste separados por vírgula. Ex.: cliente e profissional.
MOBILITY_BETA_USER_IDS=ID_CLIENTE_TESTE,ID_MOTORISTA_TESTE
# Gerar UMA VEZ e guardar como segredo: 32 bytes em hexadecimal (64 caracteres).
MOBILITY_DATA_KEY=COLOQUE_64_CARACTERES_HEX_AQUI
# Obrigatório para cálculos rodoviários comerciais.
MOBILITY_GOOGLE_ROUTES_API_KEY=
# Exige Google Geocoding API. Se vazio, tenta usar a mesma chave da Routes.
MOBILITY_GOOGLE_GEOCODING_API_KEY=
# SOMENTE beta com whitelist: preço estimado com haversine em vez de rota real.
MOBILITY_ALLOW_APPROXIMATE_ROUTES=true
MOBILITY_MAX_PICKUP_KM=25
MOBILITY_TIMEZONE=America/Campo_Grande
# Moto passageiros: manter desabilitado até autorização específica.
MOBILITY_MOTO_PASSENGER_ENABLED=false
MOBILITY_MOTO_APPROVED_CITIES=
```

Gere a chave privada no seu computador:

```powershell
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

**Nunca publique a chave ou um arquivo `.env` no Git, em prints ou nesta conversa.** Guarde a mesma chave ao reiniciar a API, pois a troca torna os dados antigos ilegíveis.

## Testes

```bash
node --check server.js
node --test tests/mobilidade.test.js
```

Requisito do backend enviado: **Node.js 20.x**. O JavaScript do módulo usa recursos compatíveis com Node 20.

## Próxima etapa do projeto

Integrar: cadastro específico após selecionar Motorista; aprovação no painel ADM; home de motorista com mapa; e botões de corridas, entregas e fretes na **ServicosHomeScreen**, que é a Home de Cliente ativa. A `ClienteHomeScreen` inativa não precisa ser modificada.
