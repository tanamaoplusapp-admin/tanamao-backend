// routes/publicRoutes.js
const express = require('express');
const router = express.Router();
const { getPublicUserProfile } = require('../controllers/publicProfileController');

router.get('/users/:id', getPublicUserProfile);

module.exports = router;
