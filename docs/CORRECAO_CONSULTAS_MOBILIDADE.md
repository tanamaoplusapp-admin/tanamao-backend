# Correcao das consultas de Mobilidade (MongoDB/Mongoose)

## O que corrige

O arquivo `config/db.js` do Tanamao+ ja usa `mongoose.set('sanitizeFilter', true)`.
Esse mecanismo protege contra injecao de operadores recebidos pelo usuario, mas tambem envolve operadores internos de consultas sem marcacao explicita. Em consultas como `createdAt: { $lt: data }`, pode resultar no erro `Cast to date failed`.

Esta correcao marca apenas operadores CONSTRUIDOS PELO BACKEND com `mongoose.trusted(...)` nas consultas de Mobilidade; preserva a configuracao de seguranca global.

## Arquivos para substituir

- `backend/services/mobilidadeDespacho.js`
- `backend/controllers/mobilidadeController.js`
- `backend/controllers/mobilidadeAdminController.js`
- `backend/tests/mobilidade.test.js` (testes; opcional, recomendado)

Nao substitua `server.js`, `config/db.js`, `package.json` ou `.env`.

## Como aplicar no Windows

1. Pare apenas o Node do backend que esta rodando na porta 5000 (Ctrl+C no terminal correspondente).
2. Faca backup dos tres arquivos atuais de Mobilidade.
3. Extraia o ZIP na pasta `C:\Users\User\Documents\tanamao_plus`, mantendo as pastas internas. Confirme a substituicao dos quatro JS listados acima.
4. Na pasta `backend`, rode os testes e a verificacao de sintaxe:

```powershell
node --check .\services\mobilidadeDespacho.js
node --check .\controllers\mobilidadeController.js
node --check .\controllers\mobilidadeAdminController.js
node --test .\tests\mobilidade.test.js
```

5. Execute `node server.js` UMA VEZ. Se a porta 5000 estiver ocupada, identifique a instancia anterior antes de encerrar qualquer processo.

```powershell
Get-NetTCPConnection -LocalPort 5000 -State Listen | Select-Object LocalPort, OwningProcess
```

6. Confira que nao aparece mais `[mobilidade redispatch] Cast to date failed`.

## Limites de verificacao

Foram aprovados 19 testes isolados de regras, incluindo regressao dos operadores de data. Ainda e necessario testar com MongoDB real e logs de aplicacao. Este ZIP nao altera dados, banco, chaves, tarifas, pagamentos ou rotas do servidor.
