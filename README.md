# Lernapp – Vokabeltrainer Italienisch & Englisch

Vokabel- und Grammatiktrainer mit Quiz, Karteikarten, Drag & Drop und freiem Schreiben.
Eigene Vokabellisten lassen sich anlegen oder als Excel-Datei importieren; der Lernfortschritt
steuert gezielte Wiederholungen.

- **Web & Desktop** im Browser, dazu Apps für **iOS und Android** (Capacitor)
- **Self-hosted:** Node.js/Express-Backend mit PostgreSQL, als Docker-Stack
- Projektseite und Demo: <https://byboernie.de/lernapp.html>

## Selbst hosten

Voraussetzung: Docker mit Docker Compose.

```bash
git clone https://github.com/boernie77/Sprachenapp-Englisch-Italienisch.git
cd Sprachenapp-Englisch-Italienisch
cp .env.example .env      # Werte ausfüllen (siehe unten)
docker-compose up -d
```

Die App läuft danach auf `http://localhost:9011` (Port über `APP_PORT` änderbar).
Die Datenbank ist nur lokal auf dem Server erreichbar (`127.0.0.1`), die Daten liegen in `./pgdata`.

### Wichtige Einstellungen in `.env`

| Variable | Bedeutung |
|---|---|
| `JWT_SECRET` | **Pflicht**, mindestens 32 zufällige Zeichen (z. B. `openssl rand -base64 48`). Ohne sicheren Wert startet der Server nicht. |
| `DB_PASSWORD` | Passwort der Datenbank. Nur Buchstaben, Zahlen und `_` verwenden. |
| `DB_NAME`, `DB_PORT` | Name und lokaler Port der Datenbank |
| `APP_PORT` | Port der Web-App |
| `APP_URL` | Öffentliche Adresse der App (für Links in E-Mails) |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASS` | Postfach für Passwort-Mails und das Kontaktformular (optional) |
| `STATIC_INVITE_CODES` | Optional: feste Einladungscodes, kommagetrennt. Leer = Registrierung nur mit Codes aus dem Admin-Bereich. Der erste registrierte Nutzer wird automatisch Admin. |
| `CONTACT_EMAIL` | Empfänger des Kontaktformulars. Leer = Kontaktformular deaktiviert. |
| `OIDC_ISSUER_URL`, `OIDC_CLIENT_ID`, `OIDC_CLIENT_SECRET` | Optionaler Login per Single Sign-on (z. B. Authentik) |

**Niemals** eine ausgefüllte `.env`, Keystores (`*.jks`) oder App-Pakete (`*.aab`) einchecken –
sie sind in `.gitignore` ausgeschlossen.

## Apps für iOS und Android

Die Apps sind eine Hülle um dieselbe Web-Oberfläche und brauchen **deinen eigenen Server**.

- **Erster Start:** Die App fragt nach der Server-Adresse (z. B. `https://lernapp.example.com` oder im Heimnetz
  `http://192.168.1.20:9011`) und prüft die Verbindung. Später lässt sie sich im Menü unter „Server ändern“ wechseln.
- **Adresse vorbelegen (eigene Builds):** Lege `server/public/app-config.local.js` an (steht in `.gitignore`):
  `window.APP_CONFIG = { defaultServerUrl: 'https://lernapp.example.com' };`
- **Heimnetz:** Adressen im lokalen Netz dürfen ohne HTTPS verwendet werden (iOS: „Lokales Netzwerk“-Abfrage,
  Android: unverschlüsselter Verkehr erlaubt). Ist der Server nicht erreichbar, lernt die App offline weiter;
  alle Änderungen werden gespeichert und beim nächsten Kontakt mit dem Server abgeglichen. Anmeldung, Excel-Import
  und KI-Funktionen brauchen die Verbindung zum Server.
- **Eigene Kennung:** Vor dem Veröffentlichen die App-Kennung (`appId` in `capacitor.config.json`, Bundle-ID in Xcode,
  `applicationId` in `android/app/build.gradle`) und die Signatur durch deine eigenen ersetzen.

```bash
npx cap sync            # Web-Code in die iOS-/Android-Projekte übernehmen
npx cap open ios        # Xcode öffnen (Archivieren/Hochladen dort)
npx cap open android    # Android Studio öffnen
```

## Entwicklung

Die Oberfläche braucht **keine** Verbindung zu Drittservern: Stylesheet, Schrift, Emoji-Grafiken und Bibliotheken liegen in
`server/public`. Nach Änderungen an Tailwind-Klassen in `index.html` oder `grammar-help.js`: `npm install && npm run build:css`.
Optional nutzt die App den kostenlosen Übersetzungsdienst MyMemory (für unbekannte Wörter) und – wenn der Betreiber sie
einrichtet – einen KI-Anbieter (Claude oder OpenAI).

```bash
cd server && npm install && npm start     # Backend + Web-Oberfläche aus server/public
npx cap sync                              # Web-Code in die iOS-/Android-Projekte übernehmen
```

## Lizenz

Apache License 2.0 – siehe [LICENSE](LICENSE) und [NOTICE](NOTICE). Du darfst die Software frei nutzen, verändern und
weitergeben (auch kommerziell), solange Lizenztext und Urheberhinweis erhalten bleiben. Die Lizenzen der verwendeten
Bausteine stehen in der NOTICE-Datei.

## Impressum und Datenschutz (für Betreiber)

Das Repository enthält **keine** persönlichen Angaben. Wer einen öffentlich erreichbaren Server betreibt, muss
Impressum und Datenschutzerklärung selbst bereitstellen: Kopiere `legal/impressum.example.html` nach
`legal/impressum.html` und `legal/datenschutz.example.html` nach `legal/datenschutz.html`, fülle sie aus und starte
neu. Die App zeigt die Texte im Menü „Impressum & Lizenzen“ an. Nur für den privaten Betrieb im Heimnetz sind die
Dateien nicht nötig. (Das ist keine Rechtsberatung – bitte prüfe die Anforderungen für deinen Fall.)
