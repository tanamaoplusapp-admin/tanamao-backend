// services/integracoes/providers/index.js
module.exports = {
  tiny: {
    type: 'apikey',
    baseUrl: 'https://api.tiny.com.br/api2',
    // sem clientId/clientSecret no Tiny
  },
  omie: {
    // se for usar OAuth:
    type: 'oauth2',
    authUrl: 'https://app.omie.com.br/api/v1/oauth/authorize',
    tokenUrl: 'https://app.omie.com.br/api/v1/oauth/token',
    scope: 'produtos clientes pedidos', // ajuste conforme habilitação na conta
    // Preencha via env/config:
    clientId: process.env.OMIE_CLIENT_ID || '',
    clientSecret: process.env.OMIE_CLIENT_SECRET || '',
  },
};
