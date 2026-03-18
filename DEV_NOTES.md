# Projekt-Konfiguration & Anforderungen (Gedächtnisstütze für AI)

Dieses Dokument dient dazu, wichtige Projektdaten und spezifische Benutzeranforderungen sitzungsübergreifend zu speichern.

## Testumgebung
- **Testserver**: http://192.168.2.204:9009
- **Benutzer**: christian.bernauer@imail.de
- **Passwort**: #!Alex2019

## Spezifische UI-Anforderungen
- **Karteikarten-Modus (Flashcards)**:
    - Die globalen Beispielsatz-Umschalter (Desktop: `#exampleToggleDesktopWrapper`, Mobile: `#toggleExampleSentencesBtnMobile`) in der Kopfzeile müssen **AUSGEBLENDET** werden.
    - Der Button **„Beispielsatz anzeigen“** (`#cardsShowExampleBtn`) innerhalb der Flashcard-Box muss **SICHTBAR** bleiben.
- **Header**: Keine Versionsanzeige mehr (wird nur im Hamburgermenü angezeigt).

## Datenverwaltung
- **Vollständige Satzliste**: Muss Dubletten zwischen Basis-Sätzen (`allBaseSentences`) und eigenen Sätzen (`fullDictionary`) filtern (deduplicate in `renderSentenceList`).

## Deployment
- Nach Änderungen in `server/public/index.html` immer `npx cap sync` ausführen, um Android und iOS zu aktualisieren.
- Neue Builds als `.aab` im Hauptverzeichnis ablegen (z.B. `app-release-v2.0.5-v15-fixed.aab`).
