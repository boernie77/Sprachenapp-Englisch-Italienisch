const { Sequelize, DataTypes } = require('sequelize');
const bcrypt = require('bcryptjs');

const sequelize = new Sequelize(process.env.DATABASE_URL || 'postgres://user:pass@db:5432/italian_app', {
  dialect: 'postgres',
  logging: false,
});

const User = sequelize.define('User', {
  email: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true,
    validate: { isEmail: true }
  },
  name: {
    type: DataTypes.STRING,
    allowNull: true
  },
  password: {
    type: DataTypes.STRING,
    allowNull: false
  },
  isAdmin: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  lastLogin: {
    type: DataTypes.DATE,
    allowNull: true
  },
  loginCount: {
    type: DataTypes.INTEGER,
    defaultValue: 0
  },
  isActive: {
    type: DataTypes.BOOLEAN,
    defaultValue: true
  },
  resetToken: {
    type: DataTypes.STRING,
    allowNull: true
  },
  resetTokenExpires: {
    type: DataTypes.DATE,
    allowNull: true
  },
  dailyActivity: {
    type: DataTypes.JSON,
    defaultValue: {}
  },
  lastResetAt: {
    type: DataTypes.DATE,
    allowNull: true
  },
  selectedLanguage: {
    type: DataTypes.STRING,
    defaultValue: 'it'
  }
});

const Vocabulary = sequelize.define('Vocabulary', {
  de: { type: DataTypes.STRING, allowNull: false },
  it: { type: DataTypes.STRING, allowNull: false }, // Will be used for EN as well or treated as 'foreign'
  typ: { type: DataTypes.STRING },
  emoji: { type: DataTypes.STRING },
  grammatica: { type: DataTypes.STRING, allowNull: true },
  isActive: { type: DataTypes.BOOLEAN, defaultValue: true },
  isMarked: { type: DataTypes.BOOLEAN, defaultValue: false },
  language: { type: DataTypes.STRING, defaultValue: 'it' }
});

const Stats = sequelize.define('Stats', {
  presented: { type: DataTypes.INTEGER, defaultValue: 0 },
  correct: { type: DataTypes.INTEGER, defaultValue: 0 },
  incorrect: { type: DataTypes.INTEGER, defaultValue: 0 },
  streak: { type: DataTypes.INTEGER, defaultValue: 0 },
  lastReviewedDate: { type: DataTypes.DATE },
  nextReviewDate: { type: DataTypes.DATE }
});

const BaseVocabulary = sequelize.define('BaseVocabulary', {
  de: { type: DataTypes.STRING, allowNull: false },
  it: { type: DataTypes.STRING, allowNull: false },
  typ: { type: DataTypes.STRING },
  emoji: { type: DataTypes.STRING },
  grammatica: { type: DataTypes.STRING, allowNull: true },
  language: { type: DataTypes.STRING, defaultValue: 'it' }
});

const GrammarSentence = sequelize.define('GrammarSentence', {
  it: { type: DataTypes.STRING, allowNull: false },
  de: { type: DataTypes.STRING, allowNull: false },
  category: { type: DataTypes.STRING, allowNull: true },
  level: { type: DataTypes.STRING, allowNull: true },
  language: { type: DataTypes.STRING, defaultValue: 'it' }
});

const InviteCode = sequelize.define('InviteCode', {
  code: { type: DataTypes.STRING, allowNull: false, unique: true },
  email: { type: DataTypes.STRING, allowNull: true },
  isUsed: { type: DataTypes.BOOLEAN, defaultValue: false }
});

// Relationships
User.hasMany(Vocabulary);
Vocabulary.belongsTo(User);

Vocabulary.hasOne(Stats);
Stats.belongsTo(Vocabulary);

InviteCode.belongsTo(User, { as: 'usedByUser', foreignKey: 'userId' });
User.hasOne(InviteCode, { foreignKey: 'userId' });

module.exports = { sequelize, User, Vocabulary, Stats, BaseVocabulary, GrammarSentence, InviteCode };
