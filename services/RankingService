/**
 * ============================================================
 * RankingService™
 * ------------------------------------------------------------
 * Responsável por calcular posições no ranking.
 *
 * O Ranking é sempre calculado usando o SearchScore™.
 *
 * Nunca salva posição em banco.
 *
 * ============================================================
 */

const Profissional = require("../models/Profissional");

const {
    calculateSearchScore,
} = require("./searchScoreService");

/* ============================================================
   RANKING DA CIDADE
============================================================ */

async function getCityRanking(profissional) {

    if (!profissional) {

        return null;

    }

    const cidade = profissional.endereco?.cidade;

    if (!cidade) {

        return null;

    }

    const profissionais = await Profissional.find({

        "endereco.cidade": cidade,

    }).lean();

    const ranking = profissionais

        .map((item) => ({

            _id: item._id,

            nome: item.nome,

            cidade,

            searchScore: calculateSearchScore(item),

        }))

        .sort(

            (a, b) =>

                b.searchScore - a.searchScore

        );

    const position =

        ranking.findIndex(

            (p) =>

                String(p._id) === String(profissional._id)

        ) + 1;

    return {

        city: cidade,

        total: ranking.length,

        position,

        leaders: ranking.slice(0, 10),

    };

}

/* ============================================================
   RANKING POR PROFISSÃO
============================================================ */

async function getProfessionRanking(

    profissional

) {

    if (

        !profissional ||

        !profissional.profissoes ||

        !profissional.profissoes.length

    ) {

        return null;

    }

    const profissao =

        profissional.profissoes[0];

    const profissionais = await Profissional.find({

        profissoes: profissao,

    }).lean();

    const ranking = profissionais

        .map((item) => ({

            _id: item._id,

            nome: item.nome,

            searchScore: calculateSearchScore(item),

        }))

        .sort(

            (a, b) =>

                b.searchScore - a.searchScore

        );

    const position =

        ranking.findIndex(

            (p) =>

                String(p._id) === String(profissional._id)

        ) + 1;

    return {

        profession: profissao,

        total: ranking.length,

        position,

        leaders: ranking.slice(0, 10),

    };

}

/* ============================================================
   DISTÂNCIA PARA O PRIMEIRO
============================================================ */

function distanceToLeader(

    ranking,

    myScore

) {

    if (

        !ranking ||

        !ranking.leaders ||

        !ranking.leaders.length

    ) {

        return 0;

    }

    return Math.max(

        ranking.leaders[0].searchScore -

        myScore,

        0

    );

}

module.exports = {

    getCityRanking,

    getProfessionRanking,

    distanceToLeader,

};