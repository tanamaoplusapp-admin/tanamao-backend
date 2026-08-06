const path = require('path');

module.exports = function desenharTemplate(
  doc,
  orcamento
) {

  const logo = path.join(
    __dirname,
    '../../../assets/logo.png'
  );

  /* ==========================
      LOGO
  ========================== */

  try {

    doc.image(
      logo,
      45,
      35,
      {
        width: 90,
      }
    );

  } catch (e) {}

  /* ==========================
      CABEÇALHO
  ========================== */

  doc
    .fillColor('#2E4F2F')
    .fontSize(24)
    .font('Helvetica-Bold')
    .text(
      'ORÇAMENTO',
      150,
      40
    );

  doc
    .fontSize(11)
    .fillColor('#777')
    .font('Helvetica')
    .text(
      `Nº ${orcamento.numero}`,
      150,
      70
    );

  doc
    .moveTo(45, 105)
    .lineTo(550, 105)
    .stroke('#EAEAEA');

  /* ==========================
      PROFISSIONAL
  ========================== */

  doc
    .fontSize(15)
    .fillColor('#2E4F2F')
    .font('Helvetica-Bold')
    .text(
      'Profissional',
      45,
      125
    );

  doc
    .fontSize(11)
    .fillColor('#333')
    .font('Helvetica')
    .text(
      orcamento.profissional.nome,
      45,
      150
    );

  doc.text(
    orcamento.profissional.profissao || '',
    45,
    168
  );

  doc.text(
    orcamento.profissional.telefone || '',
    45,
    186
  );

  doc.text(
    orcamento.profissional.email || '',
    45,
    204
  );

  /* ==========================
      CLIENTE
  ========================== */

  doc
    .fontSize(15)
    .fillColor('#2E4F2F')
    .font('Helvetica-Bold')
    .text(
      'Cliente',
      320,
      125
    );

  doc
    .fontSize(11)
    .fillColor('#333')
    .font('Helvetica')
    .text(
      orcamento.cliente.nome || '',
      320,
      150
    );

  doc.text(
    orcamento.cliente.telefone || '',
    320,
    168
  );

  doc.text(
    orcamento.cliente.email || '',
    320,
    186
  );

  doc.text(
    orcamento.cliente.endereco || '',
    320,
    204
  );

  doc
    .moveTo(45, 235)
    .lineTo(550, 235)
    .stroke('#EAEAEA');
      /* ==========================
      TABELA
  ========================== */

  let y = 255;

  doc
    .fillColor('#FFFFFF')
    .rect(45, y, 505, 28)
    .fill('#2E4F2F');

  doc
    .fillColor('#FFF')
    .fontSize(10)
    .font('Helvetica-Bold');

  doc.text('Descrição', 55, y + 9);

  doc.text('Qtd', 330, y + 9, {
    width: 40,
    align: 'center',
  });

  doc.text('Unitário', 390, y + 9, {
    width: 70,
    align: 'right',
  });

  doc.text('Subtotal', 470, y + 9, {
    width: 70,
    align: 'right',
  });

  y += 28;

  /* ==========================
      ITENS
  ========================== */

  doc
    .font('Helvetica')
    .fontSize(10);

  orcamento.itens.forEach((item) => {

    doc
      .fillColor('#333')
      .text(
        item.descricao,
        55,
        y + 8,
        {
          width: 250,
        }
      );

    doc.text(
      String(item.quantidade),
      330,
      y + 8,
      {
        width: 40,
        align: 'center',
      }
    );

    doc.text(
      `R$ ${Number(item.valorUnitario).toFixed(2)}`,
      390,
      y + 8,
      {
        width: 70,
        align: 'right',
      }
    );

    doc.text(
      `R$ ${Number(item.subtotal).toFixed(2)}`,
      470,
      y + 8,
      {
        width: 70,
        align: 'right',
      }
    );

    y += 32;

    doc
      .moveTo(45, y)
      .lineTo(550, y)
      .stroke('#EFEFEF');

  });

  y += 20;
    /* ==========================
      TOTAIS
  ========================== */

  const caixaX = 330;
  const caixaY = y;

  doc
    .roundedRect(
      caixaX,
      caixaY,
      220,
      110,
      10
    )
    .fillAndStroke(
      '#F8F9FB',
      '#EAEAEA'
    );

  doc
    .fillColor('#555')
    .fontSize(11)
    .font('Helvetica')
    .text(
      'Subtotal',
      caixaX + 15,
      caixaY + 18
    );

  doc.text(
    `R$ ${Number(orcamento.subtotal).toFixed(2)}`,
    caixaX + 110,
    caixaY + 18,
    {
      width: 90,
      align: 'right',
    }
  );

  doc.text(
    'Desconto',
    caixaX + 15,
    caixaY + 42
  );

  doc.text(
    `R$ ${Number(orcamento.desconto).toFixed(2)}`,
    caixaX + 110,
    caixaY + 42,
    {
      width: 90,
      align: 'right',
    }
  );

  doc.text(
    'Acréscimo',
    caixaX + 15,
    caixaY + 66
  );

  doc.text(
    `R$ ${Number(orcamento.acrescimo).toFixed(2)}`,
    caixaX + 110,
    caixaY + 66,
    {
      width: 90,
      align: 'right',
    }
  );

  doc
    .moveTo(
      caixaX + 15,
      caixaY + 88
    )
    .lineTo(
      caixaX + 205,
      caixaY + 88
    )
    .stroke('#DDDDDD');

  doc
    .fillColor('#FF9900')
    .font('Helvetica-Bold')
    .fontSize(18)
    .text(
      'TOTAL',
      caixaX + 15,
      caixaY + 95
    );

  doc.text(
    `R$ ${Number(orcamento.total).toFixed(2)}`,
    caixaX + 95,
    caixaY + 95,
    {
      width: 105,
      align: 'right',
    }
  );

  /* ==========================
      OBSERVAÇÕES
  ========================== */

  y += 145;

  doc
    .fillColor('#2E4F2F')
    .fontSize(15)
    .font('Helvetica-Bold')
    .text(
      'Observações',
      45,
      y
    );

  doc
    .fillColor('#444')
    .fontSize(11)
    .font('Helvetica')
    .text(
      orcamento.observacoes ||
        'Nenhuma observação.',
      45,
      y + 24,
      {
        width: 505,
        lineGap: 4,
      }
    );
      /* ==========================
      ASSINATURA
  ========================== */

  y += 95;

  doc
    .strokeColor('#CFCFCF')
    .moveTo(140, y)
    .lineTo(455, y)
    .stroke();

  doc
    .fillColor('#666')
    .font('Helvetica')
    .fontSize(10)
    .text(
      orcamento.profissional.nome,
      140,
      y + 8,
      {
        width: 315,
        align: 'center',
      }
    );

  doc
    .fontSize(9)
    .fillColor('#888')
    .text(
      orcamento.profissional.profissao || '',
      140,
      y + 24,
      {
        width: 315,
        align: 'center',
      }
    );

  /* ==========================
      QR CODE (RESERVADO)
  ========================== */

  doc
    .roundedRect(
      45,
      y - 10,
      65,
      65,
      6
    )
    .stroke('#DDDDDD');

  doc
    .fillColor('#999')
    .fontSize(8)
    .text(
      'QR CODE',
      55,
      y + 18
    );

  /* ==========================
      RODAPÉ
  ========================== */

  doc
    .moveTo(45, 770)
    .lineTo(550, 770)
    .stroke('#EAEAEA');

  doc
    .fillColor('#888')
    .fontSize(9)
    .font('Helvetica')
    .text(
      'Documento gerado automaticamente pelo Tanamão+',
      45,
      782,
      {
        width: 505,
        align: 'center',
      }
    );

  doc
    .fontSize(8)
    .fillColor('#AAAAAA')
    .text(
      `Gerado em ${new Date().toLocaleString('pt-BR')}`,
      45,
      797,
      {
        width: 505,
        align: 'center',
      }
    );

};