// Löscht einen Nutzer samt aller seiner Daten (Vokabeln, Sätze, Statistik, Auswahl, KI-Verbrauch).
// Globale Sätze, die durch die KI zu seinen Wörtern entstanden sind, bleiben erhalten (sie enthalten keine personenbezogenen Daten).
const { sequelize, User, Vocabulary, Stats, SentenceChoice, AiUsage, InviteCode } = require('../models');

async function deleteUserCompletely(userId) {
    await sequelize.transaction(async (transaction) => {
        const ids = (await Vocabulary.findAll({ where: { UserId: userId }, attributes: ['id'], raw: true, transaction })).map(v => v.id);
        if (ids.length > 0) {
            await Stats.destroy({ where: { VocabularyId: ids }, transaction });
            await Vocabulary.destroy({ where: { UserId: userId }, transaction });
        }
        await SentenceChoice.destroy({ where: { UserId: userId }, transaction });
        await AiUsage.destroy({ where: { UserId: userId }, transaction });
        await InviteCode.update({ userId: null }, { where: { userId }, transaction });
        await User.destroy({ where: { id: userId }, transaction });
    });
}

module.exports = { deleteUserCompletely };
