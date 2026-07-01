/**
 * ============================================================
 * TanaEngine™
 * Ranking Engine
 * ------------------------------------------------------------
 * Responsável pelo cálculo de rankings.
 *
 * O Ranking NÃO altera o TanaScore.
 *
 * Ele utiliza:
 *
 * • TanaScore
 * • Atividade
 * • Avaliações
 * • Serviços
 * • Cidade
 * • Categoria
 *
 * Futuro:
 *
 * • Ranking por cidade
 * • Ranking por profissão
 * • Ranking estadual
 * • Ranking nacional
 * • Ranking semanal
 * • Ranking mensal
 * ============================================================
 */

const EVENTS = require("./events");

class RankingEngine {

  constructor() {

    this.version = "1.0.0";

  }

  /**
   * Processa eventos que podem alterar o ranking.
   */
  async process(event, payload = {}) {

    switch (event) {

      case EVENTS.OFFER_CREATED:

      case EVENTS.CHAT_ANSWERED:

      case EVENTS.SERVICE_FINISHED:

      case EVENTS.REVIEW_RECEIVED:

        return this.updateRanking(payload);

      default:

        return null;

    }

  }

  /**
   * Atualiza ranking do profissional.
   */
  async updateRanking(payload) {

    return null;

  }

  /**
   * Ranking por cidade.
   */
  async cityRanking(cityId) {

    return [];

  }

  /**
   * Ranking por profissão.
   */
  async professionRanking(professionId) {

    return [];

  }

  /**
   * Ranking geral.
   */
  async globalRanking() {

    return [];

  }

}

module.exports = new RankingEngine();