const express = require('express');
const { BaseVocabulary } = require('../models');
const { authenticateToken, asyncHandler } = require('../middleware/auth');

const router = express.Router();

router.get('/', authenticateToken, asyncHandler(async (req, res) => {
    const { language } = req.query;
    const where = {};
    if (language) where.language = language;
    const baseVocab = await BaseVocabulary.findAll({ where });
    res.json(baseVocab);
}));

module.exports = router;
