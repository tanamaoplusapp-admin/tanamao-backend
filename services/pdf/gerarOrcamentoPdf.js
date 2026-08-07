const fs = require('fs');
const path = require('path');
const PDFDocument = require('pdfkit');

const Orcamento = require('../../models/Orcamento');

const desenharTemplate = require('./templates/orcamentoTemplate');

module.exports = async function gerarOrcamentoPdf(
  orcamentoId
) {

  const orcamento = await Orcamento.findById(
    orcamentoId
  );

  if (!orcamento) {
    throw new Error(
      'Orçamento não encontrado.'
    );
  }

  const pasta = path.join(
    __dirname,
    '../../tmp'
  );

 if (!fs.existsSync(pasta)) {
  fs.mkdirSync(pasta, { recursive: true });
}

  const arquivo = path.join(
    pasta,
    `orcamento-${orcamento.numero}.pdf`
  );

  const doc = new PDFDocument({

    size: 'A4',

    margin: 45,

  });

  const stream =
    fs.createWriteStream(arquivo);

  doc.pipe(stream);
    desenharTemplate(doc, orcamento);

  doc.end();

  await new Promise((resolve, reject) => {

    stream.on(
      'finish',
      resolve
    );

    stream.on(
      'error',
      reject
    );

  });
  const stats = fs.statSync(arquivo);

console.log('PDF GERADO');
console.log('Arquivo:', arquivo);
console.log('Tamanho:', stats.size);
return {

  caminho: arquivo,

  orcamento,

};

};

