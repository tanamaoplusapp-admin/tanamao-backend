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

        public_id: numeroOrcamento,

        overwrite: true,

      }
    );

    if (fs.existsSync(caminhoArquivo)) {
      fs.unlinkSync(caminhoArquivo);
    }

    return {

      url: resultado.secure_url,

      publicId: resultado.public_id,

      bytes: resultado.bytes,

      format: resultado.format,

    };

  } catch (erro) {

    if (fs.existsSync(caminhoArquivo)) {
      fs.unlinkSync(caminhoArquivo);
    }

    throw erro;

  }

};