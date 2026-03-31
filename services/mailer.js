// services/mailer.js
const nodemailer = require('nodemailer');
const config = require('../config/env');

const ENABLED = !!(config.email?.enabled && config.email?.host);

// remetente padrão
const FROM_EMAIL = process.env.EMAIL_FROM || config.email?.user || 'no-reply@tanamao.app';
const FROM_NAME  = process.env.EMAIL_FROM_NAME || config.appName || 'TaNaMao+';
const DEFAULT_FROM = `"${FROM_NAME}" <${FROM_EMAIL}>`;

let transporter = null;

if (ENABLED) {
  const baseOptions = {
    host: config.email.host,
    port: config.email.port,
    secure: !!config.email.secure, // true = 465
    auth: (config.email.user && config.email.pass)
      ? { user: config.email.user, pass: config.email.pass }
      : undefined,
  };

  // DKIM opcional via .env
  const dkimDomainName  = process.env.EMAIL_DKIM_DOMAIN || '';
  const dkimKeySelector = process.env.EMAIL_DKIM_SELECTOR || '';
  const dkimPrivateKey  = (process.env.EMAIL_DKIM_PRIVATE_KEY || '').replace(/\\n/g, '\n');

  if (dkimDomainName && dkimKeySelector && dkimPrivateKey) {
    baseOptions.dkim = {
      domainName: dkimDomainName,
      keySelector: dkimKeySelector,
      privateKey: dkimPrivateKey,
    };
  }

  // TLS opcional: desativar validação (não recomendado em prod)
  if (String(process.env.EMAIL_TLS_REJECT_UNAUTHORIZED || '').toLowerCase() === 'false') {
    baseOptions.tls = { rejectUnauthorized: false };
  }

  transporter = nodemailer.createTransport(baseOptions);

  transporter
    .verify()
    .then(() => console.log('📧 SMTP pronto (mailer verificado)'))
    .catch((e) => console.warn('📧 SMTP verify falhou:', e.message));
} else {
  console.log('📪 E-mail desabilitado (EMAIL_ENABLED != true ou host ausente).');
}

/**
 * Envia e-mail transacional.
 * Uso:
 *   await sendMail({ to, subject, html })           // html puro
 *   await sendMail({ to, subject, text })           // texto puro
 *   await sendMail({ to, subject, html, attachments: [...] })
 */
async function sendMail(options = {}) {
  const {
    to,
    subject,
    html,
    text,
    from = DEFAULT_FROM,
    replyTo,
    attachments, // [{ filename, content|path, contentType }]
    headers,
    messageId,   // opcional
  } = options;

  if (!to || !subject) {
    const err = new Error('Campos "to" e "subject" são obrigatórios.');
    err.statusCode = 400;
    throw err;
  }

  if (!transporter) {
    // modo silencioso quando desabilitado
    console.log('📪 E-mail suprimido (mailer desabilitado):', { to, subject });
    return { skipped: true, to, subject };
  }

  const mailOptions = {
    from,
    to,
    subject,
    // se vier somente html/text, nodemailer trata
    ...(html ? { html } : {}),
    ...(text ? { text } : (html ? { text: stripHtml(html) } : {})),
    ...(replyTo ? { replyTo } : {}),
    ...(attachments ? { attachments } : {}),
    ...(headers ? { headers } : {}),
    ...(messageId ? { messageId } : {}),
  };

  return transporter.sendMail(mailOptions);
}

// helper simples para texto de fallback
function stripHtml(s = '') {
  return String(s).replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
}

/* Exports compatíveis com o restante do projeto */
module.exports = {
  sendMail,
  transporter,
  enabled: ENABLED,
  DEFAULT_FROM,
};
