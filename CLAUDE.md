# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Übergabe / Aktueller Stand (2026-10-04) – zuerst lesen

- **2.2.25 live (2026-10-04):** Spanisch als dritte Lernsprache, Sprachwechsel-Fix, neues Hamburgermenü (scrollt, Fuß fest) und Admin-KI-Tab – Details im Abschnitt „Version 2.2.25“ unten. Sicherung davor: `/root/lernapp-db-20261004-vor-spanisch.sql.gz`; Zählstand IT/EN vor/nach Deploy identisch.

- **Mobile-Stand iPhone: 2.2.29 (Build 51)**, Archiv `build/VokabelnMulti-2.2.29-51.xcarchive` (iOS-Sprachausgabe über das Plugin, siehe „Version 2.2.28“); Live läuft noch 2.2.28 bzw. Branch-Stand.
- **Live läuft 2.2.28** (Sicherung davor: `/root/lernapp-db-20261004-vor-2.2.28.sql.gz`, Ordner `/opt/lernapp/tts-cache` angelegt) (Branch `fix/spanisch-labels` = 2.2.26, noch nicht deployt) (`/api/health`). Lizenz Apache-2.0 (`LICENSE`, `NOTICE`, `THIRD_PARTY_LICENSES.md`). Alles Wichtige zu den Versionen steht unten in den „Version …“-Abschnitten (2.2.1 enthält die Sammelnotizen bis 2.2.24: KI-Sätze, Verbprüfung, Offline-Warteschlange, Server-Adresse, lokal gebündelte Oberfläche, Konto löschen, Historienbereinigung).
- **Impressum/Datenschutz pro Server:** `legal/*.html` (`GET /api/legal`, Docker-Volume `./legal:/legal:ro`, `LEGAL_DIR=/legal`). Im Repo nur Vorlagen `legal/*.example.html`; die echten Dateien sind git-ignoriert. Live liegen `/opt/lernapp/legal/impressum.html` und `datenschutz.html` (Datenschutz am 2026-10-04 geschrieben nach tatsächlicher Verarbeitung; kein Rechtsrat, Aufbewahrung der Logs und Hosting-Standort sind Annahmen → ggf. prüfen). Änderung braucht kein Deploy.
- **Einladungscodes:** nur noch aus dem Admin-Bereich bzw. Umgebung `STATIC_INVITE_CODES` (live leer).
- **Mobile:** iPhone-App 2.2.28 (Build 50) ist installiert, Archiv `~/Projekte/Neue_Lernapp/build/VokabelnMulti-2.2.28-50.xcarchive`; Android-AAB 2.2.28 (versionCode 50): `~/Projekte/Neue_Lernapp/build/Vokabeln-2.2.28-50.aab`. **Store-Uploads (Apple/Play) sind nicht gemacht** und laufen manuell (Xcode-Organizer bzw. Play Console).
- **Live-DB:** Waisen am 2026-10-04 bereinigt (8.281 `Vocabularies` ohne `UserId` + 9.308 zugehörige/verwaiste `Stats` gelöscht; jetzt 6.116 Vokabeln, 2.701 Stats). Sicherung davor: `/root/lernapp-db-20261004-vor-waisen.sql.gz`. Weitere Sicherungen: `/root/lernapp-db-20261003-vor-2.2.0.sql.gz`, `/root/lernapp-db-20261004-vor-ki-fix.sql.gz`. Tabelle `DisabledSentences` ist unbenutzt.
- **Offen:** Excel-Listen sind laut Nutzer KI-erzeugt (Apache-2.0 unproblematisch; nicht im Repo, `Excellisten für Lernapp/`), App-Icon/Logo hat der Nutzer selbst per KI erzeugt (ok); Demo-Server + Testkonto für die Apple-Prüfung; Android-Build; Uploads; SMTP-Passwort ändern; Upload-Key-Reset in der Play Console; KI-Schlüssel live ist eingetragen und im Einsatz.
- **Git-Historie wurde am 2026-10-04 neu geschrieben:** alte Commit-Hashes in diesem Dokument sind ungültig, Tags v2.x gelten. Auf anderen Rechnern neu klonen bzw. `git fetch && git reset --hard origin/main`.
- **Nextcloud:** `~/Projekte` wurde früher per Nextcloud synchronisiert und hat Dateien/.git zerschossen („conflicted copy“). Sync ist aus; Rechner nur per `git pull`/`git push` abgleichen.
- **Test-Deploy** (self-hosted Runner auf dem Heimserver) hängt oft in `queued` → Runner offline; Live ist davon unabhängig.
- **Hinweis zum Teamwechsel (iOS):** Alte Installationen mit Team `YP6683AT3R` lassen sich nicht überinstallieren (CoreDeviceError 3002) → erst App löschen. Mobile-Signatur Android: `VOKABELN_RELEASE_*` in `~/.gradle/gradle.properties`.

## Project Overview

**Sprachenapp-Test** is a language learning app (Italian/English/Spanish) with vocabulary, grammar, quiz, flashcard, and drag-and-drop exercises. Stack: Vanilla JS SPA frontend, Node.js/Express backend, PostgreSQL, Capacitor for iOS/Android.

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
| `TTS_CACHE_DIR` / `TTS_CACHE_MAX_MB` | Zwischenspeicher der Cloudstimme (Standard `server/tts-cache`, 500 MB) |

## Architecture

### Frontend (`server/public/index.html`)

Single monolithic file (~11,800 lines) containing all HTML, CSS, and JavaScript. No build step — Tailwind CSS and SheetJS load from CDN. Key patterns:

- **State**: Global JS variables (`currentVocabList`, `userStats`, `currentMode`, etc.)
- **API**: Fetch calls with JWT Bearer token from `localStorage`
- **Modes**: `drag-drop`, `quiz`, `flashcard`, `writing` — controlled by `currentMode`
- **i18n**: UI language (`APP_UI_LANG`: de/en) and learning content language (`CURRENT_LANG`: it/en/es) are separate; per-language settings live in `LANG_CONFIG`. Grammar verb tenses always display in the learning language.
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
| `/tts` | `routes/tts.js` — Cloudstimme (`GET /status`, `POST /` -> MP3, Zwischenspeicher, Tageslimit) |
| `/contact` | `routes/contact.js` — contact form |

