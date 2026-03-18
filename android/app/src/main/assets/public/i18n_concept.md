# Konzept: Internationalisierung (i18n) der App-Oberfläche

Dieses Konzept beschreibt die Einführung einer Sprachumschaltung für die Benutzeroberfläche der App (Deutsch/Englisch), unabhängig von der gewählten Lernsprache.

## 1. Technischer Ansatz

### Sprach-Zustand (App UI Language)
*   Einführung einer neuen Variable `APP_UI_LANG` (Standardsprache: `de`).
*   Speicherung der Auswahl im `localStorage` (z.B. `ita-ui-lang`), damit die Wahl bei Neustart oder Refresh erhalten bleibt.
*   Trennung von `CURRENT_LANG` (Lerninhalt: IT/EN) und `APP_UI_LANG` (App-Texte: DE/EN).

### Zentrales Translation-Dictionary
Alle Texte werden in einem JavaScript-Objekt strukturiert abgelegt:
```javascript
const UI_TRANSLATIONS = {
    de: {
        menu_stats: "Statistik",
        menu_add_vocab: "Vokabel hinzufügen",
        toast_save_success: "Erfolgreich gespeichert.",
        confirm_delete_all: "Möchtest du wirklich alle löschen?",
        // ... (hunderte weitere Keys)
    },
    en: {
        menu_stats: "Statistics",
        menu_add_vocab: "Add Vocabulary",
        toast_save_success: "Successfully saved.",
        confirm_delete_all: "Are you sure you want to delete everything?",
        // ...
    }
};
```

### Automatische Update-Logik
*   Alle statischen HTML-Elemente erhalten ein Attribut: `<button data-i18n="menu_stats">Statistik</button>`.
*   Eine Funktion `applyTranslations()` geht beim Sprachwechsel alle Elemente mit `data-i18n` durch und ersetzt den `textContent`.
*   JavaScript-Hilfsfunktionen wie `showToast(msgKey)` werden so angepasst, dass sie primär den Key aus dem Dictionary ziehen.

---

## 2. Benutzeroberfläche (UI)

### Erweiterung des Hamburger-Menüs
Im bestehenden Dropdown-Menü wird ein neuer Bereich "App-Sprache" hinzugefügt:
*   **Ort**: Unterhalb von "Impressum & Lizenzen", oberhalb von "Abmelden".
*   **Design**: Zwei Buttons nebeneinander oder ein Untermenü mit Flaggen/Text.
*   **Interaktion**: Beim Klick auf eine Flagge wird `APP_UI_LANG` geändert und `applyTranslations()` aufgerufen.

---

## 3. Migrationsplan (Vorgehensweise)

Aufgrund der Größe der App (10k+ Zeilen) erfolgt die Umsetzung in Phasen:

1.  **Phase 1: Fundament**: Einbau des Dictionaries und der `applyTranslations`-Logik. Addition des Menüpunktes.
2.  **Phase 2: Menü & Header**: Umstellung des Hauptmenüs und der Kopfzeile auf das neue System.
3.  **Phase 3: JavaScript-Dialoge**: Systematisches Ersetzen von hartcodierten Strings in `showToast`, `showConfirm` und Modalen.
4.  **Phase 4: Vollausbau**: Umstellung aller restlichen Modale (Admin, Excel-Verwaltung, Vollständige Listen).

---

## 4. Beispiele für Übersetzungen (Auszug)

| Bereich | Deutsch (Voreinstellung) | Englisch (Neu) |
| :--- | :--- | :--- |
| **Menü** | Vokabelliste | Vocabulary List |
| **Quiz** | Überprüfen | Check |
| **Kartei** | Ich wusste es | I knew it |
| **Allgemein** | Laden... | Loading... |
| **Dialoge** | Abbrechen | Cancel |

---

> [!NOTE]
> Da wir bereits viele SVG-Icons nutzen, könnten wir die Flaggen 🇩🇪 und 🇬🇧 als visuelle Unterstützung nutzen, um den Wechsel intuitiv zu gestalten.
