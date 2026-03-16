const express = require('express');
const { User, Vocabulary, Stats, Sequelize } = require('../models');
const { authenticateToken, asyncHandler } = require('../middleware/auth');

const router = express.Router();

router.get('/', authenticateToken, asyncHandler(async (req, res) => {
  const { language } = req.query;
  const where = { UserId: req.user.id };
  if (language) where.language = language;
  
  const vocab = await Vocabulary.findAll({
    where,
    include: [{ model: Stats }]
  });
  res.json(vocab);
}));

router.post('/', authenticateToken, asyncHandler(async (req, res) => {
    const { de, it, typ, emoji, grammatica, isActive, isMarked, language } = req.body;
    const finalLang = language || req.query.language || 'it';
    const vocab = await Vocabulary.create({ de, it, typ, emoji, grammatica, isActive: isActive !== false, isMarked: isMarked === true, language: finalLang, UserId: req.user.id });
    const stats = await Stats.create({ VocabularyId: vocab.id });
    res.status(201).json({ ...vocab.toJSON(), Stat: stats });
}));

router.post('/bulk', authenticateToken, asyncHandler(async (req, res) => {
    const { words, language } = req.body;
    const createdWords = [];
    for (const word of words) {
      const { de, it, typ, emoji, grammatica, isActive, isMarked } = word;
      const vocab = await Vocabulary.create({ 
        de, it, typ, emoji, grammatica, 
        isActive: isActive !== false, 
        isMarked: isMarked === true, 
        language: language || word.language || req.query.language || 'it',
        UserId: req.user.id 
      });
      const stats = await Stats.create({ VocabularyId: vocab.id });
      createdWords.push({ ...vocab.toJSON(), Stat: stats });
    }
    res.status(201).json(createdWords);
}));

router.put('/:id/stats', authenticateToken, asyncHandler(async (req, res) => {
    const { presented, correct, incorrect, streak, lastReviewedDate, nextReviewDate, isActive, isMarked } = req.body;
    const vocab = await Vocabulary.findOne({ where: { id: req.params.id, UserId: req.user.id } });
    if (!vocab) return res.sendStatus(404);
    
    if (isActive !== undefined) {
        vocab.isActive = isActive;
        await vocab.save();
    }
    if (isMarked !== undefined) {
        vocab.isMarked = isMarked;
        await vocab.save();
    }

    await Stats.update(
        { presented, correct, incorrect, streak, lastReviewedDate, nextReviewDate },
        { where: { VocabularyId: vocab.id } }
    );
    res.json({ message: 'Stats and status updated' });
}));

router.delete('/:id', authenticateToken, asyncHandler(async (req, res) => {
    const deleted = await Vocabulary.destroy({ where: { id: req.params.id, UserId: req.user.id } });
    if (deleted) res.json({ message: 'Deleted' });
    else res.sendStatus(404);
}));

router.delete('/clear/all', authenticateToken, asyncHandler(async (req, res) => {
    const { language, typ } = req.query;
    const where = { UserId: req.user.id };
    if (language) where.language = language;
    
    if (typ === 'Satz') {
        where.typ = 'Satz';
    } else if (typ === 'Vocab') {
        where.typ = { [Sequelize.Op.ne]: 'Satz' }; // Everything that is not a sentence
    }

    await Vocabulary.destroy({ where });
    res.json({ message: `Vocabulary cleared${language ? ' for ' + language : ''}` });
}));

router.put('/stats/reset', authenticateToken, asyncHandler(async (req, res) => {
    const user = await User.findByPk(req.user.id);
    if (!user) return res.sendStatus(404);

    // 1. Reset User dailyActivity and set reset timestamp
    user.dailyActivity = {};
    user.lastResetAt = new Date();
    user.changed('dailyActivity', true);
    await user.save();

    // 2. Reset all Stats for this user's vocabulary
    const vocabIds = (await Vocabulary.findAll({
        where: { UserId: req.user.id },
        attributes: ['id']
    })).map(v => v.id);

    if (vocabIds.length > 0) {
        await Stats.update(
            {
                presented: 0,
                correct: 0,
                incorrect: 0,
                streak: 0,
                lastReviewedDate: null,
                nextReviewDate: null
            },
            { where: { VocabularyId: vocabIds } }
        );
    }

    res.json({ message: 'All statistics reset successfully' });
}));

module.exports = router;