### Data Model Concepts

- **BaseVocabulary**: Pre-loaded, shared, read-only for regular users (admin only for edits)
- **Vocabulary**: User-created custom entries
- **Stats**: Per-user, per-vocabulary learning statistics (for streak tracking)
- **InviteCode**: Controls registration access; first registered user becomes admin automatically
- **Feste Einladungscodes**: nur über die Umgebung `STATIC_INVITE_CODES` (leer = nur Codes aus dem Admin-Bereich)

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

### Layout-Regeln Hamburgermenü und Admin (2.2.25)
- **Hamburgermenü** (`#dropdownMenu`): Flex-Spalte mit `max-height: calc(100dvh - 84px - safe-area)` (Fallback `100vh`). Einträge liegen in `#menuScroll` (eigenes `overflow-y:auto`), Sync/Verbindung/Version in `#menuFooter` (`shrink-0`, immer sichtbar). **Neue Menüeinträge immer in `#menuScroll`**, nie in den Footer. Einträge `py-2` (nicht `py-3`).
- **Admin-Dashboard**: Panel hat feste Höhe (`min(90dvh,46rem)`), alle Tab-Inhalte tragen `admin-pane` (`min-w-0`, `overflow-x:hidden`, `scrollbar-gutter:stable`), damit nichts beim Reiterwechsel springt. Reiterleiste ist ein Grid mit gleich breiten Spalten. Inhalte in `.admin-card` (inkl. Dark-Mode-Regel). Zeilen mit Text + Button: `flex flex-wrap`, Text `min-w-0 flex-1 basis-40 break-words`, Button `w-full sm:w-auto` (nie `shrink-0` ohne Umbruch). Prüfen mit Puppeteer: kein Element mit `scrollWidth > clientWidth` im Tab, Breiten identisch, Menü-Fuß im Viewport (375x667, 667x375).

## Version 2.2.28 – Sprachausgabe (TTS) (Branch `feature/sprachausgabe`, nicht deployt)
- **Architektur:** `server/public/tts.js` (vor dem Hauptskript geladen, in Node testbar: `server/test/tts.test.js`). API `Tts.speak(text, lang, {queue, epoch})`, `Tts.speakEntry`, `Tts.stop()`, `Tts.prepare(entry, field, ctx)`, `Tts.clean`, `Tts.pickVoice`, `Tts.available()`, `Tts.autoAllowed()`, `Tts.buttonHtml`. Verdrahtung am Ende von `index.html` (Abschnitt „Sprachausgabe“: `speakBtnHtml`, `ttsSpeakEntry`, `Tts.init`, Einstellungsfenster `#ttsModal`, `refreshTtsStatus`). `LANG_CONFIG[x].ttsLocale` (it-IT, en-GB, es-ES; de-DE fest in tts.js) – das Feld `locale` bleibt nur für den Collator.
- **Regeln:** Feldbasierte Sprache (`entry.it` = Lernsprache, `entry.de` = de-DE). Artikel bei it/es mitsprechen (`getFullIt`), bei en nie. Aufbereitung: Emoji/Variation Selectors weg, Klammern samt Inhalt weg, „el/la“ -> „el, la“, `_`/`…` ersetzt, Abkürzungstabelle `ABBREVIATIONS` (erweiterbar), **Text mit Lücken (`_{2,}` oder `...`) wird nie gesprochen** (Grammatik-Modus erst nach „Prüfen“). Queue/Abbruch: `speak` ruft zuerst `cancel()`, Epoche `state.token` entwertet verspätete `onend`, Utterance-Referenzen werden gehalten (GC-Fehler), lange Texte in Sätze geteilt (Chrome-15-s-Bug), Watchdog (Länge×120 ms + 2 s). `Tts.stop()` in `switchMode`, `resetLanguageBoundState`, allen `start…Round`/Karten-Weiter, Schließen-Knöpfen, `visibilitychange` (hidden), `pagehide`. Auto-Vorlesen (Standard aus) nur nach Nutzergeste (`navigator.userActivation`/erste Bedienung; bei Auto wird die Web-Ausgabe einmal stumm „angewärmt“, iOS) und mit `epoch` gegen Sprachwechsel. Das beim Treffer/richtigen Quiz gesprochene Wort läuft vor dem Beispielsatz-Popup (Queue). Knöpfe: Karteikarte (`#cardsSpeakSlot`), Quiz-/Schreib-Feedback, Zusatzinfo, Beispielsatz-Popup, Grammatik nach „Prüfen“ (`#grammarSpeakSlot`), Wort-/Satzliste (`data-tts-id`, delegierter Capture-Handler mit `stopPropagation`), Konjugationstabelle (Person + Form). Ohne `speechSynthesis`/Plugin/Cloud werden keine Knöpfe gerendert, bei „Aus“ blendet `html.tts-off` übrige aus.
- **Einstellungen:** `localStorage` `lernapp-tts` (`enabled`, `auto`, `rate` 0.6–1.2 Standard 0.9, `voice{it,en,es,de}`, `speakDe`, `engine` `device|cloud`, optional `nativeIos`). Menü „Sprachausgabe“ (`#openTtsBtn` in `#menuScroll`) -> `#ttsModal` (Schalter mit `aria-pressed`, Stimmenwahl + „Testen“, Cloud-Quelle nur bei `GET /api/tts/status` `available:true`, Datenschutz-Bestätigung beim Einschalten). i18n-Schlüssel `tts_*`, `admin_tts_*` (de/en).
- **Plugin / Plattform:** `@capacitor-community/text-to-speech@8` (MIT, in `THIRD_PARTY_LICENSES.md` + Impressum-Lizenzliste). `Package.swift` und Gradle-Dateien entstehen **nur** durch `npx cap sync` (nie von Hand ändern). **Android und iOS: natives Plugin** (ab 2.2.29). Android: WebView-`speechSynthesis` ist dort unzuverlässig. iOS: Die Web-API im WKWebView zeigt nur wenige Stimmen (z. B. für Italienisch nur „Alice“; heruntergeladene erweiterte/hochwertige Stimmen fehlen), das Plugin liest `AVSpeechSynthesisVoice.speechVoices()` und zeigt alle (auf dem iPhone 15 Pro bestätigt, Wiedergabe funktioniert). Die Stimmenliste wird beim Öffnen des Einstellungsfensters neu geladen (`Tts.getVoices({refresh:true})`), neu geladene Stimmen erscheinen ohne App-Neustart. Zurück auf die Web-API: in `lernapp-tts` `"webIos": true`. **Falle:** `setSettings` speichert alle Einstellungen samt Standardwerten in `localStorage`; ein früherer Standardwert (`nativeIos: false` in 2.2.28) überschrieb deshalb den neuen Standard. Deshalb heißt der Schalter jetzt `webIos` (Opt-in), und neue Schalter nie mit einem Standardwert in `DEFAULT_SETTINGS` belegen, der später umgedreht werden soll. Hinweistext zum Klingelschalter steht im Einstellungsfenster.
- **Cloudstimme (Server):** `server/utils/tts/` (`index.js` = Einstellungen, Zwischenspeicher, Limit; `providers.js` = `google` (Cloud Text-to-Speech REST, Standard-Stimmen WaveNet je Sprache) und `openai` (tts-1, `alloy`)); Route `server/routes/tts.js`: `GET /api/tts/status` -> `{available, provider}` (ohne Schlüssel nie), `POST /api/tts` `{text, lang}` -> `audio/mpeg` (Auth nötig, max. 300 Zeichen, 40 Anfragen/min/Nutzer, 400/429/503; **nie 403**, weil `apiFetch` bei 403 abmeldet; Meldungen in `uiMessages.js`). Admin: Tab „KI“ -> Karte „Cloudstimme“ (`/api/admin/tts-settings` GET/PUT, `/test`), gleiche Ablage wie der KI-Schlüssel: Tabelle `Settings`, Schlüssel `tts.config`, Schlüssel AES-256-GCM (`secretBox`), nie zurückgegeben. Kostenhinweis im Admin (Richtwerte, Preise beim Anbieter prüfen).
- **Zwischenspeicher / Limits:** MP3 pro (Anbieter, Stimme, lang, SHA-256 des Texts) unter `TTS_CACHE_DIR` (Standard `server/tts-cache`; Docker: `./tts-cache:/app/tts-cache`, in `.gitignore`), atomar geschrieben, parallele gleiche Anfragen nur einmal bezahlt, Aufräumen ab `TTS_CACHE_MAX_MB` (Standard 500, ältere zuerst). Tageslimit pro Nutzer (Standard 300 **neue**, nicht gecachte Aufrufe; Admins unbegrenzt) in `AiUsages.ttsCalls`. **Schemaänderung (additiv):** Spalte `AiUsages.ttsCalls INTEGER DEFAULT 0` (kommt per `sync({alter:true})`), keine neue Tabelle. Client: `ttsFetchAudio` -> Blob -> `Audio`; Fallback auf Gerätestimme bei Fehler (ein Toast), Blob-Cache im Speicher.
- **Tests:** `cd server && npm test` (36 Tests: u. a. `tts-cloud.test.js` mit Mock-Anbieter für Cache/Limit, `tts.test.js` für Aufbereitung/Stimmenwahl). Browser: Puppeteer-Skripte lagen im Scratchpad (gemocktes `speechSynthesis`/`Audio`, 61 Prüfungen), nicht im Repo.
- **Manuell auf dem Gerät prüfen:** iPhone (Klingelschalter an/aus, Stimmen laden, Auto-Vorlesen nach Timer, Sperrbildschirm/Hintergrund stoppt, ggf. `nativeIos`-Vergleich), Android (Plugin, Stimmenliste, `queries` im Manifest kommt vom Plugin), Cloudstimme live (Schlüssel im Admin eintragen, Test, Kosten/Limit), Docker-Volume `./tts-cache` anlegen.

