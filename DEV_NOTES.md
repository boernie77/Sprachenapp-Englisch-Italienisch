# Projekt-Konfiguration & Anforderungen (Gedächtnisstütze für AI)

Dieses Dokument dient dazu, wichtige Projektdaten und spezifische Benutzeranforderungen sitzungsübergreifend zu speichern.

## Testumgebung
- **Testserver**: http://192.168.2.204:9009
- **Benutzer**: ENTFERNT
- **Passwort**: ENTFERNT

## Spezifische UI-Anforderungen
- **Karteikarten-Modus (Flashcards)**:
    - Die globalen Beispielsatz-Umschalter (Desktop: `#exampleToggleDesktopWrapper`, Mobile: `#toggleExampleSentencesBtnMobile`) in der Kopfzeile müssen **AUSGEBLENDET** werden.
    - Der Button **„Beispielsatz anzeigen“** (`#cardsShowExampleBtn`) innerhalb der Flashcard-Box muss **SICHTBAR** bleiben.
    - Beispielsatz-Popups in Karteikarten sind **nur manuell** (darf den Flow nicht blockieren).
- **Header**: Keine Versionsanzeige mehr (wird nur im Hamburgermenü angezeigt).
- **Immersion-Regel**: Verbzeiten (z. B. *Presente*, *Passato Prossimo*, bei Spanisch *Pretérito perfecto*) in der Zusatzinfo bleiben **immer in der Lernsprache** (Italienisch, Spanisch), unabhängig von der App-Sprache.
- **Beispielsätze (allgemein)**:
    - Popups erscheinen automatisch nach Erfolg in: Drag & Drop, Quiz, Schreiben.
    - Toggles/Buttons im Header werden **blau**, wenn aktiv.

## Performance & Sicherheit
- **Suche (Satzliste)**: 
    - Debounce von **300ms** beim Tippen.
    - Standard-Limit auf **200 Treffer** (mit „Alle anzeigen“-Button zur Umgehung).
    - Hinweis: „Bitte Suche verfeinern“ bei > 200 Treffern.
- **Daten-Import**: 
    - Downloads/Uploads großer Mengen (> 500) erfolgen in **Chunks von 500**.
    - Toast-Meldungen: „Ladevorgang gestartet...“ / „Löschvorgang gestartet...“ sofort anzeigen.
- **Basis-Sätze**: Sind für normale User **schreibgeschützt** (Edit/Delete Buttons in der Liste ausblenden/deaktivieren).
- **Grammatik-Filter**: Werden dynamisch aus den Excel-Daten generiert (unterstützt `+` für Mehrfach-Tags, z. B. „Gerundio + ...“).

## Datenverwaltung
- **Vollständige Satzliste**: Muss Dubletten zwischen Basis-Sätzen (`allBaseSentences`) und eigenen Sätzen (`fullDictionary`) filtern (deduplicate in `renderSentenceList`).
- **Sprach-Trennung**: Grammatik-Fokus-Dropdowns müssen Strikt nach `CURRENT_LANG` getrennt sein.

## Deployment
- Nach Änderungen in `server/public/index.html` immer `npx cap sync` ausführen, um Android und iOS zu aktualisieren.
- **Design-Regel**: Der Dunkelmodus muss in den Apps und der schmalen Browseransicht (max-width: 1024px) immer konsequent eingehalten werden.
- **Icon-Regel**: Nur Icons verwenden (z. B. Standard-Emojis), die auf Mobilgeräten (iOS/Android) plattformübergreifend zuverlässig funktionieren.
- Neue Builds als `.aab` im Hauptverzeichnis ablegen (z.B. `app-release-v2.0.5-v15-FINAL.aab`).

## Spanisch (seit 2.2.25)
- **Dialekt:** Spanien (es-ES, Anrede *vosotros*). Lateinamerika steht nur als Hinweis im Info-Bereich.
- **Akzente:** Schreibmodus ist akzenttolerant (fehlender Akzent = richtig, Hinweis „Achte auf den Akzent.“); `ñ` und `ü` sind eigene Buchstaben. Grammatiklücken sind streng: nur ein fehlender Akzent meldet „Fast – nur der Akzent fehlt.“ Spanische Eingabefelder bekommen `lang="es"`, `autocapitalize`/`autocorrect`/`spellcheck` aus und eine Akzentleiste (á é í ó ú ü ñ ¿ ¡, nur bei Lernsprache es).
- **Icon-Regel:** Flaggen als SVG (nie als Flaggen-Emoji, die unter Windows nicht erscheinen).
- **Neue Sprache hinzufügen:** `server/utils/languages.js`, `LANG_CONFIG`/`SUPPORTED_LANGS` und die `*_xx`-Schlüssel in `index.html`, `ARTICLES` in `utils/ai/autoGenerate.js`, Kategorien in `utils/ai/grammar.js`.
