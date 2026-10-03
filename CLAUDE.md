# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Übergabe / Aktueller Stand (2026-10-03, abends) – zuerst lesen

- **Live läuft 2.2.1** (Commit `0ee17f1`; davor 2.2.0 = `e541f90`, Tag `v2.2.0`, Live-Deploy erfolgreich, Container auf Node 22). KI-Beispielsätze, Grammatik-Erklärungen, Konjugationstabellen. Details unten unter „Version 2.2.0“.
- **Live-Datenbank korrigiert (2026-10-03):** `GrammarSentences` komplett durch die korrigierten Listen ersetzt (IT 2.926, EN 2.972; vorher 3.176/2.972), 46 Kopien in der eigenen Liste eines Nutzers (`Vocabularies`, `typ='Satz'`, `isOwn=false`) per exaktem Textvergleich korrigiert. Sicherung davor: `/root/lernapp-db-20261003-vor-2.2.0.sql.gz` auf dem VPS. 3.176 alte IT-Kopien ohne Besitzer (`UserId IS NULL`, von gelöschten Nutzern) sind unverändert.
- **Mobile-Builds 2.2.0 sind gebaut (MacBook):** Web-Assets committet (Commit nach `e541f90`, inkl. `grammar-help.js` per `git add -f`).
  - **Android:** `app-release-v2.2.0-v22.aab` im Repo-Root (gitignored), versionCode 22, Release-Keystore (SHA256 `7E:85:B2:33:…:54:F1`).
  - **iOS:** `~/Projekte/Neue_Lernapp/build/VokabelnMulti-2.2.0-22.xcarchive`, Build 22, Team `SYQL3PUXA9`, auf dem iPhone 15 Pro installiert.
  - **Noch nicht hochgeladen** (ersetzt die nie hochgeladenen 2.1.2/2.1.4-Builds): iOS über Xcode-Organizer → „Distribute App“ (Upload per `xcodebuild -exportArchive` blockiert der Auto-Mode), Android manuell in der Play Console.
- **KI noch nicht mit echtem Schlüssel getestet:** Im Admin-Tab „KI“ Schlüssel eintragen, „Verbindung testen“, aktivieren. Lokal nur mit Attrappe getestet.
- **Nextcloud:** `~/Projekte` wurde per Nextcloud zwischen den Rechnern synchronisiert. Das hat am 2026-10-03 Dateien im Repo und in `.git` auf alte Stände zurückgesetzt („conflicted copy“). Der Sync für `~/Projekte` ist jetzt aus. Rechner nur noch per `git pull`/`git push` abgleichen und vor Commits nach `*conflicted copy*` suchen.
- **Test-Deploy** (self-hosted Runner auf dem Heimserver) hängt seit 2026-10-03 in `queued` → Runner offline, siehe unten. Live ist davon unabhängig.
- **Noch offen:** Uploads 2.2.0 (Apple-Einreichung steht seit 2.1.0 aus), SMTP-Passwort ändern, Upload-Key-Reset in der Play Console.

### Stand vom MacBook (2026-10-02, Builds 2.1.2)

- **Live (Web) läuft 2.1.2** (`/api/health` auf vokabeln.bernauer24.com). Git-Tags `v2.1.1` (`5598798`) und `v2.1.2` (`31a591e`) sind gesetzt.
- **Mobile-Builds 2.1.2 sind gebaut** (MacBook, nach `npx cap sync` – keine Änderungen an den Web-Assets):
  - **Android:** `app-release-v2.1.2-v19.aab` im Repo-Root (gitignored), versionCode 19 / versionName 2.1.2. Signiert mit dem Release-Keystore (`vokabeln-release.jks`, SHA256 `7E:85:B2:33:…:54:F1`), also mit demselben Zertifikat wie das bisher akzeptierte AAB 2.0.5. **Noch nicht in die Play Console hochgeladen** (es gibt kein fastlane/Play-Publisher-Setup, Upload also manuell).
  - **iOS:** Archiv `~/Projekte/Neue_Lernapp/build/VokabelnMulti-2.1.2-19.xcarchive` (außerhalb des Repos), Version 2.1.2 / Build 19, Team `SYQL3PUXA9`. Auf dem iPhone 15 Pro zum Testen installiert. **Noch nicht zu App Store Connect hochgeladen**: im Xcode-Organizer „Distribute App“ → App Store Connect wählen, oder `xcodebuild -exportArchive` mit `method=app-store-connect`, `destination=upload`.
  - Das Scheme „Vokabeln Multi“ ist jetzt als Shared Scheme im Repo (`xcshareddata/xcschemes`).
