const express = require("express");
const router = express.Router();

const auth = require("../middleware/verifyToken");
const verifyToken = auth.verifyToken || auth;

const BugsController = require("../controllers/bugsController");

/* middleware auth */
router.use((req, res, next) => {
  verifyToken(req, res, next);
});

/* routes */

router.get("/", BugsController.list);

router.get("/count", BugsController.countOpen);

router.get("/:id/logs", BugsController.logs);

router.post("/:id/start", BugsController.start);

router.post("/:id/resolve", BugsController.resolve);

router.post("/:id/reopen", BugsController.reopen);

router.get("/:id", BugsController.get);

module.exports = router;