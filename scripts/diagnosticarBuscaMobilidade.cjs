// Run inside backend: node scripts/diagnosticarBuscaMobilidade.cjs
// Uses the configured private backend key, but never logs its value.
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { randomUUID } = require('node:crypto');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

(async () => {
  const backendDir = path.join(__dirname, '..');
  const rota = path.join(backendDir, 'routes', 'mobilidadeRoutes.js');
  const codigo = fs.existsSync(rota) ? fs.readFileSync(rota, 'utf8') : '';
  const nomes = ['/cliente/lugares/sessao', '/cliente/lugares/sugestoes', '/cliente/lugares/detalhes'];
  console.log('[1] Rotas da busca:', nomes.every(p => codigo.includes(p)) ? 'INSTALADAS' : 'AUSENTES - instale a atualizacao do backend');
  console.log('[2] Modulo Mobilidade:', process.env.MOBILITY_MODULE_ENABLED === 'true' ? 'ATIVO' : 'DESATIVADO OU NAO DEFINIDO');
  const key = process.env.MOBILITY_GOOGLE_PLACES_API_KEY || process.env.MOBILITY_GOOGLE_GEOCODING_API_KEY;
  console.log('[3] Chave Places no backend:', key ? 'CONFIGURADA' : 'AUSENTE');
  if (!key) { console.log('Acrescente MOBILITY_GOOGLE_PLACES_API_KEY ao backend/.env e reinicie node server.js.'); process.exitCode = 1; return; }
  const body = { input: 'Avenida Brasil Ponta Pora MS', languageCode: 'pt-BR', regionCode: 'BR', includedRegionCodes: ['br'], sessionToken: randomUUID() };
  try {
    const r = await fetch('https://places.googleapis.com/v1/places:autocomplete', {
      method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Goog-Api-Key': key,
        'X-Goog-FieldMask': 'suggestions.placePrediction.placeId,suggestions.placePrediction.text' },
      body: JSON.stringify(body), signal: AbortSignal.timeout(12000),
    });
    const data = await r.json().catch(() => ({}));
    const count = Array.isArray(data?.suggestions) ? data.suggestions.filter(x => x.placePrediction?.placeId).length : 0;
    console.log('[4] Google Places API HTTP:', r.status);
    if (!r.ok) {
      console.log('[5] Codigo Google:', data?.error?.status || 'nao informado');
      console.log('Verifique ativacao de Places API (New), faturamento e restricao da chave no mesmo projeto.');
      process.exitCode = 1;
      return;
    }
    console.log('[5] Sugestoes devolvidas pelo Google:', count);
    if (!count) console.log('A API respondeu, mas sem previsoes. Teste outra rua com cidade/UF.');
    else console.log('A busca externa funciona; se o app nao listar, confirme o backend configurado no Expo e a autenticacao.');
  } catch (err) {
    console.log('[4] Nao foi possivel acessar o Google a partir do backend:', err?.cause?.code || err?.name || 'falha de rede');
    process.exitCode = 1;
  }
})();