- **Hinweis zum Teamwechsel:** Alte Installationen auf Geräten sind noch mit Team `YP6683AT3R` signiert. Ein Update mit `SYQL3PUXA9` wird abgelehnt (CoreDeviceError 3002, „application-identifier … does not match“). Dann zuerst die alte App löschen. Dabei gehen die lokalen App-Daten verloren. Über den App Store sollte das Problem nicht auftreten, wenn die Bundle-ID schon im neuen Team liegt; das bitte bei der ersten Einreichung prüfen.
- **Noch offen:** AAB in der Play Console hochladen, iOS-Upload und Einreichung bei Apple (2.1.0 wurde nie eingereicht), SMTP-Passwort ändern, Upload-Key-Reset in der Play Console. Nach dem Reset müssen AABs mit `vokabeln-upload-2026.jks` signiert werden (die Werte `VOKABELN_UPLOAD_*` stehen in `~/.gradle/gradle.properties`); dafür `signingConfigs` in `android/app/build.gradle` umstellen.

## Project Overview

**Sprachenapp-Test** is a language learning app (Italian/English) with vocabulary, grammar, quiz, flashcard, and drag-and-drop exercises. Stack: Vanilla JS SPA frontend, Node.js/Express backend, PostgreSQL, Capacitor for iOS/Android.

## Commands

### Backend

```bash
cd server
npm install
npm start          # Starts Express on port 3001 (or $PORT)
```

### Docker (recommended for full stack)

```bash
docker-compose up -d       # Start app + PostgreSQL
docker-compose down        # Stop containers
docker-compose logs -f     # Follow logs
```

### Mobile (Capacitor)

```bash
npx cap sync               # Sync web assets to native projects
npx cap build android      # Build Android
npx cap open android       # Open in Android Studio
npx cap open ios           # Open in Xcode
```

### Environment Variables

Key vars (see `docker-compose.yml` for defaults):

| Variable | Purpose |
|----------|---------|
| `DATABASE_URL` | PostgreSQL connection string |
| `JWT_SECRET` | JWT signing key |
| `PORT` | Server port (default 3001) |
| `SMTP_HOST/PORT/USER/PASS` | Email for password resets/invites |
| `NODE_ENV` | `production` disables Sequelize logging |

## Architecture

### Frontend (`server/public/index.html`)

Single monolithic file (~11,800 lines) containing all HTML, CSS, and JavaScript. No build step — Tailwind CSS and SheetJS load from CDN. Key patterns:

- **State**: Global JS variables (`currentVocabList`, `userStats`, `currentMode`, etc.)
- **API**: Fetch calls with JWT Bearer token from `localStorage`
- **Modes**: `drag-drop`, `quiz`, `flashcard`, `writing` — controlled by `currentMode`
- **i18n**: UI language (`APP_UI_LANG`: de/en) and learning content language (`CURRENT_LANG`: it/en) are separate. Grammar verb tenses always display in the learning language.
- **Search**: 300ms debounce, capped at 200 results with "load more"
- **Excel import**: SheetJS, chunked in batches of 500 for large imports

### Backend (`server/`)

Express REST API with Sequelize ORM.

| File | Role |
|------|------|
| `server.js` | App entry, route mounting, health check at `/api/health` |
| `models.js` | All Sequelize model definitions (User, Vocabulary, Stats, BaseVocabulary, GrammarSentence, InviteCode, Setting, AiUsage) |
| `middleware/auth.js` | JWT verification, admin guard, error handler |
| `utils/mailer.js` | Nodemailer SMTP for invites and password resets |

