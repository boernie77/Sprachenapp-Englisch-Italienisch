# App Store – Einreichung (Stand 2026-11-08, Version 2.3.2 / Build 59 vorbereitet, noch nicht hochgeladen; 2.2.34 / Build 56 war zuletzt eingereicht)

**Status: am 2026-10-10 zur Prüfung eingereicht** (App Store Connect, App-ID 6821305339, SKU `vokabeln-sprachen-2026`). Veröffentlichung nach Freigabe **manuell**. Verfügbarkeit: 174 Länder, ohne Frankreich (Überseegebiete nicht gesondert ausgeschlossen). Preis: kostenlos. iPhone-Bilder wurden für App Store Connect auf 1206×2622 skaliert (`store-assets/*/iphone-6.3/`).

Alles, was für App Store Connect gebraucht wird. Screenshots liegen **außerhalb des Repos** in `~/Projekte/Neue_Lernapp/store-assets/{de,en}/{iphone-6.9,ipad-13}/` (7 Bilder je Satz, 1320×2868 bzw. 2064×2752, ohne Transparenz; erzeugt mit `store/tools/`).

## Allgemein
| Feld | Wert |
|---|---|
| Bundle-ID | `com.bernauer24.vokabeln` |
| Primäre Sprache | Deutsch (zusätzlich Englisch) |
| Kategorie | Primär **Bildung**, sekundär **Nachschlagewerke** |
| Preis | Gratis |
| **Verfügbarkeit** | **Alle Länder und Regionen außer Frankreich** (Wunsch des Betreibers) |
| Altersfreigabe | 4+ (keine Inhalte; optionale KI-Funktionen laufen mit eigenem Schlüssel des Nutzers – im Fragebogen „KI-generierte Inhalte“/offene Texteingabe ehrlich beantworten) |
| Exportbestimmungen | `ITSAppUsesNonExemptEncryption = false` ist in der Info.plist gesetzt (nur HTTPS des Betriebssystems) |
| Inhaltsrechte | Basislisten sind KI-erzeugt (siehe CLAUDE.md), Lizenz Apache-2.0 |
| Copyright | © 2026 Christian Bernauer |
| iPad | unterstützt (Hoch- und Querformat, Split View) |

## App-Datenschutz („Nährwertkennzeichen“)
**Stand 2026-10-10 (veröffentlicht): „Daten werden erfasst, nicht mit der Identität verknüpft“ – Datentyp Nutzerinhalte → Sonstige Nutzerinhalte, Zweck App-Funktionalität, kein Tracking.** Grund: Beim Anlegen einer neuen Vokabel, die nicht in der Basisliste steht, schickt die App das eingegebene Wort samt Sprachpaar (und technisch die IP-Adresse) an den Übersetzungsdienst MyMemory (translated.net). Sonst überträgt die App nichts; KI/Gespräch/Cloudstimme laufen nur mit dem eigenen Schlüssel des Nutzers direkt zum gewählten Anbieter (Gesprächsnachrichten sind ebenfalls „Sonstige Nutzerinhalte“, Angabe bleibt gleich). Spracheingabe: Aufnahmen verarbeitet das Betriebssystem (Apple), die App erhält nur Text und speichert nichts – in der Angabe nichts ändern, im Zweifel „Audiodaten“ nicht angeben, da der Entwickler sie nicht erfasst. Das Datenschutz-Manifest (`ios/App/App/PrivacyInfo.xcprivacy`) deklariert UserDefaults (CA92.1) und Dateizeitstempel (C617.1).

**Option für später:** Abfrage nur nach Einwilligung oder ganz abschalten (dann Angabe wieder auf „keine Daten erfasst“ ändern, neues Build nötig).

## Links (Platzhalter bis zur Veröffentlichung)
- Datenschutzerklärung (öffentliche Adresse, Pflicht): https://byboernie.de/lernapp-datenschutz.html (Englisch: `#en`); Quelle im Repo `~/Projekte/Homepage`, Text inhaltlich wie `server/public/legal-local.js` (bei Änderungen beide anpassen); Hosting: Hetzner-VPS `/var/www/byboernie.de/`, Upload per SCP
- Support-URL: https://byboernie.de/lernapp.html#support (Impressum: https://byboernie.de/impressum.html)
- Marketing-URL: https://byboernie.de/lernapp.html

## Hinweise für die App-Prüfung (App Review Information)
Kein Anmeldedaten nötig.


## Texte Deutsch (de)
**Name** (26/30): Vokabeln – Sprachen lernen

**Untertitel** (27/30): Vokabeln und Grammatik üben

**Werbetext** (145/170): Lerne Italienisch, Englisch und Spanisch mit Quiz, Karteikarten, Schreiben, Grammatiksätzen und Gespräch. Ohne Konto, ohne Werbung, auch offline.

