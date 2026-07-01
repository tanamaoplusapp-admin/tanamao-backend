/**
 * ============================================================
 * TanaEngine™
 * Base Engine
 * ------------------------------------------------------------
 * Infraestrutura compartilhada entre todos os Engines.
 *
 * Responsabilidades:
 *
 * • Logs padronizados
 * • Tratamento de erros
 * • Tempo de execução
 * • Hooks
 * • Telemetria (futuro)
 * • Auditoria (futuro)
 * • Cache (futuro)
 *
 * Este arquivo NÃO possui regras de negócio.
 * Apenas fornece infraestrutura.
 * ============================================================
 */

function createEngine(engineName) {

  if (!engineName) {
    throw new Error("Engine name is required.");
  }

  function log(level, message, meta = {}) {

    const payload = {
      engine: engineName,
      level,
      timestamp: new Date().toISOString(),
      ...meta,
    };

    console[level](
      `[${engineName}] ${message}`,
      payload
    );

  }

  async function execute(actionName, handler) {

    const startedAt = Date.now();

    try {

      log("info", `${actionName} started`);

      const result = await handler();

      log("info", `${actionName} finished`, {
        duration: Date.now() - startedAt,
      });

      return result;

    } catch (error) {

      log("error", `${actionName} failed`, {
        duration: Date.now() - startedAt,
        error: error.message,
      });

      throw error;

    }

  }

  async function beforeExecute(context = {}) {

    return context;

  }

  async function afterExecute(result) {

    return result;

  }

  return {

    execute,

    beforeExecute,

    afterExecute,

    log,

  };

}

module.exports = {

  createEngine,

};