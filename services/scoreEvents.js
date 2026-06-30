const { updateScore } = require("./scoreService");

/**
 * Serviço concluído
 */
async function onServiceFinished(profissionalId) {
  if (!profissionalId) return null;

  try {
    return await updateScore(profissionalId);
  } catch (error) {
    console.error(
      "[TanaScore] Erro ao atualizar score após conclusão de serviço:",
      error.message
    );
    return null;
  }
}

/**
 * Nova avaliação recebida
 */
async function onReviewCreated(profissionalId) {
  if (!profissionalId) return null;

  try {
    return await updateScore(profissionalId);
  } catch (error) {
    console.error(
      "[TanaScore] Erro ao atualizar score após avaliação:",
      error.message
    );
    return null;
  }
}

/**
 * Perfil atualizado
 */
async function onProfileUpdated(profissionalId) {
  if (!profissionalId) return null;

  try {
    return await updateScore(profissionalId);
  } catch (error) {
    console.error(
      "[TanaScore] Erro ao atualizar score após atualização do perfil:",
      error.message
    );
    return null;
  }
}

/**
 * Documento aprovado
 */
async function onVerificationApproved(profissionalId) {
  if (!profissionalId) return null;

  try {
    return await updateScore(profissionalId);
  } catch (error) {
    console.error(
      "[TanaScore] Erro ao atualizar score após verificação:",
      error.message
    );
    return null;
  }
}

/**
 * Cancelamento de serviço
 */
async function onServiceCancelled(profissionalId) {
  if (!profissionalId) return null;

  try {
    return await updateScore(profissionalId);
  } catch (error) {
    console.error(
      "[TanaScore] Erro ao atualizar score após cancelamento:",
      error.message
    );
    return null;
  }
}

/**
 * Alteração na pontualidade
 */
async function onPunctualityChanged(profissionalId) {
  if (!profissionalId) return null;

  try {
    return await updateScore(profissionalId);
  } catch (error) {
    console.error(
      "[TanaScore] Erro ao atualizar score de pontualidade:",
      error.message
    );
    return null;
  }
}

/**
 * Alteração no tempo de resposta
 */
async function onResponseChanged(profissionalId) {
  if (!profissionalId) return null;

  try {
    return await updateScore(profissionalId);
  } catch (error) {
    console.error(
      "[TanaScore] Erro ao atualizar score de resposta:",
      error.message
    );
    return null;
  }
}

module.exports = {
  onServiceFinished,
  onReviewCreated,
  onProfileUpdated,
  onVerificationApproved,
  onServiceCancelled,
  onPunctualityChanged,
  onResponseChanged,
};