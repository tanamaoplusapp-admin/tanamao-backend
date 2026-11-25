const express = require('express');

const router = express.Router();

/* =====================================================
   POLÍTICA DE PRIVACIDADE
   URL: /privacy
===================================================== */

router.get('/privacy', (req, res) => {
  res.redirect(302, 'https://tanamaoplus.com/pages/privacidade.html');
});


/* =====================================================
   SOBRE O TANAMÃO+
   URL: /privacy/about
===================================================== */

router.get('/privacy/about', (req, res) => {
  res.status(200).send(`
    <!DOCTYPE html>
    <html lang="pt-BR">
      <head>
        <title>Sobre o Tanamão+</title>
        <meta charset="utf-8"/>
        <meta name="viewport" content="width=device-width, initial-scale=1"/>

        <style>
          body {
            font-family: Arial, sans-serif;
            padding: 40px;
            max-width: 900px;
            margin: auto;
            line-height: 1.6;
            color: #222;
            background: #fff;
          }

          h1 {
            color: #2E4F2F;
          }

          .brand {
            color: #FF9900;
            font-weight: bold;
          }

          a {
            color: #FF9900;
          }

          @media (max-width: 600px) {
            body {
              padding: 20px;
            }
          }
        </style>
      </head>

      <body>

        <h1>
          Sobre o <span class="brand">Tanamão+</span>
        </h1>

        <p>
          O Tanamão+ é uma plataforma desenvolvida para conectar
          clientes e profissionais de serviços de forma simples,
          prática e segura.
        </p>

        <p>
          A plataforma permite que clientes encontrem profissionais,
          conheçam seus serviços, solicitem atendimentos e mantenham
          comunicação através do aplicativo.
        </p>

        <p>
          Nosso objetivo é facilitar a contratação de serviços e
          proporcionar uma experiência mais organizada tanto para
          clientes quanto para profissionais.
        </p>

        <h2>Contato</h2>

        <p>
          Email:
          <a href="mailto:tanamao.plus.app@gmail.com">
            tanamao.plus.app@gmail.com
          </a>
        </p>

        <p>
          <a href="/privacy">
            Política de Privacidade
          </a>
        </p>

      </body>
    </html>
  `);
});


/* =====================================================
   CONTATO
   URL: /privacy/contact
===================================================== */

router.get('/privacy/contact', (req, res) => {
  res.status(200).send(`
    <!DOCTYPE html>
    <html lang="pt-BR">
      <head>
        <title>Contato - Tanamão+</title>
        <meta charset="utf-8"/>
        <meta name="viewport" content="width=device-width, initial-scale=1"/>

        <style>
          body {
            font-family: Arial, sans-serif;
            padding: 40px;
            max-width: 900px;
            margin: auto;
            line-height: 1.6;
            color: #222;
            background: #fff;
          }

          h1 {
            color: #2E4F2F;
          }

          .contact-box {
            margin-top: 25px;
            padding: 25px;
            border-radius: 12px;
            background: #f7f7f7;
          }

          a {
            color: #FF9900;
            font-weight: bold;
          }

          @media (max-width: 600px) {
            body {
              padding: 20px;
            }
          }
        </style>
      </head>

      <body>

        <h1>Contato</h1>

        <p>
          Entre em contato com a equipe do Tanamão+ através
          do nosso canal oficial de atendimento.
        </p>

        <div class="contact-box">

          <h2>Tanamão+</h2>

          <p>
            Email:
            <a href="mailto:tanamao.plus.app@gmail.com">
              tanamao.plus.app@gmail.com
            </a>
          </p>

        </div>

        <p>
          <a href="/privacy">
            Política de Privacidade
          </a>
        </p>

        <p>
          <a href="/privacy/about">
            Sobre o Tanamão+
          </a>
        </p>

      </body>
    </html>
  `);
});


module.exports = router;