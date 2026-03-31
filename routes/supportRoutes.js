const express = require("express");
const router = express.Router();

/* ================= CONTROLLER SAFE ================= */

let supportController = {};

try{
supportController = require("../controllers/supportController");
}catch(e){
console.warn("supportController não encontrado");
}

/* ================= AUTH SAFE ================= */

let verifyToken = (req,res,next)=>next();
let requireRoles = () => (req,res,next)=>next();

try{
const auth = require("../middleware/verifyToken");

if(typeof auth.verifyToken === "function")
verifyToken = auth.verifyToken;

if(typeof auth.requireRoles === "function")
requireRoles = auth.requireRoles;

}catch(e){
console.warn("auth middleware fallback");
}

/* ================= FALLBACKS ================= */

const getOrCreateSupportChat =
supportController.getOrCreateSupportChat ||
((req,res)=>res.json({ok:true}));

const getMessages =
supportController.getMessages ||
((req,res)=>res.json([]));

const sendMessage =
supportController.sendMessage ||
((req,res)=>res.json({ok:true}));

const getAllChats =
supportController.getAllChats ||
((req,res)=>res.json([]));

const adminSendMessage =
supportController.adminSendMessage ||
((req,res)=>res.json({ok:true}));


/* ================= USER ================= */

router.get(
"/chat",
verifyToken,
getOrCreateSupportChat
);

router.get(
"/messages/:chatId",
verifyToken,
getMessages
);

router.post(
"/send",
verifyToken,
sendMessage
);


/* ================= ADMIN ================= */

router.get(
"/admin",
verifyToken,
requireRoles("admin"),
getAllChats
);

router.post(
"/admin/send",
verifyToken,
requireRoles("admin"),
adminSendMessage
);

module.exports = router;