API routes under `/api/`:

| Route | File |
|-------|------|
| `/auth` | `routes/auth.js` — login, register, password reset, profile |
| `/vocab` | `routes/vocab.js` — user vocabulary CRUD + learning stats |
| `/base-vocab` | `routes/baseVocab.js` — read-only pre-loaded vocabulary |
| `/grammar-sentences` | `routes/grammar.js` — grammar content by language |
| `/admin` | `routes/admin.js` — user management, invite codes, bulk ops, KI-Einstellungen |
| `/ai` | `routes/ai.js` — KI-Beispielsätze (Optionen, Erzeugung mit Tageslimit) |
| `/contact` | `routes/contact.js` — contact form |

### Data Model Concepts

- **BaseVocabulary**: Pre-loaded, shared, read-only for regular users (admin only for edits)
- **Vocabulary**: User-created custom entries
- **Stats**: Per-user, per-vocabulary learning statistics (for streak tracking)
- **InviteCode**: Controls registration access; first registered user becomes admin automatically
- **Static bypass codes**: `CODE-ENTFERNT-1`, `CODE-ENTFERNT-2` (hardcoded in auth route)

### Authentication

JWT tokens with 30-day expiration, auto-renewed via `POST /api/auth/refresh` when older than 12 h, stored in `localStorage`, sent as `Authorization: Bearer <token>`.

### Mobile

Capacitor wraps the SPA as a native iOS/Android app. Web dir is `server/public`. Dark mode is enforced for mobile/narrow viewports (≤1024px). Uses Capacitor Keyboard plugin for native scroll control and DragDropTouch polyfill for iOS drag-and-drop.

#### iOS Release-Builds auf Gerät installieren

Das Xcode-Projekt ist für Release-Builds auf physischen Geräten konfiguriert (`LaunchAction buildConfiguration = Release`). Wichtige Hinweise:

- `CODE_SIGN_IDENTITY = "Apple Development"` ist explizit in allen vier Build-Configs gesetzt (Project + Target, Debug + Release) — nötig damit Xcode 16 kein Distribution-Zertifikat für Release wählt
- **CoreDeviceError 3002**: Tritt auf wenn eine alte App-Version (anderes Signing) noch auf dem Gerät ist → App auf iPhone löschen, Clean Build Folder (Shift+Cmd+K), erneut Run

### CI/CD

GitHub Actions (`.github/workflows/`):
- `deploy-test.yml` → test environment (port 9009), läuft **automatisch** bei Push auf `main`, self-hosted runner auf 192.168.2.204
- `deploy-live.yml` → production, muss **manuell** ausgelöst werden (Actions → Run workflow), deployt per SSH auf Hetzner VPS

**Test-Deploy hängt in `queued`?** Der self-hosted Runner (`la2`) läuft nur, wenn der Heimserver an und erreichbar ist. Prüfen mit `gh api repos/boernie77/Sprachenapp-Englisch-Italienisch/actions/runners` (Status `offline` oder Runner fehlt ganz) sowie `ping`/`ssh` gegen `192.168.2.204`. Von extern (z.B. Hetzner oder Cloud-Sessions) ist der Heimserver ggf. gar nicht im LAN erreichbar — dann muss vor Ort nachgesehen werden, ob Server/Runner-Dienst laufen. Kein SSH-Zugang zum Heimserver in diesem Repo hinterlegt.

#### Server-Pfade
| System | Server | Verzeichnis | Container App | Container DB | Port |
|--------|--------|-------------|---------------|--------------|------|
| Live | Hetzner VPS (IP lokal) | `/opt/lernapp` | `lernapp-app-1` | `lernapp-db-1` | 9011 |
| Test | Heimserver `192.168.2.204` | `/home/systemv/multilang-9009` | `multilang-9009-app-1` | `multilang-9009-db-1` | 9009 |

#### SSH-Zugang Hetzner (Live)
Steht **nicht** im Repo (öffentlich). Siehe lokale `../CLAUDE.md` auf dem Linux-Rechner (Ordner `Neue_Lernapp/`).

