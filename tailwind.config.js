// Erzeugt server/public/tailwind.css (Befehl: npm run build:css). Alle Klassen stehen als feste Texte in index.html
// und grammar-help.js, daher genügt das Durchsuchen dieser Dateien.
module.exports = {
    content: ['./server/public/index.html', './server/public/grammar-help.js'],
    theme: { extend: {} },
    plugins: []
};
