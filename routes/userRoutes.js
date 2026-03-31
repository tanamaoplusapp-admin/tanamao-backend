const express = require('express');
const router = express.Router();

const { verifyToken, requireRoles } = require('../middleware/verifyToken');

const {
  getMe,
  updateMe,
  updateUserAvailability,
  savePushToken
} = require('../controllers/userController');

const User = require('../models/user');

/* =====================================================
LISTAR USUÁRIOS (ADMIN)
===================================================== */

router.get(
  '/',
  verifyToken,
  requireRoles('admin'),
  async (req,res)=>{

    const users = await User.find()
      .select('-password')
      .sort({ createdAt:-1 });

    res.json({
      items: users
    });

  }
);

/* =====================================================
PERFIL
===================================================== */

router.get('/profile', verifyToken, getMe);
router.put('/profile', verifyToken, updateMe);

router.get('/me', verifyToken, getMe);
router.put('/me', verifyToken, updateMe);

/* =====================================================
STATUS ONLINE
===================================================== */

router.patch('/availability', verifyToken, updateUserAvailability);
router.put('/status', verifyToken, updateUserAvailability);

/* =====================================================
PUSH TOKEN
===================================================== */

router.post('/push-token', verifyToken, savePushToken);

module.exports = router;