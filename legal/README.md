# Impressum und Datenschutz

Kopiere die Vorlagen und fülle sie aus:

    cp legal/impressum.example.html legal/impressum.html
    cp legal/datenschutz.example.html legal/datenschutz.html

`impressum.html` und `datenschutz.html` werden vom Server unter `GET /api/legal` ausgeliefert und in der App im Menü
„Impressum & Lizenzen“ angezeigt. Beide Dateien sind von Git ausgeschlossen (`.gitignore`). Im Docker-Stack wird dieser Ordner
nach `/legal` eingebunden.
