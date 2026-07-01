/**
 * ============================================================
 * TanaEngine™
 * Event Bus
 * ------------------------------------------------------------
 * Responsável por distribuir eventos para todos os Engines.
 *
 * Fluxo:
 *
 * Controller
 *      ↓
 * EventBus
 *      ↓
 * ActivityEngine
 * MissionEngine
 * AchievementEngine
 * RankingEngine
 * MatchEngine
 *
 * Um Engine nunca conhece o outro.
 * Todos recebem eventos apenas pelo EventBus.
 * ============================================================
 */

class EventBus {

  constructor() {

    /**
     * Estrutura:
     *
     * Map<
     *    EVENT_NAME,
     *    [
     *       { priority, handler }
     *    ]
     * >
     */
    this.listeners = new Map();

  }

  /**
   * ============================================================
   * Registrar Listener
   * ============================================================
   */

  on(event, handler, priority = 100) {

    if (!event) {
      throw new Error("Event is required.");
    }

    if (typeof handler !== "function") {
      throw new Error("Handler must be a function.");
    }

    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }

    const handlers = this.listeners.get(event);

    handlers.push({
      priority,
      handler,
    });

    handlers.sort(
      (a, b) => a.priority - b.priority
    );

  }

  /**
   * ============================================================
   * Disparar Evento
   * ============================================================
   */

  async dispatch(event, payload = {}) {

    const handlers =
      this.listeners.get(event) || [];

    if (!handlers.length) {
      return;
    }

    for (const listener of handlers) {

      try {

        await listener.handler(payload);

      } catch (error) {

        console.error(
          `[EventBus] ${event}`,
          error.message
        );

      }

    }

  }

  /**
   * ============================================================
   * Remover Listener
   * ============================================================
   */

  off(event, handler) {

    const handlers =
      this.listeners.get(event);

    if (!handlers) {
      return;
    }

    this.listeners.set(
      event,
      handlers.filter(
        (h) => h.handler !== handler
      )
    );

  }

  /**
   * ============================================================
   * Limpar tudo
   * ============================================================
   */

  clear() {

    this.listeners.clear();

  }

}

/**
 * Singleton
 */

module.exports = new EventBus();