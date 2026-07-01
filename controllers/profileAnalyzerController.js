/**
 * ============================================================
 * TanaProfile™
 * Profile Analyzer Controller
 * ------------------------------------------------------------
 * Controller responsável por expor o Motor de Análise
 * através da API.
 * ============================================================
 */

const profileAnalyzerService = require(
  "../services/profileAnalyzerService"
);

/* ============================================================
   HELPERS
============================================================ */

function getUserId(req) {

  const user = req.user || {};

  return (
    user._id ||
    user.id ||
    user.userId ||
    user.sub ||
    null
  );

}

/* ============================================================
   ANÁLISE DO PERFIL LOGADO
============================================================ */

exports.getMyProfileAnalysis = async (req, res) => {

  try {

    const userId = getUserId(req);

    if (!userId) {

      return res.status(401).json({

        success: false,

        message: "Usuário não autenticado."

      });

    }

    const analysis =
      await profileAnalyzerService.analyzeMyProfile(
        userId
      );

    return res.status(200).json({

      success: true,

      data: analysis

    });

  } catch (error) {

    console.error(
      "[TanaProfile] getMyProfileAnalysis:",
      error
    );

    return res.status(500).json({

      success: false,

      message: error.message

    });

  }

};
/* ============================================================
   RESUMO RÁPIDO
============================================================ */

exports.getQuickSummary = async (req, res) => {

  try {

    const userId = getUserId(req);

    if (!userId) {

      return res.status(401).json({
        success: false,
        message: "Usuário não autenticado."
      });

    }

    const summary =
      await profileAnalyzerService.getQuickSummary(
        userId
      );

    return res.status(200).json({

      success: true,

      data: summary

    });

  } catch (error) {

    console.error(
      "[TanaProfile] getQuickSummary:",
      error
    );

    return res.status(500).json({

      success: false,

      message: error.message

    });

  }

};

/* ============================================================
   ANÁLISE DE UM PROFISSIONAL
   (ADMIN / FUTURO RANKING)
============================================================ */

exports.getProfessionalAnalysis = async (req, res) => {

  try {

    const { profissionalId } = req.params;

    if (!profissionalId) {

      return res.status(400).json({

        success: false,

        message: "Profissional não informado."

      });

    }

    const analysis =
      await profileAnalyzerService.analyzeProfile(
        profissionalId
      );

    return res.status(200).json({

      success: true,

      data: analysis

    });

  } catch (error) {

    console.error(
      "[TanaProfile] getProfessionalAnalysis:",
      error
    );

    return res.status(500).json({

      success: false,

      message: error.message

    });

  }

};

/* ============================================================
   REANALISAR PERFIL
============================================================ */

exports.refreshAnalysis = async (req, res) => {

  try {

    const { profissionalId } = req.params;

    const analysis =
      await profileAnalyzerService.refreshProfileAnalysis(
        profissionalId
      );

    return res.status(200).json({

      success: true,

      message: "Análise atualizada com sucesso.",

      data: analysis

    });

  } catch (error) {

    console.error(
      "[TanaProfile] refreshAnalysis:",
      error
    );

    return res.status(500).json({

      success: false,

      message: error.message

    });

  }

};