const fs = require('fs');
const cloudinary = require('../../config/cloudinary');

module.exports = async function uploadPdf(
  caminhoArquivo,
  numeroOrcamento
) {
  try {

    const resultado = await cloudinary.uploader.upload(
      caminhoArquivo,
      {
        resource_type: 'raw',

        folder: 'tanamao/orcamentos',

        public_id: numeroOrcamento.replace('.pdf', ''),

        overwrite: true,

        invalidate: true,
      }
    );

    console.log('================ CLOUDINARY PDF ================');
    console.log(resultado);
    console.log('===============================================');

    if (fs.existsSync(caminhoArquivo)) {
      fs.unlinkSync(caminhoArquivo);
    }
console.log(resultado.secure_url);
console.log(resultado.url);
    return {

      url: resultado.secure_url,

      
        downloadUrl:
`https://res.cloudinary.com/${process.env.CLOUDINARY_CLOUD_NAME}/raw/upload/fl_attachment/v${resultado.version}/${resultado.public_id}`,

      publicId: resultado.public_id,

      assetId: resultado.asset_id,

      version: resultado.version,

      resourceType: resultado.resource_type,

      bytes: resultado.bytes,

      format: resultado.format,

    };

  } catch (erro) {

    console.error('ERRO CLOUDINARY PDF');
    console.error(erro);

    if (fs.existsSync(caminhoArquivo)) {
      fs.unlinkSync(caminhoArquivo);
    }

    throw erro;

  }
};