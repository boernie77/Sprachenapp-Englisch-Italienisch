// Gesprächsmodus auf dem Server (Phase 4). Nur aktiv, wenn der Betreiber CHAT_ENABLED=true setzt UND der Nutzer freigegeben ist.
// Der API-Schlüssel bleibt auf dem Server; die App ruft mit ihrer Anmeldung auf.
const express = require('express');
const { User, Chat } = require('../models');
const { authenticateToken, asyncHandler } = require('../middleware/auth');
const ai = require('../utils/ai');
const { remainingChat, addChatUsage } = require('../utils/ai/usage');
const { serverEnabled, userMayChat } = require('../utils/chatAccess');
const core = require('../public/ai-core');

const router = express.Router();
const CHAT_ID = /^[A-Za-z0-9_-]{8,64}$/;
const CHAT_MAX_BYTES = 400000;
const LANGS = ['it', 'en', 'es'];

// Zugang prüfen: ohne Schalter oder Freigabe wirkt die Route wie nicht vorhanden (404), nie 403 (das Frontend meldet bei 403 ab)
const requireChat = asyncHandler(async (req, res, next) => {
    const user = await User.findByPk(req.user.id);
    if (!user) return res.sendStatus(401);
    if (!userMayChat(user)) return res.status(404).json({ error: 'Der Gesprächsmodus ist auf diesem Server nicht freigegeben' });
    req.chatUser = user;
    next();
});

// Frontend fragt beim Öffnen des Reiters: ist das Gespräch hier nutzbar?
router.get('/ai/chat-status', authenticateToken, asyncHandler(async (req, res) => {
    const user = await User.findByPk(req.user.id);
    if (!user) return res.sendStatus(401);
    const config = await ai.loadConfig();
    const allowed = userMayChat(user);
    const ready = config.enabled && !!ai.getApiKey(config, config.provider);
    res.json({ available: allowed && ready, serverEnabled: serverEnabled(), allowed, ready: allowed ? ready : undefined });
}));

router.post('/ai/chat', authenticateToken, requireChat, asyncHandler(async (req, res) => {
    const { language } = req.body;
    if (!core.isSupportedLanguage(language)) return res.status(400).json({ error: 'Sprache nicht unterstützt' });
    const level = core.LEVELS.includes(req.body.level) ? req.body.level : 'A2';
    const topic = typeof req.body.topic === 'string' ? req.body.topic.trim().slice(0, core.CHAT_MAX_TOPIC) : '';
    const practiceWords = (Array.isArray(req.body.practiceWords) ? req.body.practiceWords : [])
        .filter(w => typeof w === 'string' && w.trim() && w.length <= 60).map(w => w.trim()).slice(0, core.CHAT_MAX_PRACTICE);
    const messages = core.normalizeChatMessages(req.body.messages);
    if (messages.length === 0 || messages[messages.length - 1].role !== 'user') return res.status(400).json({ error: 'Bitte eine Nachricht schreiben' });

    const config = await ai.loadConfig();
    const remaining = await remainingChat(req.chatUser, config.chatLimit);
    if (remaining !== null && remaining < 1) return res.status(429).json({ error: 'Tageslimit für Gespräche erreicht', remaining: 0 });

    const { result, usage } = await ai.chat({ language, level, topic, practiceWords, messages });
    await addChatUsage(req.chatUser.id, usage); // auch Admins: Verbrauch und Kosten werden immer gezählt
    res.json({ ...result, remaining: remaining === null ? null : remaining - 1 });
}));

// ---- gespeicherte Gespräche (je Nutzer) ----
const summary = (c) => ({ id: c.id, language: c.language, level: c.level, topic: c.topic || '', title: c.title || '', createdAt: c.createdAt, updatedAt: c.updatedAt, messageCount: c.messageCount });
const full = (c) => { let messages = []; try { messages = JSON.parse(c.messages); } catch (e) { messages = []; } return { ...summary(c), messages }; };

router.get('/chats', authenticateToken, requireChat, asyncHandler(async (req, res) => {
    const where = { UserId: req.user.id };
    if (req.query.language) where.language = req.query.language;
    const list = await Chat.findAll({ where, order: [['updatedAt', 'DESC']], attributes: { exclude: ['messages'] } });
    res.json(list.map(summary));
}));

router.delete('/chats/clear/all', authenticateToken, requireChat, asyncHandler(async (req, res) => {
    const where = { UserId: req.user.id };
    if (req.query.language) where.language = req.query.language;
    const count = await Chat.destroy({ where });
    res.json({ message: 'Cleared', count });
}));

router.get('/chats/:id', authenticateToken, requireChat, asyncHandler(async (req, res) => {
    const c = await Chat.findOne({ where: { id: req.params.id, UserId: req.user.id } });
    if (!c) return res.sendStatus(404);
    res.json(full(c));
}));

router.put('/chats/:id', authenticateToken, requireChat, asyncHandler(async (req, res) => {
    const id = req.params.id, b = req.body || {};
    if (!CHAT_ID.test(id)) return res.status(400).json({ error: 'Ungültige Gesprächs-ID' });
    if (!LANGS.includes(b.language)) return res.status(400).json({ error: 'Sprache nicht unterstützt' });
    if (!Array.isArray(b.messages) || b.messages.length > 500) return res.status(400).json({ error: 'Ungültiger Verlauf' });
    const messages = b.messages.filter(m => m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string');
    const json = JSON.stringify(messages);
    if (json.length > CHAT_MAX_BYTES) return res.status(413).json({ error: 'Gespräch zu groß' });
    const fields = {
        language: b.language, level: core.LEVELS.includes(b.level) ? b.level : 'A2',
        topic: String(b.topic || '').slice(0, 80), title: String(b.title || '').slice(0, 120),
        messages: json, messageCount: messages.length
    };
    let c = await Chat.findByPk(id);
    if (c && c.UserId !== req.user.id) return res.status(409).json({ error: 'Gesprächs-ID bereits vergeben' }); // fremde ID nie überschreiben
    if (c) await c.update(fields); else c = await Chat.create({ id, UserId: req.user.id, ...fields });
    res.json(summary(c));
}));

router.delete('/chats/:id', authenticateToken, requireChat, asyncHandler(async (req, res) => {
    await Chat.destroy({ where: { id: req.params.id, UserId: req.user.id } });
    res.json({ message: 'Deleted' });
}));

module.exports = router;
