const Profissional = require("../models/Profissional");

/**
 * ==========================================================
 * RankingService
 * TanaCore™
 *
 * Responsável pelos rankings do Tanamão+.
 *
 * Atualmente:
 *  • Ranking por cidade
 *  • Ranking por profissão
 *
 * Futuramente:
 *  • Ranking estadual
 *  • Ranking nacional
 *  • Ranking por temporada
 *  • Ranking por categoria
 * ==========================================================
 */

async function getCityRanking(profissional) {

    if (!profissional) {

        return null;

    }

    const cidade = profissional?.endereco?.cidade;

    if (!cidade) {

        return null;

    }

   const ranking = await Profissional.find({

    "endereco.cidade": cidade,

})
        .select(
            "name tanaScore searchScore endereco"
        )
        .sort({

            tanaScore: -1,

            searchScore: -1,

            createdAt: 1,

        });

    const total = ranking.length;

    if (!total) {

        return null;

    }

    const index = ranking.findIndex(

        p => String(p._id) === String(profissional._id)

    );

    if (index === -1) {

        return null;

    }

    const leader = ranking[0];

    return {

        city: cidade,

        position: index + 1,

        total,

        percentile:
            Math.round(
                ((total - index) / total) * 100
            ),

        leaderScore: leader?.tanaScore || 0,

        myScore: profissional.tanaScore || 0,

        distanceLeader:
            Math.max(
                0,
                (leader?.tanaScore || 0) -
                (profissional.tanaScore || 0)
            ),

    };

}

async function getProfessionRanking(profissional) {

    if (!profissional) {

        return null;

    }

    const profissao =
        profissional.profissaoNome;

    if (!profissao) {

        return null;

    }

    const ranking = await Profissional.find({

    profissaoNome: profissao,

})
        .select(
            "name tanaScore searchScore profissaoNome"
        )
        .sort({

            tanaScore: -1,

            searchScore: -1,

            createdAt: 1,

        });

    const total = ranking.length;

    if (!total) {

        return null;

    }

    const index = ranking.findIndex(

        p => String(p._id) === String(profissional._id)

    );

    if (index === -1) {

        return null;

    }

    return {

        profession: profissao,

        position: index + 1,

        total,

        percentile:
            Math.round(
                ((total - index) / total) * 100
            ),

    };

}

async function getLeaderboard(cidade, limit = 10) {

    return Profissional.find({

        "endereco.cidade": cidade,

        aprovado: true,

    })
        .select(
            "name photoUrl tanaScore searchScore tanaLevel"
        )
        .sort({

            tanaScore: -1,

            searchScore: -1,

            createdAt: 1,

        })
        .limit(limit);

}

async function getDistanceToLeader(profissional) {

    const ranking =
        await getCityRanking(profissional);

    if (!ranking) {

        return 0;

    }

    return ranking.distanceLeader;

}

module.exports = {

    getCityRanking,

    getProfessionRanking,

    getLeaderboard,

    getDistanceToLeader,

};