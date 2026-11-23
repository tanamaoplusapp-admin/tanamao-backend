# Registro de alterações e critérios de não regressão

Pacote gerado com base nos arquivos enviados em 19/11/2026.

## Arquivos existentes modificados

- Apenas `server.js`: registros isolados de `/api/mobilidade`, `/api/admin/mobilidade`, namespace autenticado de Socket.IO e chamada ao redespacho quando `MOBILITY_MODULE_ENABLED=true`.

## Arquivos novos

- `config/mobilidade.js`: flags, modalidades, veículos e regras municipais básicas.
- `middleware/mobilidade.js`: autorização, administrador, plano profissional e tratamento de erros do módulo.
- `models/Mobilidade*.js`: perfil, veículo, documentos privados, manutenção, cotação, solicitação, tarifas, mensagens, avaliação e auditoria.
- `routes/mobilidadeRoutes.js` e `routes/mobilidadeAdminRoutes.js`: contratos de API.
- `controllers/mobilidadeController.js` e `controllers/mobilidadeAdminController.js`: regras de usuário, viagem e aprovação.
- `services/mobilidade*.js`: preços, geocoding, autenticação Socket, gênero, pagamento direto, profissão, período e despacho de ofertas.
- `tests/mobilidade.test.js`: verificações isoladas com `node:test` nativo do Node 20+.
- Documentação em `docs/`.

## Arquivos expressamente intocados

- `models/Profissional.js`, `models/user.js`, controllers de cadastro, TanaMatch e indicação.
- Todos os endpoints existentes (`/api/profissionais`, `/api/servicos`, `/api/motorista`, `/api/drivers`, `/api/frete`, `/api/entregas`, `/api/payment`, `/api/mensalidade`).
- `package.json` e `package-lock.json` do backend (mesmas versões do usuário).
- Telas e configuração do app Expo SDK 54.
- UI do painel administrativo (precisará de consumo dos novos endpoints).

## Restrições operacionais

Aprovação manual de CNH é conferência documental, não consulta oficial à Senatran. O modo `aproximacao` não representa a distância por rodovia e não deve embasar cobranças comerciais. A priorização de ofertas é feita pela distância geográfica inicial. O tracking em background e notificações de navegação no frontend dependem da futura integração do app.

## Testes automáticos

18 testes de regras aprovados sob Node 22 neste ambiente. `node --check` passou para os novos arquivos e `server.js`. Não foi possível executar uma integração Node 20 + MongoDB real nesta execução: não há conexão de staging e a tentativa de `npm ci` ficou sem acesso ao registry. A validação final exige teste real do ambiente antes de publicar.

**Instalação recomendada:** aplicar o ZIP incremental em uma branch de homologação, comparar o `server.js` com o do repositório atual, executar os testes, validar com 2 usuários de teste, só então considerar a integração no app SDK 54.