## Version 2.2.27 – Englische Oberfläche vollständig (nicht deployt)
- **Fehler:** In `APP_UI_LANG = 'en'` standen viele deutsche Reste (Serie-Fenster, `grammarDescription`, `infoDescText`, Platzhalter „z.B.“, Toasts, Dialoge, Admin, Satz-/Vokabelliste, Grammatik-Erklärungen, Servermeldungen).
- **Behoben:** (1) ca. 190 neue `UI_TRANSLATIONS`-Schlüssel (de+en), feste Strings auf `getI18n` umgestellt; fehlende en-Schlüssel (`admin_*`, `toast_loading_started`…) und de-Schlüssel (`not_yet_sent`, `by`) ergänzt. (2) Neue Attribute `data-i18n-title`/`data-i18n-aria-label`, `data-list-title="export:it"` (Admin-Listen). (3) Helfer `uiLangName(lang)`, `uiDeName()`, `egPh()` („z.B.“/„e.g.“), `typLabel()`, `focusLabel()`; Richtungs-Labels zeigen in en „German → Italian“. (4) `CURRENT_LANG === 'en' ? … : …` für Oberflächentexte (Admin-Nutzerliste) auf `getI18n` umgestellt. (5) `grammar-help.js`: `EXPLANATIONS_EN`, `GrammarHelp.setUiLang()` (wird in `applyTranslations` gesetzt). (6) Server: `utils/uiMessages.js` (Middleware übersetzt `error`/`message` bei Header `X-UI-Lang: en`; `window.fetch` hängt den Header an alle `/api/`-Aufrufe), Passwort-Mail zweisprachig. (7) Italienisch: Zeitformnamen „Präsens/Imperativ“ in Verbinfo/Quiz jetzt „Presente/Imperativo“ (Immersion).
- **Neue Texte immer mit de UND en eintragen; „Neu“-Fenster-Text steht in `version_news_1` (de/en).**
- **Bewusst deutsch:** Lerninhalt, Excel-/CSV-Spaltenköpfe (Import erkennt sie), Impressum/Datenschutz vom Server, Einladungs-/Kontakt-Mail, Admin-Verbprüfung-Excel, interne Datenwerte (`Satz`, `Eigene Sätze`).
- Prüfmethode: Puppeteer-Crawl (Skripte im Scratchpad) mit Wortlisten-Heuristik + Vergleich „Text in de == Text in en“, dazu Interaktionen/Toasts mit Erfolgs- und Fehler-Mock.

