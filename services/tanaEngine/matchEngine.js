/**
 * ============================================================
 * TanaEngine™
 * Match Engine
 * ------------------------------------------------------------
 * Algoritmo proprietário do Tanamão+.
 *
 * Responsável por calcular qual profissional
 * possui maior compatibilidade com cada cliente.
 *
 * O Match NÃO utiliza apenas o TanaScore.
 *
 * Ele considera:
 *
 * • Distância
 * • Cidade
 * • Categoria
 * • Profissão
 * • Disponibilidade
 * • Tempo de resposta
 * • Avaliações
 * • Atividade
 * • Cancelamentos
 * • Histórico do cliente
 * • Afinidade futura (IA)
 *
 * ============================================================
 */

const EVENTS = require("./events");

class MatchEngine {

  constructor() {

    this.version = "1.0.0";

  }

  /**
   * Processa eventos relevantes ao algoritmo.
   */
  async process(event, payload = {}) {

    switch (event) {

      case EVENTS.SERVICE_FINISHED:

      case EVENTS.REVIEW_RECEIVED:

      case EVENTS.MATCH_COMPLETED:

        return this.refresh(payload);

      default:

        return null;

    }

  }

  /**
   * Recalcula informações de Match.
   */
  async refresh(payload) {

    return null;

  }

  /**
   * Calcula o MatchScore entre
   * cliente e profissional.
   */
  async calculate(cliente, profissional) {

    return {

      score: 0,

      reasons: [],

    };

  }

  /**
   * Ordena profissionais.
   */
  async rank(profissionais, cliente) {

    return profissionais;

  }

}

module.exports = new MatchEngine();