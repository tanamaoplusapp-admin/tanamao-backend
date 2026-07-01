/**
 * ============================================================
 * SeasonService™
 * ------------------------------------------------------------
 * Sistema oficial de temporadas do Tanamão+.
 *
 * Responsável por:
 *
 * • Temporada atual
 * • Elegibilidade para prêmios
 * • Hall da Fama
 * • Benefícios
 * • Mês grátis
 *
 * ============================================================
 */

const MIN_SCORE = 95;

const MAX_CANCELLATION_RATE = 10;

const REWARDS = Object.freeze({

    MONTH_FREE: "1_mensalidade_gratis",

    FEATURED_PROFILE: "perfil_destaque",

    GOLD_BADGE: "gold_badge",

});

function getCurrentSeason() {

    const today = new Date();

    return {

        year: today.getFullYear(),

        month: today.getMonth() + 1,

        name: today.toLocaleString("pt-BR", {

            month: "long",

            year: "numeric",

        }),

    };

}

function isEligible(profissional = {}) {

    const score = profissional.tanaScore || 0;

    const cancelamentos =
        profissional.tanaModules?.cancellations || 100;

    if (score < MIN_SCORE) {

        return false;

    }

    if (

        cancelamentos <

        (100 - MAX_CANCELLATION_RATE)

    ) {

        return false;

    }

    return true;

}

function getReward(position) {

    switch (position) {

        case 1:

            return {

                title: "1 mês grátis",

                reward: REWARDS.MONTH_FREE,

            };

        case 2:

            return {

                title: "Perfil em destaque",

                reward: REWARDS.FEATURED_PROFILE,

            };

        case 3:

            return {

                title: "Selo Ouro",

                reward: REWARDS.GOLD_BADGE,

            };

        default:

            return null;

    }

}

module.exports = {

    MIN_SCORE,

    MAX_CANCELLATION_RATE,

    REWARDS,

    getCurrentSeason,

    isEligible,

    getReward,

};