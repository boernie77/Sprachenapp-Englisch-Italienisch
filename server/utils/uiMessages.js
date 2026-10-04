// Meldungen der API in der Sprache der App-Oberfläche.
// Die Routen schreiben ihre Texte auf Deutsch; die App schickt bei jeder Anfrage `X-UI-Lang: en|de`.
// Bei „en“ ersetzt die Middleware die Felder `error` und `message` einer JSON-Antwort durch die englische
// Fassung (exakte Treffer in MESSAGES_EN, Meldungen mit Zahlen in PATTERNS_EN). Unbekannte Texte bleiben unverändert.
const MESSAGES_EN = {
    'Einladungscode erforderlich': 'Invitation code required',
    'Ungültiger oder bereits verwendeter Einladungscode': 'Invalid or already used invitation code',
    'Dein Konto wurde deaktiviert.': 'Your account has been deactivated.',
    'Falls ein Konto existiert, wurde eine E-Mail gesendet.': 'If an account exists, an email has been sent.',
    'E-Mail konnte nicht versendet werden. SMTP nicht konfiguriert?': 'The email could not be sent. SMTP not configured?',
    'Du bist der einzige Admin. Ernenne zuerst einen weiteren Admin, bevor du dein Konto löschst.': 'You are the only admin. Appoint another admin before deleting your account.',
    'Die E-Mail-Adresse stimmt nicht.': 'The email address does not match.',
    'Das Passwort stimmt nicht.': 'The password is incorrect.',
    'Ungültige Eingabe oder Passwort zu kurz (min. 6 Zeichen)': 'Invalid input or password too short (min. 6 characters)',
    'Der Link ist ungültig oder abgelaufen.': 'The link is invalid or has expired.',
    'Passwort erfolgreich geändert. Du kannst dich nun einloggen.': 'Password changed successfully. You can now log in.',
    'Ungültiger Name (1-100 Zeichen erforderlich)': 'Invalid name (1-100 characters required)',
    'Ungültiger Modus': 'Invalid mode',
    'Ungültige Satzliste': 'Invalid sentence list',
    'Nutzer nicht gefunden': 'User not found',
    'Nachricht darf nicht leer sein': 'The message must not be empty',
    'Das Kontaktformular ist auf diesem Server nicht eingerichtet': 'The contact form is not set up on this server',
    'E-Mail erfolgreich gesendet': 'Email sent successfully',
    'Sprache nicht unterstützt': 'Language not supported',
    'Ungültige Einstellung': 'Invalid setting',
    'Bitte mindestens ein Niveau wählen': 'Please choose at least one level',
    'Bitte mindestens eine Grammatikart wählen': 'Please choose at least one grammar type',
    'Bitte zuerst Grammatikarten wählen und speichern': 'Please choose and save grammar types first',
    'Ungültiges Wort': 'Invalid word',
    'Übersetzung zu lang': 'Translation too long',
    'Tageslimit für KI-Wortinfo erreicht': 'Daily limit for AI word info reached',
    'Tageslimit für KI-Sätze erreicht': 'Daily limit for AI sentences reached',
    'Bitte ein Wort angeben (max. 100 Zeichen)': 'Please enter a word (max. 100 characters)',
    "Sicherheits-Abbruch: Parameter 'isOwn' (true/false) fehlt zwingend!": "Safety abort: parameter 'isOwn' (true/false) is required!",
    "Sicherheits-Abbruch: Parameter 'isOwn' muss 'true' oder 'false' sein.": "Safety abort: parameter 'isOwn' must be 'true' or 'false'.",
    'Code nicht gefunden oder bereits verwendet': 'Code not found or already used',
    'Einladung erfolgreich gesendet': 'Invitation sent successfully',
    'Code kann nicht gelöscht werden (existiert nicht oder bereits verwendet)': 'The code cannot be deleted (does not exist or already used)',
    'Code gelöscht': 'Code deleted',
    'Kann eigenen Account nicht sperren': 'You cannot block your own account',
    'Mindestens ein Admin muss vorhanden sein': 'At least one admin must remain',
    'Admin-Status aktualisiert': 'Admin status updated',
    'Name aktualisiert': 'Name updated',
    'Ungültiger Modellname': 'Invalid model name',
    'Tageslimit muss zwischen 0 und 1000 liegen': 'The daily limit must be between 0 and 1000',
    'Limit für Wortinfo muss zwischen 0 und 5000 liegen': 'The word info limit must be between 0 and 5000',
    'Umrechnungskurs muss zwischen 0 und 10 liegen': 'The exchange rate must be between 0 and 10',
    'API-Schlüssel zu lang': 'API key too long',
    'Ungültige Angabe': 'Invalid input',
    'Gespeicherter Schlüssel lässt sich nicht mehr entschlüsseln (JWT_SECRET geändert?). Bitte neu eintragen.': 'The stored key can no longer be decrypted (JWT_SECRET changed?). Please enter it again.',
    'Kein API-Schlüssel hinterlegt': 'No API key stored',
    'Kein gültiger API-Schlüssel hinterlegt': 'No valid API key stored',
    'Die KI-Funktion ist nicht aktiviert': 'The AI feature is not enabled',
    'Die KI hat keine verwertbaren Sätze geliefert': 'The AI did not return any usable sentences',
    'Die KI hat die Anfrage abgelehnt': 'The AI refused the request',
    'Leere Antwort der KI': 'Empty response from the AI',
    'Unbekannter KI-Anbieter': 'Unknown AI provider',
    'API-Schlüssel ungültig': 'API key invalid',
    'Keine Berechtigung für dieses Modell': 'No permission for this model',
    'Modell nicht gefunden': 'Model not found',
    'Anbieter-Limit erreicht, bitte später erneut versuchen': 'Provider limit reached, please try again later',
    'Anbieter nicht erreichbar': 'Provider unreachable',
    'Antwort der KI war zu lang, bitte weniger Sätze anfordern': 'The AI response was too long, please request fewer sentences',
    'Antwort der KI war kein gültiges JSON': 'The AI response was not valid JSON',
    'Kein Text angegeben': 'No text given',
    'Text zu lang': 'Text too long',
    'Die Cloudstimme ist nicht eingerichtet': 'The cloud voice is not set up',
    'Tageslimit für Cloudstimme erreicht': 'Daily limit for the cloud voice reached',
    'Zu viele Anfragen, bitte kurz warten': 'Too many requests, please wait a moment',
    'Leere Antwort des Anbieters': 'Empty response from the provider',
    'Tageslimit muss zwischen 0 und 5000 liegen': 'The daily limit must be between 0 and 5000',
    'Interner Serverfehler': 'Internal server error',
    'OIDC nicht konfiguriert (OIDC_ISSUER_URL/CLIENT_ID/CLIENT_SECRET fehlt)': 'OIDC not configured (OIDC_ISSUER_URL/CLIENT_ID/CLIENT_SECRET missing)'
};