## Version 2.2.26 – Beschriftungsfehler im Spanisch-/Englisch-Modus (nicht deployt)
- **Fehler:** In „Vollständige Vokabelliste“ zeigte das Richtungs-Dropdown „Deutsch Italienisch / Italienisch Deutsch“ auch bei Spanisch/Englisch (die statischen Einträge hatten keine IDs, `renderAllLabels` fand sie nicht).
- **Behoben:** (1) Vokabellisten-Richtung: IDs `vocabListSortDeOpt`/`vocabListSortItOpt`, statischer Text neutral „Deutsch → Fremdsprache“. (2) Versteckte Selects (`vocabListSortDir`, `sentenceListSortDir`, `directionFilter`) bekommen den Klartext der Lernsprache in `renderAllLabels`. (3) Englisch: Satz-Platzhalter war ein italienischer Satz (`LANG_CONFIG.en.sentencePlaceholder`). (4) Vokabel hinzufügen: Platzhalter im Fremdwort-Feld war bei Englisch „z.B. bere“ (jetzt `langConf().placeholder`); Feldbeschriftungen nutzen `word_<lang>_input/_trans` statt „Spanische Wort“. (5) Serie-Fenster: „Bravissimo!“ fest → `langConf().successLabel`. (6) „Ciao!“ aus der Kontakt-Meldung entfernt. (7) Basisliste-laden-Dialog nennt die Sprache („Spanisch“/„Spanish“) statt „ES“. (8) „Neu“-Fenster auf 2.2.26 umgeschrieben.
- **Bewusst belassen:** Admin-Listen/-Zähler je Sprache (IT/EN/ES), Sprachwahl-Flaggen, Spaltenname `it`, Altdaten-Fallback `'it'`, Importer-Spaltennamen aller Sprachen.
- Version überall 2.2.26 (Android versionCode 48, iOS Build 48). Prüfmethode: Puppeteer-Crawl über alle Sprach-/UI-Kombinationen mit Regex auf fremde Sprachnamen (Skripte lagen im Scratchpad).

## Version 2.2.25 (live deployt) – Spanisch als dritte Lernsprache
- **Stand:** Auf dem Branch `feature/spanisch` umgesetzt und committet; **nicht** auf `main`, nicht deployt, keine Store-Builds. Version 2.2.25 überall (`package.json` ×2, `server.js` `/api/health`, `index.html` 3 Anzeigen + „Neu“-Fenster + `hasSeenVersion_2_2_25`, `build.gradle` versionCode 47, `project.pbxproj` Build 47). Keine DB-Migration; die Spalte `it` heißt aus Altgründen so und enthält das Fremdwort jeder Lernsprache (`language` = `it`, `en`, `es`).
- **Entscheidungen:** Dialekt Spanien (vosotros), Lateinamerika nur als Hinweis; volle Gleichstellung mit Italienisch, keine Sprachausgabe; Schreibmodus akzenttolerant mit Hinweis, Grammatiklücken streng („Fast – nur der Akzent fehlt.“); drei Flaggen-Buttons (auf 375 px geprüft: passt neben den Menüknöpfen, kein Ausklapp-Menü nötig); Branding neutral „Vokabeln – Sprachen lernen“ (`<title>`, `manifest.json`, `package.json`; `appName` in `capacitor.config.json` war schon „Vokabeln“).
- **Server:** `server/utils/languages.js` (`LANGUAGES`, `isSupported`, `normalizeLanguage`, `LANGUAGE_NAMES`) ersetzt alle festen `['it','en']`-Listen (`routes/admin.js`, `routes/verbForms.js`, `utils/ai/autoGenerate.js`, `verbCheck.js`, `utils/ai/index.js`). `ARTICLES[language] || []` abgesichert, ES-Artikel (el, la, los, las, un, una, unos, unas), `stemOf` für -ar/-er/-ir. Admin-Statistik pro Nutzer mit `es`, Mail-Texte neutral. KI: `grammar.js` (`BASE_CATEGORIES.es`: Presente, Pretérito Perfecto, Pretérito Indefinido, Pretérito Imperfecto, Gerundio; `NEW_CATEGORIES.es`: Imperativo, Subjuntivo, Futuro, Condicional; `HINTS_BY_LANG`/`hintFor`, weil „Presente“, „Gerundio“, „Imperativo“ in mehreren Sprachen vorkommen), Prompt „Spanisch aus Spanien, Akzente, ¿…? ¡…!“, Wortinfo-Geschlecht auch für `es`, `verbCheck.js` (`normalizeInfinitive` für es mit -se und -ír, `SCHEMAS.es`, `promptFor`, `cleanSpanish`, Kostenschätzung). Geprüfte Spanisch-Formen: `presente, indefinido, imperfecto, futuro, condicional, subjuntivo` (je 6), `imperativo {tu, usted, nosotros, vosotros, ustedes}`, `participio`, `gerundio`.
- **`grammar-help.js`:** Rückfälle „sonst Italienisch“ aufgelöst (`switch (lang)`, unbekannte Sprache liefert nichts), `EXPLANATIONS.es`, `CATEGORY_TENSE.es`, Kategorie-Aliase (`canonicalCategory`: „Perfecto“ → „Pretérito Perfecto“ usw.), `conjugateSpanish` (regelmäßig, Stammwechsel ie/ue/i/jue/ie-i/ue-u, Unregelmäßige inkl. Vorsilben, Rechtschreibregeln c/qu g/gu z/c zc g/j gu/g ü, -uir und y-Formen, Hiat-Akzente, reflexive Verben mit angehängten Pronomen und Akzent, alle Zeiten inkl. Perfecto, Imperativ tú/usted/nosotros/vosotros/ustedes bejaht und verneint, Gerundio), `analyzeSpanish`, `esArticle` (el agua!), `esGuessGender`, `normalizeAnswer`/`compareAnswers`, `spanishForms`. Tests: `cd server && npm test` (`node --test test/`, 16 Tests; Regressionstest vergleicht IT/EN mit `test/fixtures/it-en-baseline.json`, erzeugt vor den Spanisch-Änderungen).
- **Frontend (`index.html`):** `SUPPORTED_LANGS`, `LANG_CONFIG` (+ `langConf()`, `langCollator()`), `esFlagSVG`/`roundFlagSVG`, `translations.es`, `*_es`-Schlüssel in `UI_TRANSLATIONS` de/en, `renderAllLabels` allgemein, Sprachbutton `langEsBtn`, `generateVerbForms(inf, lang)` (Spanisch aus dem Konjugator), `buildSpanishReverseMap`, Grammatikmodus (`GRAMMAR_RULES_ES`, `deriveInfinitiveEs` mit Probe gegen den Konjugator, ¿¡ in der Zerlegung), Beispielsatz-Popup mit `\P{L}`, Quiz-Texte, Zusatzinfo, Sortierung mit `Intl.Collator` (ñ nach n, ¿¡ ignoriert), MyMemory `es|de`, Excel Import/Export (Spalte „Spanisch“, Artikel im Wort wird abgetrennt und als Geschlecht gespeichert, Kategorie-Aliase), Admin (Upload/Download/Zähler/Verbprüfung/Statistik/CSV), `verifiedVerbForms.es`, Offline-Wörterbuch `window.offlineDictionaryEs` (508 Einträge; Substantive ohne Artikel + `grammatica` m-sg/f-sg/m-pl/f-pl, der Artikel kommt zur Anzeige), Info-Bereich `#infoContentEs` (14 Abschnitte + Hinweis Spanien/Lateinamerika; eigener Dunkelmodus-Block), Verbsuche für es, Akzentleiste `#accentBar`. Neue Substantive werden wie bei Italienisch ohne Artikel gespeichert (`el libro` wird beim Speichern/Import zu `libro` + `m-sg`; `getFullIt` setzt `esArticle` davor).
- **Nebenbei behoben:** `switchLanguage` rief die nicht vorhandene Funktion `startNewRound()` auf (Fehler nach jedem Sprachwechsel); die Ziel-Sprach-Taste im Vokabeldialog setzte immer `'it'` statt der aktuellen Lernsprache (Duplikat-Prüfung/Offline-Suche bei Englisch).
- **Rauchtest (ohne Docker, ohne Datenbank):** Puppeteer + Mock-API gegen `server/public` (Flaggen auf 375 px, Akzentleiste, Schreib- und Grammatikmodus, Dunkelmodus, Sprachwechsel) – Skripte lagen im Scratchpad, nicht im Repo.
- **Noch zu tun (nur der Nutzer):** Spanische Excel-Listen (`Excellisten für Lernapp/Basis_Vokabeln_Global_Spanisch.xlsx`, 1.426 Vokabeln; `Basisliste_Spanische_Sätze.xlsx`, 3.008 Sätze, KI-erzeugt und KI-gegengelesen, nicht von Muttersprachler geprüft) im Admin-Bereich „Listen“ → Spanisch laden; danach im Admin-Tab „KI“ die Konjugationsprüfung für Spanisch freigeben; Store-Uploads (iOS-Archiv/Android-AAB liegen in `build/`). Niveau wird nur bei Sätzen gespeichert (nicht bei Basisvokabeln, wie im Italienischen).

