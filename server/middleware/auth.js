const jwt = require('jsonwebtoken');
const { User } = require('../models');

const JWT_SECRET = process.env.JWT_SECRET; // Pflicht, server.js bricht ohne sicheren Wert ab

// Middleware to verify JWT
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) return res.sendStatus(401);

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return res.sendStatus(403);
    req.user = user;
    next();
  });
};

// Login-Token: 30 Tage gültig, wird vom Client per /auth/refresh laufend erneuert
const TOKEN_LIFETIME = '30d';
const signToken = (user) =>
  jwt.sign({ id: user.id, email: user.email, isAdmin: user.isAdmin }, JWT_SECRET, { expiresIn: TOKEN_LIFETIME });

// Middleware to verify Admin
const requireAdmin = async (req, res, next) => {
  try {
    const user = await User.findByPk(req.user.id);
    if (!user || !user.isAdmin) return res.status(403).json({ error: 'Admin access required' });
    next();
  } catch (error) {
    next(error);
  }
};

// Async Handler Wrapper for better DRY error handling
const asyncHandler = fn => (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
};

module.exports = {
    authenticateToken,
    requireAdmin,
    asyncHandler,
    signToken,
    JWT_SECRET
};
