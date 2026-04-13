const SupportChat = require("../models/SupportChat");
const SupportMessage = require("../models/SupportMessage");

// criar ou pegar chat do usuario
exports.getOrCreateSupportChat = async (req, res) => {
  try {
    const userId = req.user._id;

    let chat = await SupportChat.findOne({
      user: userId,
    });

    if (!chat) {
      chat = await SupportChat.create({
        user: userId,
        role: req.user.role,
      });
    }

    res.json(chat);
  } catch (error) {
    console.error("support chat error", error);
    res.status(500).json({ message: "Erro ao abrir suporte" });
  }
};

// mensagens do chat
exports.getMessages = async (req, res) => {
  try {
    const { chatId } = req.params;

    const messages = await SupportMessage.find({
      chat: chatId,
    }).sort({ createdAt: 1 });

    res.json(messages);
  } catch (error) {
    console.error("support messages error", error);
    res.status(500).json({ message: "Erro ao buscar mensagens" });
  }
};

// enviar mensagem usuario
exports.sendMessage = async (req, res) => {
  try {
    const { chatId, text } = req.body;

    if (!chatId || !text?.trim()) {
      return res.status(400).json({ message: "chatId e text são obrigatórios" });
    }

    const message = await SupportMessage.create({
      chat: chatId,
      sender: "user",
      text: text.trim(),
    });

    await SupportChat.findByIdAndUpdate(chatId, {
      lastMessage: text.trim(),
      lastMessageAt: new Date(),
      status: "aberto",
    });

    // tempo real via socket
    if (req.io) {
      req.io.to(String(chatId)).emit("support:new_message", message);
    }

    res.json(message);
  } catch (error) {
    console.error("support send error", error);
    res.status(500).json({ message: "Erro ao enviar mensagem" });
  }
};

// ADMIN responder
exports.adminSendMessage = async (req, res) => {
  try {
    const { chatId, text } = req.body;

    if (!chatId || !text?.trim()) {
      return res.status(400).json({ message: "chatId e text são obrigatórios" });
    }

    const message = await SupportMessage.create({
      chat: chatId,
      sender: "admin",
      text: text.trim(),
    });

    await SupportChat.findByIdAndUpdate(chatId, {
      lastMessage: text.trim(),
      lastMessageAt: new Date(),
      status: "respondido",
    });

    // tempo real via socket
    if (req.io) {
      req.io.to(String(chatId)).emit("support:new_message", message);
    }

    res.json(message);
  } catch (error) {
    console.error("support admin send error", error);
    res.status(500).json({ message: "Erro ao responder" });
  }
};

// ADMIN listar todos chats
exports.getAllChats = async (req, res) => {
  try {
    const chats = await SupportChat.find()
      .populate("user", "nome email telefone role")
      .sort({ lastMessageAt: -1 });

    res.json(chats);
  } catch (error) {
    console.error("support list error", error);
    res.status(500).json({ message: "Erro ao listar suporte" });
  }
};