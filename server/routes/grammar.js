const express = require('express');
const { GrammarSentence } = require('../models');
const { authenticateToken, asyncHandler } = require('../middleware/auth');

const router = express.Router();

router.get('/', authenticateToken, asyncHandler(async (req, res) => {
    const { language } = req.query;
    const where = {};
    if (language) where.language = language;
    const sentences = await GrammarSentence.findAll({ where });
    res.json(sentences);
}));

module.exports = router;
