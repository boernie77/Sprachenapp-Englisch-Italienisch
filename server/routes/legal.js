const express = require('express');
const fs = require('fs');
const path = require('path');

const router = express.Router();

// Impressum und Datenschutzerklärung des Betreibers: Dateien impressum.html / datenschutz.html im Ordner LEGAL_DIR
// (Standard: legal/ im Projektordner). Öffentlich lesbar, damit sie schon vor der Anmeldung angezeigt werden können.
const legalDir = () => process.env.LEGAL_DIR || path.join(__dirname, '..', '..', 'legal');
const readLegalFile = (name) => {
    try {
        const text = fs.readFileSync(path.join(legalDir(), name), 'utf8');
        return text.length > 0 && text.length <= 200000 ? text : null;
    } catch (err) {
        return null;
    }
};

router.get('/', (req, res) => {
    res.json({ impressum: readLegalFile('impressum.html'), privacy: readLegalFile('datenschutz.html') });
});

module.exports = router;
