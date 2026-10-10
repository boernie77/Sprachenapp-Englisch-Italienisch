#!/bin/bash
# Web-Demo der Lernapp: die aktuelle App (server/public) läuft ohne Server im Browser (lokaler Modus, Daten bleiben im Browser).
# Aufruf: scripts/deploy-demo.sh [--build-only]
# Ergebnis: https://byboernie.de/demo/ (Datei /var/www/byboernie.de/demo/ auf dem VPS). app.html der Homepage leitet dorthin weiter.
# Voraussetzung: SSH-Key ~/.ssh/emailrelay_vps; Impressum liegt in ~/Projekte/Homepage/impressum.html (wird gelesen, nicht verändert).
set -euo pipefail
cd "$(dirname "$0")/.."
OUT="${TMPDIR:-/tmp}/lernapp-demo-build"
rm -rf "$OUT"; mkdir -p "$OUT"
rsync -a --exclude '*conflicted copy*' --exclude '*.md' --exclude 'app-config.local.js' server/public/ "$OUT/"

# absolute Adressen im Kopf der Seite relativ machen (Demo liegt in /demo/)
sed -i.bak -e 's#href="/favicon.png"#href="favicon.png"#' -e 's#href="/apple-touch-icon.png"#href="apple-touch-icon.png"#' -e 's#href="/manifest.json"#href="manifest.json"#' "$OUT/index.html"
rm -f "$OUT/index.html.bak"

# Demo-Konfiguration: immer ohne Server; Impressum der Website
IMPRESSUM_FILE="${IMPRESSUM_FILE:-$HOME/Projekte/Homepage/impressum.html}"
node - "$OUT" "$IMPRESSUM_FILE" <<'NODE'
const fs = require('fs');
const [out, impFile] = process.argv.slice(2);
let imp = '<p>Anbieter: siehe <a href="../impressum.html">Impressum</a>.</p>';
try {
  const h = fs.readFileSync(impFile, 'utf8');
  const m = h.match(/<main[\s\S]*?<\/main>/);
  if (m) imp = m[0].replace(/<\/?main[^>]*>/g, '').replace(/<h1[^>]*>[\s\S]*?<\/h1>/, '').replace(/ class="[^"]*"/g, '');
} catch (e) { /* Standardtext */ }
fs.writeFileSync(`${out}/app-config.local.js`,
  `// Web-Demo (byboernie.de/demo): immer im lokalen Modus, alle Daten bleiben im Browser\ntry { localStorage.setItem('lernapp-mode', 'local'); } catch (e) { /* ohne Speicher: normaler Betrieb */ }\nwindow.APP_CONFIG = Object.assign({}, window.APP_CONFIG, { impressumHtml: ${JSON.stringify(imp)} });\n`);
NODE

echo "Demo gebaut: $OUT ($(du -sh "$OUT" | cut -f1))"
[ "${1:-}" = "--build-only" ] && exit 0
ssh -i ~/.ssh/emailrelay_vps root@178.104.130.161 'mkdir -p /var/www/byboernie.de/demo'
rsync -a --delete -e "ssh -i $HOME/.ssh/emailrelay_vps" "$OUT/" root@178.104.130.161:/var/www/byboernie.de/demo/
echo "Hochgeladen: https://byboernie.de/demo/"