#### Wichtig: DB_PASSWORD darf keine URL-Sonderzeichen enthalten
`#`, `@`, `/`, `?` in `DB_PASSWORD` brechen die `DATABASE_URL` in `docker-compose.yml`. Nur Buchstaben, Zahlen und `_` verwenden.

#### GitHub Secrets (alle 6 müssen gesetzt sein)
`JWT_SECRET`, `JWT_SECRET_TEST`, `DB_PASSWORD_LIVE`, `DB_PASSWORD_TEST`, `SMTP_PASS`, `HETZNER_SSH_KEY`

#### Datenpersistenz (KRITISCH)

PostgreSQL-Daten liegen als **Bind-Mount** unter `./pgdata` (kein Docker named volume). Das Verzeichnis ist in `.gitignore` eingetragen. Der Deploy-Script nutzt `git clean -fd --exclude=pgdata` als zusätzliche Schutzebene. Reihenfolge in `deploy-live.yml` ist zwingend: `git fetch` → `git reset --hard` → `git clean -fd --exclude=pgdata` → `mkdir -p pgdata`. **Nie diese Reihenfolge ändern** — falsche Reihenfolge hat in der Vergangenheit 3× zu Datenverlust geführt.

## Key Development Notes (from DEV_NOTES.md)

- Flashcard example sentence toggles: hidden globally, shown per-card only
- Version number: displayed only in hamburger menu, not in main header
- Example sentences: shown as popups after success in drag-drop, quiz, and writing modes
- Grammar category filters are dynamic and derived from Excel import data
- Dark mode is required on mobile and in narrow browser windows
- `escapeHtml()` Funktion im Frontend (nach `safeJSONParse`) — muss für alle User-Inhalte in innerHTML-Kontexten verwendet werden (XSS-Schutz)
- `window._isSyncing` Flag verhindert Race Conditions beim 60s-Hintergrund-Sync; `switchLanguage()` wartet darauf, bevor `loadDataFromServer()` aufgerufen wird
- Vocab-Modal Save-Handler: `saveVocabBtn.disabled = true` und `generateVerbForms()` müssen AUSSERHALB/VOR dem try-Block stehen, damit `finally` immer läuft

## Sicherheit / Signatur (seit 2026-09-30)
- Repo war öffentlich mit Keystore, Keystore-Passwörtern und SMTP-Passwort → Repo auf **privat**, History zweimal mit `git filter-repo` bereinigt (Keystore, *.aab, Passwort-Zeilen → `ENTFERNT`), Force-Push. Sicherung des alten Stands: `Neue_Lernapp/Sicherung-Repo-vor-Bereinigung-20260930/` (enthält Geheimnisse, nur lokal!).
- Android-Signatur liegt **nicht mehr im Repo**: Werte `VOKABELN_RELEASE_*` in `~/.gradle/gradle.properties`, Keystore `android/app/vokabeln-release.jks` lokal (gitignored).
- Neuer Upload-Schlüssel `android/app/vokabeln-upload-2026.jks` (Werte `VOKABELN_UPLOAD_*` in `~/.gradle/gradle.properties`), Zertifikat `Neue_Lernapp/upload_certificate_lernapp_2026.pem` für den Upload-Key-Reset in der Play Console. Nach Googles Bestätigung in `build.gradle` auf `VOKABELN_UPLOAD_*` umstellen.
- Erledigt 2026-09-30: History 4× bereinigt (auch DEV_NOTES-Zugangsdaten, alter Test-Secret-Wert), DB-Port 5436 nur noch 127.0.0.1 (auch direkt auf dem VPS, Sicherung `/root/lernapp-db-20260930.sql.gz`), JWT-Fallback entfernt, `SMTP_USER` als GitHub-Secret, README.
- **Achtung:** Solange das Repo privat ist, kann der VPS nicht `git fetch`en → Live-Deploy baut still den alten Stand neu. Erst nach dem Wieder-Öffentlich-Stellen (oder mit Deploy-Key) deployen. Stand 2026-10-02: Repo ist wieder **öffentlich**, Live-Deploy funktioniert (vor jedem Deploy mit `gh repo view --json visibility` prüfen).
- Offen (nur der Nutzer kann das): SMTP-Passwort beim Mailanbieter ändern + `gh secret set SMTP_PASS`; Upload-Key-Reset in der Play Console mit `upload_certificate_lernapp_2026.pem`. Danach Repo wieder öffentlich.

