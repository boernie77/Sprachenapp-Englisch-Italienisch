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
  },
  lastLearnAt: {
    type: DataTypes.DATE,
    allowNull: true
  },
  oidcSubject: {
    type: DataTypes.STRING,
    allowNull: true,
    unique: true
  },
  aiPrefs: { type: DataTypes.TEXT, allowNull: true }, // JSON: Einstellungen der automatischen KI-Beispielsätze
  sentenceMode: { type: DataTypes.STRING, defaultValue: 'auto' } // 'auto': KI-Sätze folgen den aktiven Wörtern, 'manual': eigene Auswahl
});

const Vocabulary = sequelize.define('Vocabulary', {
  de: { type: DataTypes.STRING, allowNull: false },
  it: { type: DataTypes.STRING, allowNull: false }, // Will be used for EN as well or treated as 'foreign'
  typ: { type: DataTypes.STRING },
  emoji: { type: DataTypes.STRING },
  grammatica: { type: DataTypes.STRING, allowNull: true },
  isActive: { type: DataTypes.BOOLEAN, defaultValue: true },
  isMarked: { type: DataTypes.BOOLEAN, defaultValue: false },
  isOwn: { type: DataTypes.BOOLEAN, defaultValue: false },
  level: { type: DataTypes.STRING, allowNull: true }, // Niveau eigener Sätze (A1–B2), z.B. von der KI erzeugt
  forWord: { type: DataTypes.STRING, allowNull: true }, // Fremdsprachiges Wort, zu dem die KI diesen Satz erzeugt hat
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
  forWord: { type: DataTypes.STRING, allowNull: true }, // gesetzt bei KI-Sätzen: Fremdwort, zu dem der Satz erzeugt wurde
  language: { type: DataTypes.STRING, defaultValue: 'it' }
});

// Persönliche Auswahl globaler Sätze (nur im manuellen Modus). Ohne Eintrag gilt: Excel-Sätze aktiv, KI-Sätze (forWord) inaktiv.
const SentenceChoice = sequelize.define('SentenceChoice', {
  isActive: { type: DataTypes.BOOLEAN, allowNull: false }
}, {
  indexes: [{ unique: true, fields: ['UserId', 'GrammarSentenceId'] }]
});

// Von der KI geprüfte Verbformen (global, einmal pro Verb). Status: verified, invalid (kein echtes Verb) oder rejected (vom Admin verworfen)
const VerbForm = sequelize.define('VerbForm', {
  language: { type: DataTypes.STRING, allowNull: false },
  infinitive: { type: DataTypes.STRING, allowNull: false },
  forms: { type: DataTypes.TEXT, allowNull: true }, // JSON
  status: { type: DataTypes.STRING, allowNull: false, defaultValue: 'verified' },
  model: { type: DataTypes.STRING, allowNull: true }
}, {
  indexes: [{ unique: true, fields: ['language', 'infinitive'] }]
});

const InviteCode = sequelize.define('InviteCode', {
  code: { type: DataTypes.STRING, allowNull: false, unique: true },
  email: { type: DataTypes.STRING, allowNull: true },
  isUsed: { type: DataTypes.BOOLEAN, defaultValue: false }
});

// App-weite Einstellungen (z.B. KI-Anbieter). Geheime Werte liegen verschlüsselt in `value`.
const Setting = sequelize.define('Setting', {
  key: { type: DataTypes.STRING, allowNull: false, unique: true },
  value: { type: DataTypes.TEXT, allowNull: true }
});

// Zählt erzeugte KI-Sätze pro Nutzer und Tag (für das Tageslimit) sowie Aufrufe, Token und Kosten
const AiUsage = sequelize.define('AiUsage', {
  day: { type: DataTypes.DATEONLY, allowNull: false },
  count: { type: DataTypes.INTEGER, defaultValue: 0 },
  calls: { type: DataTypes.INTEGER, defaultValue: 0 },
  ttsCalls: { type: DataTypes.INTEGER, defaultValue: 0 }, // neue (nicht zwischengespeicherte) Cloudstimmen-Aufrufe für das Tageslimit
  lookups: { type: DataTypes.INTEGER, defaultValue: 0 }, // KI-Wortinfo-Abfragen (Wortart/Geschlecht) für das Tageslimit
  inputTokens: { type: DataTypes.BIGINT, defaultValue: 0 },
  outputTokens: { type: DataTypes.BIGINT, defaultValue: 0 },
  costUsd: { type: DataTypes.DOUBLE, defaultValue: 0 } // nur Modelle mit bekanntem Preis
}, {
  indexes: [{ unique: true, fields: ['UserId', 'day'] }]
});

// Relationships
User.hasMany(Vocabulary);
Vocabulary.belongsTo(User);

Vocabulary.hasOne(Stats);
Stats.belongsTo(Vocabulary);

InviteCode.belongsTo(User, { as: 'usedByUser', foreignKey: 'userId' });
User.hasOne(InviteCode, { foreignKey: 'userId' });

User.hasMany(AiUsage, { onDelete: 'CASCADE' });
User.hasMany(SentenceChoice, { onDelete: 'CASCADE' });
GrammarSentence.hasMany(SentenceChoice, { onDelete: 'CASCADE' });
SentenceChoice.belongsTo(User);
SentenceChoice.belongsTo(GrammarSentence);
AiUsage.belongsTo(User);

module.exports = { sequelize, User, Vocabulary, Stats, BaseVocabulary, GrammarSentence, InviteCode, Setting, AiUsage, SentenceChoice, VerbForm };