**Stichwörter** (97/100): `Italienisch,Englisch,Spanisch,Karteikarten,Grammatik,Wortschatz,Quiz,Verben,Gespräch,Konversation`

**Neu in dieser Version** (261): Neu: Reiter „Gespräch“ – unterhalte dich schreibend oder sprechend mit einer KI auf Italienisch, Englisch oder Spanisch. Du bekommst Korrekturen und Erklärungen auf Deutsch und übernimmst Wörter mit einem Tipp ins Wörterbuch. Optional, mit eigenem KI-Schlüssel.

**Beschreibung** (2326/4000):

Vokabeln trainieren, Grammatik üben, Sprachen lernen – direkt auf deinem iPhone oder iPad, ohne Konto. Die Übungen laufen auch ohne Internet.

DREI SPRACHEN
Italienisch, Englisch und Spanisch (Spanien). Die Oberfläche gibt es auf Deutsch und Englisch.

FÜNF ÜBUNGSARTEN
• Drag & Drop: Wörter einander zuordnen
• Quiz: die richtige Übersetzung wählen
• Karteikarten: umdrehen, merken, wiederholen
• Schreiben: die Übersetzung selbst tippen
• Grammatik-Sätze: Lücken füllen, danach erklärt die App die Zeitform und zeigt Konjugationstabellen per Tipp aufs Verb

GLEICH LOSLEGEN
Über 3.500 Basis-Vokabeln und rund 8.900 Beispielsätze sind bereits in der App. Du kannst die Basisliste mit einem Tipp laden, eigene Vokabeln und Sätze ergänzen oder Excel-Listen importieren.

DEIN LERNSTAND
Lernstatistik pro Wort, Tagesaktivität und Lernserie zeigen, wo du stehst. Wörter und Sätze lassen sich einzeln aktivieren oder abwählen, mit Filtern nach Wortart und Grammatik.

GESPRÄCH MIT KI (OPTIONAL)
Schreibe oder sprich auf Italienisch, Englisch oder Spanisch, wähle Niveau und Thema und lass dir die Antworten vorlesen. Die App korrigiert deine letzte Nachricht auf Deutsch und erklärt die Fehler. Wörter aus dem Gespräch übernimmst du mit einem Tipp ins Wörterbuch, auf Wunsch übt die KI gezielt deine eigenen Wörter. Dafür brauchst du einen eigenen KI-Schlüssel; die Gespräche bleiben auf deinem Gerät. Die Spracheingabe nutzt die Spracherkennung des Geräts. KI-Antworten können Fehler enthalten.

SPRACHAUSGABE
Wörter und Sätze werden mit den Stimmen deines Geräts vorgelesen. Optional gibt es eine Cloudstimme mit deinem eigenen Zugang.

DATENSCHUTZ AN ERSTER STELLE
• Alle Daten bleiben auf deinem Gerät. Es gibt kein Konto, keine Werbung und kein Tracking.
• Sicherung und Wiederherstellung als Datei, jederzeit „Alle Daten löschen“.

OPTIONAL
• KI-Beispielsätze, Wortinfo, Gespräch und Cloudstimme: mit deinem eigenen API-Schlüssel eines KI-Anbieters deiner Wahl. Die Texte gehen direkt an den von dir gewählten Anbieter, dessen Preise und Datenschutzbestimmungen gelten. Der Schlüssel wird im Schlüsselbund des Geräts gespeichert.
• Eigener Server: Wer einen Lernapp-Server betreibt, kann sich damit verbinden und seinen Lernstand dort ablegen.

Die App ist freie Software (Apache-2.0). Fragen und Anregungen sind willkommen.

**Hinweise für die Prüfung:**

Die App benötigt kein Konto und keinen Server. Beim ersten Start „Ohne Server starten“ wählen, einen Namen eingeben und „Basisliste laden“ tippen – danach sind alle Übungsarten sofort nutzbar.

Optionale Funktionen (nicht nötig für die Prüfung): KI-Beispielsätze und Cloudstimme brauchen einen eigenen API-Schlüssel (Menü > KI & Stimme einrichten). Die Anbindung an einen eigenen Server (Menü > Daten & Server > Mit Server verbinden) ist für Betreiber gedacht, die einen Lernapp-Server selbst hosten; für die Prüfung ist sie nicht erforderlich.

Reiter „Gespräch“ (optional): KI-Unterhaltung, nur mit eigenem API-Schlüssel nutzbar (ohne Schlüssel weist die App darauf hin; für die Prüfung nicht nötig). Die Nachrichten gehen direkt an den vom Nutzer gewählten KI-Anbieter, nicht an den Entwickler; Gespräche werden nur auf dem Gerät gespeichert. Antworten tragen den Hinweis „KI kann sich irren“. Der Mikrofon-Knopf im Gespräch nutzt die Spracherkennung von iOS; die Erlaubnis für Mikrofon und Spracherkennung wird erst beim ersten Tippen abgefragt, es werden keine Aufnahmen gespeichert.

