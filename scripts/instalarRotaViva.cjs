'use strict';
// Injeta a rota APOS a autenticacao e ANTES de outras declaracoes de /rota.
// Edita a copia real do projeto sem sobrescrever outras mudancas no routes/.
const fs=require('fs'), path=require('path');
const filename=path.join(process.cwd(),'routes','mobilidadeRoutes.js');
if (!fs.existsSync(filename)) {console.error('Execute na raiz do backend: routes/mobilidadeRoutes.js nao existe');process.exit(1);}
const src=fs.readFileSync(filename,'utf8');
const begin='// TANAMAO_ROTA_VIVA_BEGIN';
if(src.includes(begin)){console.log('Rota viva ja instalada');process.exit(0);}
const match=/router\.use\(\s*guardEnabled\s*,\s*verifyToken\s*,\s*betaGuard\s*\)\s*;/;
if(!match.test(src)){console.error('Nao foi encontrada a sequencia original de autenticacao. Nenhum arquivo alterado.');process.exit(1);}
const code=`\n${begin}\n// Sempre autenticada; o handler verifica quem pertence a cada viagem.\nrouter.get('/solicitacoes/:jobId/rota', rateLimit({windowMs:60000, max:20, standardHeaders:true, legacyHeaders:false, keyGenerator:req=>String(req.userId||req.ip)}), asyncHandler(require('../services/mobilidadeRotasVivas').rotaViagem));\n// TANAMAO_ROTA_VIVA_END\n`;
fs.writeFileSync(filename+'.bak-rota-viva',src);
fs.writeFileSync(filename,src.replace(match,s=>s+code));
console.log('Rota instalada e backup criado em routes/mobilidadeRoutes.js.bak-rota-viva');
