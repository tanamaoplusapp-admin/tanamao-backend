// utils/sendEmail.js
const config = require('../config/env');
const sendRaw = require('../services/mailer'); // usa o transporter singleton já configurado

// Helpers
const toStr = (v) => (v == null ? '' : String(v));
const stripHtml = (html = '') =>
  toStr(html).replace(/<style[\s\S]*?<\/style>/gi, '')
             .replace(/<script[\s\S]*?<\/script>/gi, '')
             .replace(/<[^>]+>/g, ' ')
             .replace(/\s+/g, ' ')
             .trim();

const defaultTemplate = ({ subject, text }) => `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>${toStr(subject)}</title>
</head>
<body style="margin:0;background:#f5f7fb;font-family:Arial,Helvetica,sans-serif;">
  <div style="max-width:600px;margin:24px auto;background:#ffffff;border-radius:8px;box-shadow:0 2px 10px rgba(0,0,0,.06);overflow:hidden">
    <div style="padding:20px 24px;border-bottom:1px solid #f0f0f0">
      <h2 style="margin:0;color:#2E4F2F;font-size:20px;letter-spacing:.2px">Tá na Mão+</h2>
    </div>
    <div style="padding:24px;color:#333;font-size:15px;line-height:1.6">
      <p style="margin:0;white-space:pre-wrap">${toStr(text)}</p>
      <p style="margin-top:28px;font-size:13px;color:#666">
        Se você não solicitou este e-mail, ignore esta mensagem.
      </p>
    </div>
    <div style="padding:14px 24px;background:#fafafa;border-top:1px solid #f0f0f0;color:#888;font-size:12px;text-align:center">
      © ${new Date().getFullYear()} Tá na Mão+
    </div>
  </div>
</body>
</html>`;

/**
 * Envia e-mail com template padrão.
 *
 * Pode ser chamado como:
 *  sendEmail({ to, subject, text, html, cc, bcc, replyTo, attachments })
 *  sendEmail(to, subject, text)  // compatível com código legado
 */
module.exports = async function sendEmail(arg1, subjectArg, textArg) {
  // Se e-mail estiver desabilitado via config/env, não tenta enviar
  if (!config.email?.enabled || !config.email?.host) {
    console.log('📪 E-mail suprimido (EMAIL_ENABLED != true ou host vazio)');
    return { skipped: true };
  }

  // Normalização dos argumentos
  const isObject = arg1 && typeof arg1 === 'object' && !Array.isArray(arg1);
  const opts = isObject
    ? { ...arg1 }
    : { to: arg1, subject: subjectArg, text: textArg };

  if (!opts.to) throw new Error('sendEmail: "to" é obrigatório');
  if (!opts.subject && !opts.html && !opts.text) {
    throw new Error('sendEmail: informe "subject" e "text" ou "html".');
  }

  // From padrão
  const fromAddr =
    process.env.EMAIL_FROM ||
    (config.email.user ? `"Tá na Mão+" <${config.email.user}>` : undefined);

  // Conteúdo
  let { html, text } = opts;

  // Se só vier text, gera um HTML padrão
  if (!html && text) {
    html = defaultTemplate({ subject: opts.subject || '', text });
  }

  // Se só vier html, tenta extrair um text simples
  if (html && !text) {
    text = stripHtml(html);
  }

  // Montagem final
  const mail = {
    from: fromAddr,
    to: opts.to,
    subject: toStr(opts.subject || 'Tá na Mão+'),
    text,
    html,
    cc: opts.cc,
    bcc: opts.bcc,
    replyTo: opts.replyTo,
    attachments: Array.isArray(opts.attachments) ? opts.attachments : undefined,
  };

  // Dispara via serviço (nodemailer já configurado em services/mailer.js)
  return sendRaw(mail);
};