Es werden keine Nutzerdaten an den Entwickler übertragen. Verschlüsselung: nur die vom Betriebssystem bereitgestellte (HTTPS).

## Texte Englisch (en)
**Name** (28/30): Vocabulary – Learn Languages

**Untertitel** (26/30): Practice words and grammar

**Werbetext** (141/170): Learn Italian, English and Spanish with quiz, flashcards, writing, grammar sentences and conversation. No account, no ads, works offline too.

**Stichwörter** (92/100): `Italian,English,Spanish,flashcards,grammar,words,quiz,verbs,conversation,chat,speaking,study`

**Neu in dieser Version** (222): New: the “Conversation” tab – chat in writing or by voice with an AI in Italian, English or Spanish. Get corrections and explanations in German and add words to your dictionary with one tap. Optional, with your own AI key.

**Beschreibung** (2138/4000):

Train vocabulary, practise grammar, learn languages – right on your iPhone or iPad, with no account. The exercises work without internet.

THREE LANGUAGES
Italian, English and Spanish (Spain). The interface is available in German and English.

FIVE WAYS TO PRACTISE
• Drag & drop: match words with each other
• Quiz: choose the right translation
• Flashcards: flip, remember, repeat
• Writing: type the translation yourself
• Grammar sentences: fill the gaps, then the app explains the tense and shows conjugation tables with a tap on the verb

START RIGHT AWAY
More than 3,500 base words and about 8,900 example sentences are already in the app. Load the starter list with one tap, add your own words and sentences or import Excel lists.

YOUR PROGRESS
Per-word statistics, daily activity and your learning streak show where you stand. Words and sentences can be switched on or off individually, with filters for word type and grammar.

CONVERSATION WITH AI (OPTIONAL)
Write or speak in Italian, English or Spanish, choose level and topic and have the answers read aloud. The app corrects your last message in German and explains the mistakes. Add words from the conversation to your dictionary with one tap; on request the AI practises your own words. You need your own AI key; conversations stay on your device. Speech input uses your device's speech recognition. AI answers may contain mistakes.

SPEECH OUTPUT
Words and sentences are read aloud with your device's voices. Optionally there is a cloud voice with your own access.

PRIVACY FIRST
• All data stays on your device. There is no account, no advertising and no tracking.
• Backup and restore as a file, and "Delete all data" at any time.

OPTIONAL
• AI example sentences, word info, conversation and cloud voice: with your own API key from an AI provider of your choice. The texts go directly to the provider you chose; its prices and privacy terms apply. The key is stored in the device keychain.
• Your own server: if you run a Lernapp server you can connect to it and keep your progress there.

The app is free software (Apache-2.0). Questions and suggestions are welcome.

**Hinweise für die Prüfung:**

The app needs no account and no server. On first launch choose "Start without a server", enter a name and tap "Load starter list" – all exercise modes are then usable immediately.

Optional features (not needed for review): AI example sentences and the cloud voice require your own API key (menu > Set up AI & voice). Connecting to your own server (menu > Data & server > Connect to server) is meant for operators who host a Lernapp server themselves and is not required for review.

“Conversation” tab (optional): AI chat that works only with your own API key (without a key the app says so; not needed for review). Messages go directly to the AI provider chosen by the user, not to the developer; conversations are stored on the device only. Answers carry the note “AI can make mistakes”. The microphone button uses iOS speech recognition; the microphone and speech-recognition permission is only requested on first tap, and no recordings are stored.

No user data is transmitted to the developer. Encryption: only that provided by the operating system (HTTPS).

## Screenshots (je Sprache und Gerät, Reihenfolge)
1 Quiz · 2 Drag & Drop · 3 Karteikarten · 4 Grammatik-Sätze · 5 Lern-Statistik · 6 Vollständige Vokabelliste · 7 Daten & Server (Datenschutz/Offline)
- iPhone 6,9″ (iPhone 17 Pro Max, 1320×2868): `store-assets/{de,en}/iphone-6.9/`
- iPad 13″ (iPad Pro 13″ M5, 2064×2752): `store-assets/{de,en}/ipad-13/`

## Ablauf der Einreichung
1. Build: `npx cap sync ios` (ohne `app-config.local.js` im Ordner `server/public`, sonst fehlt die Startauswahl), `xcodebuild archive … -scheme "Vokabeln Multi"`, Upload mit `xcodebuild -exportArchive` (`method=app-store-connect`, `destination=upload`).
2. App Store Connect: App anlegen (Name, Bundle-ID, SKU), Texte/Screenshots je Sprache, Datenschutz-URL, App-Datenschutz „keine Daten“, Altersfreigabe, Preis/Verfügbarkeit (ohne Frankreich), Build auswählen, Hinweise für die Prüfung, zur Prüfung einreichen.