const PATTERNS_EN = [
    [/^Verbindung zu (.+) funktioniert \((\d+) Byte Audio\)\.$/, (m, p, n) => `Connection to ${p} works (${n} bytes of audio).`],
    [/^Anzahl muss zwischen (\d+) und (\d+) liegen$/, (m, a, b) => `The number must be between ${a} and ${b}`],
    [/^Heute ist nur noch 1 Satz möglich$/, () => 'Only 1 more sentence is possible today'],
    [/^Heute sind nur noch (\d+) Sätze möglich$/, (m, n) => `Only ${n} more sentences are possible today`],
    [/^Fehler beim Anbieter \((.*)\)$/, (m, s) => `Provider error (${s})`],
    [/^Verbindung zu (.+) funktioniert, Modell (.+) ist verfügbar\.$/, (m, p, model) => `Connection to ${p} works, model ${model} is available.`]
];

function uiLangOf(req) {
    const h = req && req.headers && req.headers['x-ui-lang'];
    return String(h || '').toLowerCase() === 'en' ? 'en' : 'de';
}

function translate(text, lang) {
    if (lang !== 'en' || typeof text !== 'string') return text;
    if (Object.prototype.hasOwnProperty.call(MESSAGES_EN, text)) return MESSAGES_EN[text];
    for (const [re, fn] of PATTERNS_EN) { const m = text.match(re); if (m) return fn(...m); }
    return text;
}

// Express-Middleware: übersetzt `error` und `message` jeder JSON-Antwort für die englische Oberfläche
function uiMessagesMiddleware(req, res, next) {
    req.uiLang = uiLangOf(req);
    if (req.uiLang === 'en') {
        const json = res.json.bind(res);
        res.json = (body) => {
            if (body && typeof body === 'object' && !Array.isArray(body)) {
                if (typeof body.error === 'string') body.error = translate(body.error, 'en');
                if (typeof body.message === 'string') body.message = translate(body.message, 'en');
            }
            return json(body);
        };
    }
    next();
}

module.exports = { uiMessagesMiddleware, translate, uiLangOf, MESSAGES_EN };
