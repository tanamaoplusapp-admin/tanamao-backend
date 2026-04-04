const express = require('express');

const router = express.Router();

router.get('/privacy', (req, res) => {
  res.send(`
    <html>
      <head>
        <title>Política de Privacidade - Tanamão+</title>
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
          }
          h1 { color: #111; }
          h2 { margin-top: 30px; }
          p { margin-top: 8px; }
          ul { margin-top: 8px; }
        </style>
      </head>
      <body>

        <h1>Política de Privacidade - Tanamão+</h1>

        <p>O Tanamão+ respeita sua privacidade e está comprometido em proteger seus dados pessoais. Esta política explica como coletamos, utilizamos e protegemos suas informações.</p>

        <h2>1. Informações coletadas</h2>
        <p>Podemos coletar as seguintes informações:</p>
        <ul>
          <li>Nome</li>
          <li>Email</li>
          <li>Telefone</li>
          <li>Foto de perfil</li>
          <li>Localização aproximada</li>
          <li>Mensagens enviadas no chat</li>
          <li>Dados de serviços solicitados</li>
          <li>Informações do dispositivo</li>
        </ul>

        <h2>2. Como usamos as informações</h2>
        <p>Utilizamos os dados para:</p>
        <ul>
          <li>Conectar clientes e prestadores de serviço</li>
          <li>Permitir comunicação via chat</li>
          <li>Mostrar profissionais próximos</li>
          <li>Processar solicitações de serviço</li>
          <li>Melhorar a experiência do usuário</li>
          <li>Garantir segurança da plataforma</li>
        </ul>

        <h2>3. Localização</h2>
        <p>O Tanamão+ utiliza a localização do usuário para encontrar prestadores próximos e melhorar a experiência. A localização é utilizada apenas enquanto o aplicativo estiver em uso.</p>

        <h2>4. Compartilhamento de dados</h2>
        <p>Seus dados podem ser compartilhados apenas entre usuários envolvidos em um serviço dentro da plataforma. Não vendemos dados pessoais.</p>

        <h2>5. Armazenamento e segurança</h2>
        <p>Os dados são armazenados em servidores seguros com medidas de proteção contra acesso não autorizado.</p>

        <h2>6. Exclusão da conta</h2>
        <p>O usuário pode excluir sua conta diretamente dentro do aplicativo a qualquer momento. Ao excluir a conta, seus dados pessoais serão removidos permanentemente.</p>

        <h2>7. Alterações nesta política</h2>
        <p>Esta política pode ser atualizada para melhorias do serviço.</p>

        <h2>8. Contato</h2>
        <p>Email: tanamao.plus.app@gmail.com</p>

        <p>Última atualização: 2026</p>

      </body>
    </html>
  `);
});

module.exports = router;