/**
 * ============================================================
 * TanaEngine™
 * Achievement Engine
 * ------------------------------------------------------------
 * Responsável por verificar e conceder conquistas.
 *
 * Não calcula TanaScore.
 * Não calcula Ranking.
 * Não calcula Match.
 *
 * Apenas verifica se o profissional desbloqueou
 * uma nova conquista.
 *
 * Futuro:
 *
 * • Medalhas
 * • Selos
 * • Certificados
 * • Recompensas
 * ============================================================
 */

const EVENTS = require("./events");

class AchievementEngine {

  constructor() {

    this.version = "1.0.0";

  }

  /**
   * Verifica conquistas relacionadas ao evento.
   */
  async process(event, payload = {}) {

    switch (event) {

      case EVENTS.OFFER_CREATED:

        return this.checkOfferAchievements(payload);

      case EVENTS.CHAT_ANSWERED:

        return this.checkChatAchievements(payload);

      case EVENTS.SERVICE_FINISHED:

        return this.checkServiceAchievements(payload);

      default:

        return null;

    }

  }

  async checkOfferAchievements(payload) {

    return [];

  }

  async checkChatAchievements(payload) {

    return [];

  }

  async checkServiceAchievements(payload) {

    return [];

  }

}

module.exports = new AchievementEngine();