const express = require('express');
const crypto = require('crypto');
const fetch = require('node-fetch');
const qs = require('querystring');
const router = express.Router();

const providers = require('../services/integracoes/providers');
const IntegracaoCred = require('../models/IntegracaoCred');

// GET /api/integracoes/oauth/providers
router.get('/providers', (req, res) => {
  const enabled = Object.keys(providers).filter((k) => providers[k]?.type === 'oauth2');
  res.json({ providers: enabled });
});

// GET /api/integracoes/oauth/start?empresaId=&provider=
router.get('/start', async (req, res) => {
  const { empresaId, provider } = req.query;
  const cfg = providers[provider];
  if (!empresaId || !cfg || cfg.type !== 'oauth2') {
    return res.status(400).send('Parâmetros inválidos');
  }

  const state = crypto.randomBytes(16).toString('hex');
  const redirectUri = `${process.env.APP_BASE_URL || 'http://localhost:5000'}/api/integracoes/oauth/callback`;

  const packed = Buffer.from(JSON.stringify({ empresaId, provider, state })).toString('base64url');

  const authUrl =
    `${cfg.authUrl}?response_type=code&client_id=${encodeURIComponent(cfg.clientId)}` +
    `&redirect_uri=${encodeURIComponent(redirectUri)}` +
    `&scope=${encodeURIComponent(cfg.scope || '')}` +
    `&state=${encodeURIComponent(packed)}`;

  res.redirect(authUrl);
});

// GET /api/integracoes/oauth/callback?code=&state=
router.get('/callback', async (req, res) => {
  try {
    const { code, state } = req.query;
    if (!code || !state) return res.status(400).send('Faltando parâmetros');

    const decoded = JSON.parse(Buffer.from(String(state), 'base64url').toString('utf8'));
    const { empresaId, provider } = decoded;
    const cfg = providers[provider];
    if (!cfg || cfg.type !== 'oauth2') return res.status(400).send('Provider inválido');

    const redirectUri = `${process.env.APP_BASE_URL || 'http://localhost:5000'}/api/integracoes/oauth/callback`;
    const body = {
      grant_type: 'authorization_code',
      code,
      redirect_uri: redirectUri,
      client_id: cfg.clientId,
      client_secret: cfg.clientSecret,
    };

    const resp = await fetch(cfg.tokenUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: qs.stringify(body),
    });
    const token = await resp.json();

    if (!resp.ok || !token?.access_token) {
      console.error('[oauth.callback] token error:', token);
      return res.status(400).send('Não foi possível obter token');
    }

    const expiresAt = token.expires_in
      ? new Date(Date.now() + Number(token.expires_in) * 1000)
      : null;

    await IntegracaoCred.findOneAndUpdate(
      { empresaId, provider },
      {
        $set: {
          accessToken: token.access_token,
          refreshToken: token.refresh_token || null,
          scope: token.scope || cfg.scope || '',
          expiresAt,
          meta: { tokenRaw: token },
        },
      },
      { upsert: true, new: true }
    );

    const { enqueueSyncFromProvider } = require('../services/integracoes/syncService');
    enqueueSyncFromProvider({ empresaId, provider }).catch(() => {});

    res.send(`
      <html>
        <body style="font-family: sans-serif">
          <h3>Conexão realizada!</h3>
          <p>Você já pode voltar ao app.</p>
          <script>setTimeout(() => window.close(), 800)</script>
        </body>
      </html>
    `);
  } catch (e) {
    console.error('[oauth.callback] erro:', e);
    res.status(500).send('Erro no callback');
  }
});

module.exports = router;