## Version 2.2.1 (2026-10-03) – live deployt (Mobile-Builds noch nicht erstellt, im Browser nicht visuell geprüft)
- **KI-Sätze umgebaut:** Statt Dialog pro Wort jetzt Menü „✨ KI-Beispielsätze“ (`aiSentenceModal`, wiederverwendet) mit allgemeinen Einstellungen: Automatik an/aus, Niveau, Grammatikarten (je Sprache), Sätze pro Wort. Pro Nutzer auf dem Server: `Users.aiPrefs` (JSON), `PUT /api/ai/preferences`, `GET /api/ai/options` liefert `prefs`.
- **Automatik läuft serverseitig (2.2.6):** `server/utils/ai/autoGenerate.js` (Start in `server.js`, Durchlauf alle 60 s, Sofortstart nach `PUT /ai/preferences`). Für Nutzer mit `aiPrefs.enabled` werden aktive Wörter gesucht, die in KEINEM Satz vorkommen (eigene Sätze, KI-Sätze, globale `GrammarSentences`; Näherung: Artikel weg, Verbstamm, grobe Endungen – unregelmäßige Formen wie „vado“ zählen nicht für „andare“). Dafür wird je Wort `generateSentences` aufgerufen und gespeichert; Tageslimit pro Nutzer (Admins unbegrenzt), nach 3 Fehlern in Folge Abbruch, fehlgeschlagene Wörter bis zum Neustart übersprungen. Das Frontend zeigt nur `GET /api/ai/auto-status` (Anzahl offener Wörter); neue Sätze kommen mit dem normalen 60-s-Sync. `utils/ai/usage.js` = Einstellungen + Tagesverbrauch. Die frühere Browser-Schleife ist entfernt.
- **KI-Verbprüfung (2.2.16, live; Erstlauf noch nicht freigegeben):** Tabelle `VerbForms` (language, infinitive, forms JSON, status verified/invalid/rejected). `server/utils/ai/verbCheck.js`: sammelt alle Einzelwort-Verben aus `Vocabularies` + `BaseVocabularies` (IT: -rsi → Grundverb, EN: ohne „to“, Wortgruppen werden übersprungen), prüft sie in Paketen à 15 per KI (IT: presente, imperfetto, futuro, condizionale, congiuntivo, imperativo tu/Lei/noi/voi, participio, aux, gerundio; EN: thirdPerson, past, participio, gerundio), jedes Verb nur einmal, alle 15 min (neue Verben) und nach Freigabe; ab 50 offenen Verben wartet es auf die Freigabe im Admin-Tab „KI“ → „Konjugationsprüfung“ (Kosten werden dem ersten Admin zugerechnet). App: `GET /api/verb-forms?language=&since=` (Delta inkl. rejected/invalid), lokaler Cache `ita-verified-verbs-<lang>`, `GrammarHelp.setVerifiedForms/getVerified`; geprüfte Formen ersetzen die Regelrechnung in `conjugateItalian/English` (Konjugationstabelle, Hinweis „✓ von der KI geprüft“) und in `generateVerbForms` (Zusatzinfo). Admin-Liste „Abweichungen von der Regelrechnung“ mit „verwerfen“ (`POST /admin/verb-check/reject`, Status rejected, wird nie neu geprüft). Live-Bestand 2026-10-04: 191 IT- und 346 EN-Einzelwort-Verben.
- **Git-Historie bereinigt (2026-10-04):** Mit `git filter-repo` wurden die früheren festen Einladungscodes ersetzt und die Build-Kopien `ios/App/App/public` und `android/app/src/main/assets/public` aus der gesamten Historie entfernt; Force-Push aller Zweige und Tags. **Alle Commit-Hashes in diesem Dokument davor (z. B. `e541f90`, `31a591e`) sind ungültig**, die Tag-Namen (v2.x) gelten weiter. `gitleaks` über alle 343 Commits: keine Funde. Sicherung des alten Stands (enthält die alten, inzwischen abgeschalteten Codes): `~/Projekte/Neue_Lernapp/Sicherung-Git-vor-Historienbereinigung-20261004.bundle`. **Auf jedem anderen Rechner neu klonen** (oder `git fetch && git reset --hard origin/main`). GitHub kann alte Commits noch kurz über ihre direkte Adresse zeigen (ggf. beim GitHub-Support löschen lassen).
- **Lokal gebündelte Oberfläche + Konto löschen (2.2.23, live):** Keine Drittserver mehr beim Start: `server/public/tailwind.css` (erzeugt mit `npm run build:css` aus `tailwind.config.js`, Eingabe `tailwind/input.css`; **nach Änderungen an Klassen in `index.html`/`grammar-help.js` neu bauen und mitcommitten!**), `fonts.css` + `fonts/` (Inter), `vendor/` (DragDropTouch, SheetJS), `openmoji/` (418 SVGs; `openmojiUrl()` zeigt lokal, fehlt eine Datei → Unicode-Zeichen). Das Stylesheet steht bewusst NACH den eigenen `<style>`-Blöcken (gleiche Rangfolge wie früher beim Laden per Skript). Geprüft per Stilvergleich gegen das CDN (58 Ansichten, Desktop+Handy): praktisch identisch. `cursor-move cursor-pointer` am Drag-Element war ein Konflikt → nur noch `cursor-move`. `DELETE /api/auth/me` (Passwort bzw. E-Mail bei SSO; einziger Admin gesperrt) und Admin-Löschen nutzen `utils/userData.js` und löschen alle Daten (vorher blieben Vokabeln als Waisen mit `UserId NULL`; Altbestand auf live: ca. 3.176 Zeilen ohne Besitzer, unsichtbar). Lizenzseite im Impressum-Dialog zeigt die Bausteine; `THIRD_PARTY_LICENSES.md` listet die Server-Pakete. Admin-Tab „Listen“ rief nicht vorhandene Funktionen auf (behoben).
- **Server-Adresse + Open-Source-Vorbereitung (2.2.21, live):** Die App (Capacitor) trägt die Server-Adresse beim ersten Start ein (`serverSetupOverlay`, Test über `GET /api/health`, gespeichert in `localStorage` `lernapp-server-url`, überlebt Abmeldung; Menü „Server ändern“). Voreinstellung für eigene Builds: ungetrackte `server/public/app-config.local.js` (`window.APP_CONFIG = { defaultServerUrl: … }`, in `.gitignore`; **sie liegt nur auf dem MacBook – nach `npx cap sync ios` ist sie in der App**), `app-config.js` ist im Repo leer. Web-Version nutzt relative Adressen. iOS: `NSAllowsLocalNetworking` + `NSLocalNetworkUsageDescription`, Android: `usesCleartextTraffic` + `allowMixedContent` (Heimnetz ohne HTTPS). Betreiber-Einstellungen per Umgebung: `STATIC_INVITE_CODES` (vorher fest im Code, die alten Codes waren in der Git-Historie öffentlich und sind seit 2.2.22 abgeschaltet; Secret gelöscht), `CONTACT_EMAIL` (Kontaktformular sonst 503), `SMTP_HOST/PORT/SECURE`. Deploy-Workflows schreiben sie in die `.env` (Secrets `STATIC_INVITE_CODES`, `CONTACT_EMAIL`). **Noch offen für Open Source:** Lizenz (aktuell „All rights reserved“ – keine freie Lizenz!), Impressum mit persönlichen Daten im `index.html` konfigurierbar machen, `appId` com.bernauer24…, Demo-Server für die Apple-Prüfung.
- **Offline-Warteschlange (2.2.20, live):** Verbindungszustand `connectionState` (`offline` = kein Internet, `server` = Internet aber Server nicht erreichbar, `connected`), Anzeige im Menü (`syncStateRow`) inkl. Zahl wartender Änderungen. `apiFetch` kennzeichnet Fehler (`err.isNetwork`, `err.status`; Safari „Load failed“ zählt als Netzfehler). Alle Änderungen gelten lokal sofort und gehen über `queueMutation(type, payload)` in `syncOutbox` (Typen: addVocab [mit `tempId`], editVocab, deleteVocab, bulkActive, statsReset, sentenceActive, sentenceMode, stats, daily-activity); Zusammenfassen/Löschen wartender Aufgaben dort, vorläufige Nummern `temp_…` werden nach dem Senden auf echte IDs umgestellt (`tempIdMap`, `ita-temp-id-map`). `processSyncOutbox` sendet in Reihenfolge, stoppt bei Netz-/5xx-Fehlern, verwirft 4xx-Aufgaben. Der Abgleich sendet erst die Warteschlange, holt dann Daten und legt wartende Änderungen darüber (`applyPendingVocabOverlay`, `applyPendingSentenceOverlay`). Globale Sätze + Satz-Modus werden lokal gecacht (`ita-base-sentences-<lang>`, `ita-sentence-mode`). Nur mit Server (Meldung `need_server` via `requireServer()`): Anmeldung, Excel-Import, Listen leeren, KI, Admin. Geplant als Nächstes: Server-Adresse bei der Ersteinrichtung eintragbar (statt fest `vokabeln.bernauer24.com`), dann Aufräum-Liste für Open Source (feste Einladungscodes, Kennungen, Anleitung).
- **Info-Bereich erweitert (2.2.15, live):** Italienisch: 4. Futuro semplice (regelmäßig + unregelmäßige Stämme), 5. Congiuntivo presente (14 Unregelmäßige), 6. Congiuntivo imperfetto, 7. Imperativo (regelmäßig + 13 Unregelmäßige, tu/Lei/noi/voi) mit Beispielen. Englisch: 10. Subjunctive (Present, Past, Past Perfect, feste Wendungen); Future (will/going to) und Imperativ gab es dort schon. Inhalt per Skript erzeugt, gegen `grammar-help.js` (0 Abweichungen) und einmalig per KI (keine echten Fehler, ca. 6k Token) geprüft; Dunkelmodus nur mit bereits abgedeckten Farben (text-purple/rose/orange/blue, bg-blue-50). Noch offen: KI-Prüfung der Verbkonjugationen (Zusatzinfo/Konjugationstabelle).
- **iPhone-App 2.2.24 (2026-10-04):** Archiv `~/Projekte/Neue_Lernapp/build/VokabelnMulti-2.2.24-46.xcarchive` (`npx cap sync ios`, dann `xcodebuild archive … -scheme "Vokabeln Multi" -destination 'generic/platform=iOS' -allowProvisioningUpdates`), per `xcrun devicectl device install app` auf dem iPhone 15 Pro installiert (bei „Connection reset“ einfach wiederholen). **Noch nicht hochgeladen** (Apple-Einreichung manuell über den Xcode-Organizer). **Android-AAB steht noch auf 2.2.0** (Assets in `android/app/src/main/assets/public` alt) → bei Gelegenheit `npx cap sync android` + Build; Nutzer will das später nachziehen.
- **Wortinfo + Tabs + -isc- (2.2.14, live):** `POST /api/ai/word-info` (Wortart + Geschlecht, nur wenn die Regeln im Frontend `guessWordInfoByRules` nicht reichen; Limit `lookupLimit` pro Nutzer/Tag, Standard 200, Admins unbegrenzt; Zählung `AiUsages.lookups`). Regeln: Artikel → Substantiv + Geschlecht, -are/-ere/-ire → Verb (Ausnahmen mare, altare, -iere), EN „to …“ → Verb; manuelle Wahl wird nie überschrieben. Admin-Tab-Leiste `#adminTabBar` scrollbar (Mausrad/Wischen). `generateVerbForms` (Zusatzinfo) nutzt jetzt `GrammarHelp.isIscVerb` (Liste `IT_ISC` in `grammar-help.js`, erweitert) → pulire = pulisco. Noch offen: KI-Prüfung der Konjugationen (IT+EN, alle Verben aus Basis-Vokabeln und Nutzerlisten, einmal pro Verb, global gespeichert), Android-AAB neu bauen.
- **Endlosschleife behoben (2.2.12, live):** In 2.2.11 wurde ein Wort, dessen Teilwörter nie in den erzeugten Sätzen vorkommen (z.B. „avere bisognano di“ mit Tippfehler), jede Minute neu erzeugt (480 Sätze, ca. 0,45 €). Jetzt gilt ein Wort auch als versorgt, wenn es KI-Sätze mit passendem `forWord` gibt (`wordKey`), jedes Wort kommt pro Serverlauf nur einmal dran (`doneWords`), und es gibt eine Obergrenze `MAX_KI_FACTOR` (2) × Anzahl × Niveaus an KI-Sätzen pro Wort. Wortsuche im Grammatik-Modus zeigt zusätzlich „Weitere Sätze mit dem Wort“ (näherungsweise Wortformen, auch aus Excel-Listen). Live aufgeräumt (2026-10-04): Sicherung `/root/lernapp-db-20261004-vor-ki-fix.sql.gz`, 480 überzählige Sätze von „avere bisognano di“ gelöscht (10 bleiben); Automatik des Admins war vom Nutzer schon ausgeschaltet.
- **Freigabe großer Mengen + Löschen + Export/Import (2.2.11, live):** Sind für einen Nutzer mehr als `BULK_THRESHOLD` (50) aktive Wörter ohne Satz offen, startet die Automatik nicht von selbst (`needsBulkConfirmation`), bis er im KI-Dialog bzw. direkt nach dem Speichern bestätigt (`POST /api/ai/confirm-bulk`; Admins sehen die Kosten). Freigabe nur im Speicher, endet wenn nichts mehr offen ist, verfällt bei Neustart. Admin „Liste löschen“ (`DELETE /admin/grammar-sentences`) löscht nur noch Sätze ohne `forWord` (KI-Sätze bleiben, wie beim Ersetzen). **Export/Import der globalen Liste** (Admin → Listen, 📤/📥): Spalten Fremdsprache, Deutsch, Kategorie, Niveau, **Wort** (= `forWord`, nur KI-Sätze). Import: enthält die Datei Zeilen mit Wort → Modus `overwrite-all` (alles ersetzen, vollständige Sicherung, keine Doppelten), sonst `overwrite` (nur Sätze ohne `forWord` ersetzen, KI-Sätze bleiben). Beim Ersetzen bekommen Sätze neue IDs → manuelle Abwahlen (`SentenceChoice`) dazu gehen verloren. Persönlicher Export/Import von Sätzen kennt zusätzlich `Niveau` und `Wort`.
- **Kostenvorschau + Nachrüsten (2.2.10, live):** `utils/ai/estimate.js` (Token/Kosten pro Aufruf: gemessen nur für das aktuell eingestellte Modell, sonst Schätzung 500 Token ein, 70/Satz aus, +400 Denk-Token bei Claude ab Gen. 5), `GET /api/admin/ai-estimate?model=` (Vorschau je Modell im Admin-Tab unter dem Dropdown, auch vor dem Speichern), `GET /api/ai/auto-status` liefert zusätzlich `backfillWords`/`levels`/`count` und für Admins `estimate` in €. **Nachrüsten** (`POST /api/ai/backfill`, Knopf im KI-Dialog mit Bestätigung): betrifft nur aktive Wörter, die schon KI-Sätze (`forWord`) haben, aber nicht in allen gewählten Niveaus; erzeugt mit den gespeicherten Einstellungen (Anzahl, Grammatikarten) nur für die fehlenden Niveaus. Läuft über `requestBackfill()` im Hintergrunddienst, bleibt bei Tageslimit bis zum nächsten Tag bestehen, geht bei Serverneustart verloren. Die normale Automatik erzeugt weiterhin nur für Wörter ohne jeden Satz (Einstellungen ändern → keine automatische Nacherzeugung).
- **Globale KI-Sätze mit Satz-Modus (2.2.9, live):** Alle KI-Sätze (auch von normalen Nutzern) landen in `GrammarSentences` (`forWord` = Fremdwort); die Automatik zählt ein Wort als versorgt, sobald irgendein globaler Satz oder ein eigener Satz es enthält → nie doppelt erzeugt. Pro Nutzer gibt es `Users.sentenceMode`: `auto` (Standard) = KI-Sätze sind aktiv, wenn ihr Wort (`wordKey`: ohne Artikel, klein) in der Vokabelliste aktiv ist, Excel-Sätze (ohne `forWord`) immer aktiv; `manual` = eigene Auswahl (`SentenceChoice`: nur Abweichungen vom Standard „Excel aktiv, KI inaktiv“). API: `GET /api/grammar-sentences` (mit `manualActive`), `GET/PUT /grammar-sentences/settings`, `PUT /grammar-sentences/active` (`ids` oder `all+language`). Frontend: Schalter „Sätze automatisch nach aktiven Wörtern“ in der Vollständigen Satzliste; Einzelschalter und „Alle (ab)wählen“ wechseln automatisch auf manuell (beim ersten Wechsel wird der Automatik-Zustand übernommen). Excel-Ersetzen der globalen Liste löscht nur Sätze ohne `forWord`. Die früheren Ideen „Sätze gehören dem Ersteller“ (`ownerId`) und das Wegfallen der Abwahl (2.2.8) sind verworfen. Tabelle `DisabledSentences` aus 2.2.7 ist leer/unbenutzt.
- (alt, ersetzt:) Automatik im Frontend Sätze tragen `Vocabularies.forWord` (Fremdwort) und sind normale eigene Sätze (`typ: 'Satz'`).
- **Mehrere Niveaus + feste Verteilung (Version 2.2.2):** `aiPrefs.levels` (Array; alte `level`-Werte werden gelesen), `/ai/sentences` nimmt `levels`. `buildPlan()` in `utils/ai/index.js` weist jedem Satz zufällig eine Grammatikart und ein Niveau zu (Reihenfolge je Wort gemischt), die KI schreibt nur nach Plan; `category`/`level` kommen aus dem Plan, nicht aus der KI-Antwort. Weniger Sätze als Arten → pro Wort nur ein Teil, über alle Wörter gleichmäßig.
- **Verbrauch/Kosten (2.2.3):** `AiUsage` zählt zusätzlich `calls`, `inputTokens`, `outputTokens`, `costUsd` (auch für Admins). Preise in `server/utils/ai/pricing.js` (Anthropic-Liste; OpenAI ohne Preis → nur Token). Kurs USD→EUR einstellbar (`ai.config.usdToEur`, Default 0,86). Admin-Tab „KI“ → „Verbrauch und Kosten“ (`GET /api/admin/ai-usage`). Claude-Modelle ab Generation 5 laufen mit `effort: low` (spart Denk-Token). Zählung beginnt erst mit 2.2.3.
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
- **Sprachwechsel komplett (2.2.25):** `switchLanguage()` sichert den Stand der alten Sprache, ruft `resetLanguageBoundState()` (Daten, Runden-/Satz-Variablen aller Modi, Filter auf „Alle“, Eingaben, Timer, sprachgebundene Popups; `window._langEpoch` entwertet verzögerte Timer), `loadLanguageCache()` (Wörterbuch/Statistik/Sätze der neuen Sprache aus localStorage) und `rebuildViewForLanguage()`; danach stiller Serverabgleich. `loadDataFromServer`/`fetchGlobalBaseSentences` verwerfen Antworten, wenn sich `CURRENT_LANG` währenddessen geändert hat. Leerzustände (`showGrammarEmptyState`, Quiz/Schreiben/Karten/Drag&Drop) löschen den alten Satz/das Wort. Neue Runden-Variablen immer in `resetLanguageBoundState()` eintragen.
- **Basisliste Excel:** `parseBaseVocabRows()` erkennt Spalten an der Kopfzeile (Fremdsprache | Deutsch | Wortart | Emoji | Grammatik | Niveau). `Niveau` (A1–B2) wird ignoriert, solange `BaseVocabulary` kein Feld dafür hat; der Download enthält die Spalte leer. `routes/admin.js` übernimmt nur bekannte Felder.

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
- Die Kopien in `ios/App/App/public` und `android/app/src/main/assets/public` sind Build-Artefakte (in `.gitignore`, seit 2026-10-04 auch nicht mehr getrackt und aus der Historie entfernt). Für Mobile-Builds genügt `npx cap sync` – nichts davon committen.
- Lokales Git hat keine globale Identität – Commits mit `git -c user.name=boernie77 -c user.email=115419572+boernie77@users.noreply.github.com commit …`.

## Version 2.1.0 (2026-09-30)
- Einheitlich 2.1.0: `package.json`, `server/package.json`, `/api/health`, Web-Anzeige + „Neu“-Fenster (`hasSeenVersion_2_1_0`), Android versionCode 17, iOS Build 17.
- iOS `Info.plist` liest jetzt `$(MARKETING_VERSION)` / `$(CURRENT_PROJECT_VERSION)` – Version nur noch in `project.pbxproj` pflegen (vorher stand 2.0.6/16 fest in der Info.plist).
- Xcode-Scheme heißt „Vokabeln Multi“ (nur lokal unter xcshareddata, nicht im Repo).
- iOS-Signierung: bezahltes Team `SYQL3PUXA9` (im Projekt eingetragen). Die Bundle-ID `com.bernauer24.vokabeln` ist noch nicht ausdrücklich im bezahlten Team registriert, bisher greift das Wildcard-Profil. Beim ersten Archiv mit `-allowProvisioningUpdates` prüfen.
- Git-Tag + GitHub-Release `v2.1.0`. Noch NICHT bei Apple eingereicht. Live inzwischen durch 2.1.1 abgelöst.
