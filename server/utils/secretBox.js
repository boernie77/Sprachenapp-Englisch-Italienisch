// Verschlüsselt geheime Einstellungen (z.B. KI-API-Schlüssel) für die Ablage in der Datenbank.
// AES-256-GCM, Schlüssel per HKDF aus JWT_SECRET abgeleitet. Wird JWT_SECRET geändert,
// lassen sich gespeicherte Werte nicht mehr entschlüsseln und müssen neu eingetragen werden.
const crypto = require('crypto');

const ALGO = 'aes-256-gcm';
const VERSION = 'v1';

const deriveKey = () => {
    const secret = process.env.JWT_SECRET;
    if (!secret) throw new Error('JWT_SECRET fehlt');
    return Buffer.from(crypto.hkdfSync('sha256', secret, 'lernapp-settings', 'secret-box-v1', 32));
};

const encrypt = (plainText) => {
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv(ALGO, deriveKey(), iv);
    const data = Buffer.concat([cipher.update(String(plainText), 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();
    return [VERSION, iv.toString('base64'), tag.toString('base64'), data.toString('base64')].join(':');
};

// Liefert null, wenn der Wert nicht (mehr) entschlüsselt werden kann
const decrypt = (stored) => {
    if (!stored) return null;
    try {
        const [version, iv, tag, data] = stored.split(':');
        if (version !== VERSION) return null;
        const decipher = crypto.createDecipheriv(ALGO, deriveKey(), Buffer.from(iv, 'base64'));
        decipher.setAuthTag(Buffer.from(tag, 'base64'));
        return Buffer.concat([decipher.update(Buffer.from(data, 'base64')), decipher.final()]).toString('utf8');
    } catch (err) {
        return null;
    }
};

module.exports = { encrypt, decrypt };
