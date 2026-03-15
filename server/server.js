const express = require('express');
const cors = require('cors');
const path = require('path');
const { sequelize } = require('./models');

// Import routes
const authRoutes = require('./routes/auth');
const vocabRoutes = require('./routes/vocab');
const contactRoutes = require('./routes/contact');
const adminRoutes = require('./routes/admin');
const grammarRoutes = require('./routes/grammar');
const baseVocabRoutes = require('./routes/baseVocab');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// Health Check
app.get('/api/health', (req, res) => res.json({ status: 'ok', version: '2.0.2', timestamp: new Date() }));

// Mount routes
app.use('/api/auth', authRoutes);
app.use('/api/vocab', vocabRoutes);
app.use('/api/contact', contactRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/grammar-sentences', grammarRoutes);
app.use('/api/base-vocab', baseVocabRoutes);

// Serve frontend
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public/index.html'));
});

// Central Error Handling Middleware
app.use((err, req, res, next) => {
    console.error('Server Error:', err);
    const status = err.status || 500;
    res.status(status).json({ 
        error: err.message || 'Interner Serverfehler'
    });
});

// Database Sync and Listen
sequelize.sync({ alter: true }).then(() => {
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on port ${PORT}`);
  });
}).catch(err => {
  console.error('Database Sync Error:', err);
});