## Version 2.2.1 (2026-10-03) – live deployt (Mobile-Builds noch nicht erstellt, im Browser nicht visuell geprüft)
- **KI-Sätze umgebaut:** Statt Dialog pro Wort jetzt Menü „✨ KI-Beispielsätze“ (`aiSentenceModal`, wiederverwendet) mit allgemeinen Einstellungen: Automatik an/aus, Niveau, Grammatikarten (je Sprache), Sätze pro Wort. Pro Nutzer auf dem Server: `Users.aiPrefs` (JSON), `PUT /api/ai/preferences`, `GET /api/ai/options` liefert `prefs`.
- Automatik (`runAiAuto()` im Frontend): erzeugt im Hintergrund für jedes aktive Wort ohne KI-Sätze Sätze (`/ai/sentences` + `/vocab/bulk`), gestartet nach `loadDataFromServer` und nach neuer Vokabel; stoppt bei Tageslimit/3 Fehlern in Folge. Sätze tragen `Vocabularies.forWord` (Fremdwort) und sind normale eigene Sätze (`typ: 'Satz'`).
- **Mehrere Niveaus + feste Verteilung (nach 2.2.1, noch nicht live):** `aiPrefs.levels` (Array; alte `level`-Werte werden gelesen), `/ai/sentences` nimmt `levels`. `buildPlan()` in `utils/ai/index.js` weist jedem Satz zufällig eine Grammatikart und ein Niveau zu (Reihenfolge je Wort gemischt), die KI schreibt nur nach Plan; `category`/`level` kommen aus dem Plan, nicht aus der KI-Antwort. Weniger Sätze als Arten → pro Wort nur ein Teil, über alle Wörter gleichmäßig.
- Grammatik-Modus: Knopf „Sätze zu einem Wort anzeigen“ → `wordSentencesModal` mit Suche (zeigt Sätze je `forWord`).
- Vollständige Vokabelliste zeigt „Aktiv: X von Y“ (`updateVocabActiveCount`).
- Desktop-Fenster: kleine Fenster verkleinern `html { font-size }` per Media Query (Ende des `<style>` im `<head>`), große Monitore unverändert. Im Browser noch nicht visuell geprüft.

## Version 2.2.0 (2026-10-03) – live deployt
- **KI-Beispielsätze:** Admin → Tab „KI“ (Anbieter Claude/OpenAI, Modell, API-Schlüssel, an/aus, Tageslimit pro Nutzer, Verbindungstest, „Modelle laden“). Einstellungen in Tabelle `Settings` (Schlüssel `ai.config`), API-Schlüssel AES-256-GCM-verschlüsselt (`server/utils/secretBox.js`, Schlüssel per HKDF aus `JWT_SECRET` → wird `JWT_SECRET` geändert, Schlüssel neu eintragen). Nutzungszähler in Tabelle `AiUsage`.
  - Server: `server/utils/ai/` (`providers.js` = Adapter Anthropic/OpenAI über die offiziellen SDKs, `index.js` = Einstellungen + Prompt + Schema, `grammar.js` = Niveaus und Grammatikarten), Routen `server/routes/ai.js` (`GET /api/ai/options`, `POST /api/ai/sentences`) und `/api/admin/ai-settings*` in `routes/admin.js`.
  - Englische Kategorien heißen wie nach dem Admin-Import (`uploadGrammar` vereinheitlicht: Simple Present, Future, Imperativ, Conditional). Neue Kategorien: Imperativo, Congiuntivo, Futuro Semplice (IT), Subjunctive (EN). Niveaus A1–B2.
  - Frontend: Knopf „✨ Beispielsätze mit KI“ im Vokabel-Dialog → Dialog `aiSentenceModal`; gespeichert als eigene Sätze (`typ: 'Satz'`, `grammatica` = Kategorie, neue Spalte `Vocabularies.level`), Admins optional zusätzlich global.
  - `apiFetch` meldet bei HTTP 403 ab → KI-Fehler nie mit 403 beantworten (deaktiviert = 409). `apiFetch` kennt jetzt `options.timeoutMs` (KI-Aufruf 150 s).
  - Dockerfile auf `node:22-slim` (OpenAI-SDK braucht Node 22).
