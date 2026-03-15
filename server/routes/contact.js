const express = require('express');
const fs = require('fs');
const multer = require('multer');
const { User } = require('../models');
const { authenticateToken, asyncHandler } = require('../middleware/auth');
const transporter = require('../utils/mailer');

const router = express.Router();
const upload = multer({ dest: 'uploads/' });

router.post('/', authenticateToken, upload.single('attachment'), asyncHandler(async (req, res) => {
    const { message } = req.body;
    const file = req.file;
    const user = await User.findByPk(req.user.id);
    
    if (!user) return res.status(404).json({ error: 'Nutzer nicht gefunden' });
    if (!message || message.trim().length === 0) {
        if (file) fs.unlink(file.path, () => {});
        return res.status(400).json({ error: 'Nachricht darf nicht leer sein' });
    }

    const mailOptions = {
        from: process.env.SMTP_USER || 'noreply@lernapp.local',
        to: 'christian@bernauer24.com',
        subject: `LernApp Kontakt: ${user.name || 'User'} (${user.email})`,
        text: `Nachricht von ${user.name || 'Unbekannt'} (${user.email}):\n\n${message}`
    };

    if (file) {
      mailOptions.attachments = [{ filename: file.originalname, path: file.path }];
    }

    try {
        await transporter.sendMail(mailOptions);
        res.json({ message: 'E-Mail erfolgreich gesendet' });
    } finally {
        if (file) {
            fs.unlink(file.path, (err) => {
                if (err) console.error('Error deleting temp file:', err);
            });
        }
    }
}));

module.exports = router;
