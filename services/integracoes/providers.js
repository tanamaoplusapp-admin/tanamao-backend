// backend/services/integracoes/providers.js
// cada provedor ERP que você quiser suportar
// Omie só aparece se OMIE_CLIENT_ID/SECRET existirem no .env

const omie =
  process.env.OMIE_CLIENT_ID && process.env.OMIE_CLIENT_SECRET
    ? {
        type: 'oauth2',
        authUrl: 'https://app.omie.com.br/api/app/auth',   // confira na sua app Omie
        tokenUrl: 'https://app.omie.com.br/api/app/token', // idem
        clientId: process.env.OMIE_CLIENT_ID,
        clientSecret: process.env.OMIE_CLIENT_SECRET,
        scope: 'read:products write:products', // ajuste escopo conforme necessidade
        mapProfile: async (_tokenResponse) => ({ ok: true }), // opcional
      }
    : null;

module.exports = {
  ...(omie ? { omie } : {}),

  // Tiny: API v2 (formato JSON). Mantemos aqui a base "api2".
  tiny: {
    type: 'apikey',
    baseUrl: process.env.TINY_BASE_URL || 'https://api.tiny.com.br/api2',
  },

  bling: {
    type: 'apikey',
    baseUrl: process.env.BLING_BASE_URL || 'https://bling.com.br/Api/v3',
  },

  custom: {
    type: 'custom', // baseUrl + apiKey definidos por empresa
  },
};