- **Grammatik-Hilfe** (`server/public/grammar-help.js`, eigene Datei, per `<script src>` eingebunden): Nach dem Prüfen im Grammatik-Modus Erklärung zur Kategorie (`EXPLANATIONS`) und antippbare Verben → Konjugationstabelle (`conjugationModal`). Eigener Konjugator für IT (regelmäßig, -isc-, Rechtschreibregeln, unregelmäßige/reflexive Verben, Vorsilben) und EN. In Node testbar: `require('./server/public/grammar-help.js')`.
- **Satzlisten korrigiert** (auch live in der DB, siehe Übergabe): 767 Funde aus einer Logik-/Grammatikprüfung übernommen, 249 Schablonen-Sätze (IT, alte Zeilen 2929–3177) und eine doppelte Kopfzeile gelöscht. Korrigierte Excel-Dateien: `Neue_Lernapp/Excellisten für Lernapp/*_korrigiert_2026-10-03.xlsx`, Fundliste `Satzpruefung_Funde_2026-10-03.xlsx`.
- Fixes: `vocabGrammaticaCol` war nicht definiert (Wortart-Wechsel im Vokabel-Dialog brach ab); Lösung im Grammatik-Feedback wird escaped.
- Mobile-Dark-Mode: neue Dialoge übernehmen die `#vocabModal`-Regeln (Selektoren ergänzt); eigener Style-Block für `#grammarHelpBox`/`.conj-highlight` am Ende von `<head>`.

## Version 2.1.4 (2026-10-03) – live deployt
- Offline-Änderungen (`syncOutbox`) gehen bei Abmeldung nicht mehr verloren: `logout()` parkt sie unter `lernapp-pending-outbox-<userId>` (bewusst **kein** `ita-`-Präfix, damit sie das Löschen überstehen). `restorePendingOutbox()` holt sie beim Start und nach dem Login **nur für denselben Nutzer** zurück.
- `processSyncOutbox()` trägt Aufgaben erst nach Erfolg einzeln aus und bricht ab, sobald abgemeldet wurde. Vorher schrieb es nach einer Abmeldung mitten im Sync die Warteschlange zurück, wo sie beim nächsten Nutzer gelandet wäre. Einträge, die nach der Abmeldung noch eintreffen, parkt `addToSyncOutbox()` beim abgemeldeten Nutzer.
- Stats aus der Warteschlange sendet jetzt `sendQueuedStat()` mit den gemerkten Werten, zusammengeführt mit `wordStats` (Maximum je Feld). Vorher wurde `saveStatToServer()` mit dem aktuellen `wordStats` aufgerufen, nach einer Neuanmeldung also mit Serverwerten. Der Server überschreibt Stats (`PUT /vocab/:id/stats`) und führt nichts zusammen.

## Version 2.1.3 (2026-10-03) – live deployt
- Fix: Nutzer wurden täglich abgemeldet, weil der JWT nur 24 h galt und nie verlängert wurde. Jetzt: `signToken()` in `middleware/auth.js` (30 Tage, von `routes/auth.js` und `routes/oidc.js` genutzt) + `POST /api/auth/refresh` (prüft, ob User existiert und aktiv ist). Frontend `refreshTokenIfDue()` erneuert den Token beim Start und beim 60s-Sync, sobald er älter als 12 h ist → wer die App mindestens alle 30 Tage öffnet, bleibt angemeldet.
- (Verlust von Offline-Änderungen bei Abmeldung ist seit 2.1.4 behoben.)

## Version 2.1.2 (2026-10-02) – live deployt
- Fix: `checkDuplicate()` sperrte Speichern, sobald die **deutsche** Seite schon existierte (oppure → „oder“, weil oder → o vorhanden), sogar sprachübergreifend. Jetzt zählt nur das Fremdwort innerhalb `CURRENT_LANG`; Hinweis zeigt „Bereits vorhanden: de → it“ (i18n-Key `tag_duplicate`).
- Commit `31a591e`, Android versionCode 19, iOS Build 19. Mobile Builds noch nicht erstellt, kein Tag.
- Mobile Web-Assets in Commit `cd67238` nachgezogen (Build auf dem MacBook).

## Version 2.1.1 (2026-10-02) – live deployt
- Fix: Firefox stellt nach Reload Werte versteckter `<select>`-Felder wieder her → Custom-Dropdown zeigte „Alle Kategorien“, filterte aber nach altem Wert. Lösung: `autocomplete="off"` an allen versteckten Selects + `setupCustomDropdown` gleicht Label beim Start an `sel.value` an. **Neue versteckte Selects immer mit `autocomplete="off"` anlegen.**
- Versionsnummer an: `package.json`, `server/package.json`, `server.js` (`/api/health`), `index.html` (3 Anzeigen + „Neu“-Fenster + `hasSeenVersion_2_1_1`), `android/app/build.gradle` (versionCode 18), `project.pbxproj` (Build 18).
- Commit `5598798` auf `main`, Live-Deploy erfolgreich (`/api/health` meldet 2.1.1). Mobile Builds für 2.1.1 noch nicht erstellt (`npx cap sync` + Build), kein Git-Tag.
- **Bei jedem Deploy die Versionsnummer erhöhen** (Wunsch des Nutzers) – alle Stellen siehe oben.
- Fehlersuche-Tipp: Funktioniert etwas nur in einem Browser nicht, zuerst wiederhergestellte Formularwerte / localStorage dieses Browsers verdächtigen. Live-DB lesend abfragen: SQL-Datei per SSH auf den VPS (`… 'docker exec -i lernapp-db-1 sh -c "psql -U \$POSTGRES_USER -d \$POSTGRES_DB"' < datei.sql` (vermeidet Quoting-Probleme).
- Die Kopien in `ios/App/App/public` und `android/app/src/main/assets/public` stehen in `.gitignore`, sind aber **getrackt**. Für Mobile-Builds auf dem MacBook `server/public/index.html` dorthin kopieren und mit `git commit -- <pfade>` committen (`git add` verweigert ignorierte Pfade).
- Lokales Git hat keine globale Identität – Commits mit `git -c user.name=boernie77 -c user.email=115419572+boernie77@users.noreply.github.com commit …`.

## Version 2.1.0 (2026-09-30)
- Einheitlich 2.1.0: `package.json`, `server/package.json`, `/api/health`, Web-Anzeige + „Neu“-Fenster (`hasSeenVersion_2_1_0`), Android versionCode 17, iOS Build 17.
- iOS `Info.plist` liest jetzt `$(MARKETING_VERSION)` / `$(CURRENT_PROJECT_VERSION)` – Version nur noch in `project.pbxproj` pflegen (vorher stand 2.0.6/16 fest in der Info.plist).
- Xcode-Scheme heißt „Vokabeln Multi“ (nur lokal unter xcshareddata, nicht im Repo).
- iOS-Signierung: bezahltes Team `SYQL3PUXA9` (im Projekt eingetragen). Die Bundle-ID `com.bernauer24.vokabeln` ist noch nicht ausdrücklich im bezahlten Team registriert, bisher greift das Wildcard-Profil. Beim ersten Archiv mit `-allowProvisioningUpdates` prüfen.
- Git-Tag + GitHub-Release `v2.1.0`. Noch NICHT bei Apple eingereicht. Live inzwischen durch 2.1.1 abgelöst.
