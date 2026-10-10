// Erzeugt ~/Projekte/Homepage/lernapp-datenschutz.html (Datenschutzerklärung der App, de + en) aus server/public/legal-local.js
// im Stil von nopaper-datenschutz.html. Danach per SCP auf den Server (/var/www/byboernie.de/) hochladen.
const fs = require('fs');
const path = require('path');
const HOME = process.env.HOMEPAGE_DIR || path.join(process.env.HOME, 'Projekte/Homepage');
const L = require('../server/public/legal-local.js');
const nop = fs.readFileSync(path.join(HOME, 'nopaper-datenschutz.html'), 'utf8');
const head = nop.slice(0, nop.indexOf('<main'));
const foot = nop.slice(nop.indexOf('</main>') + '</main>'.length);
const h = head.replace('Datenschutzerklärung App NoPaper | byboernie.de', 'Datenschutzerklärung App Vokabeln | byboernie.de')
  .replace('Datenschutzerklärung für die App NoPaper (inoffizielle App für Paperless-ngx).', 'Datenschutzerklärung für die App „Vokabeln – Sprachen lernen“ (iPhone und iPad).');
const f = foot.replace('<li><a href="nopaper.html#support">NoPaper-Support</a></li>', '<li><a href="lernapp.html#support">Lernapp-Support</a></li>');
const strip = (html) => html.replace(/<h3 class="[^"]*">/g, '<h2>').replace(/<\/h3>/g, '</h2>').replace(/ class="[^"]*"/g, '').replace(/<div>|<\/div>/g, '');
const de = strip(L.de)
  .replace('<p>Die Angaben zum Anbieter dieser App stehen im Impressum.</p>', '<p>Christian Bernauer<br>Dianastr. 2b<br>90547 Stein<br>E-Mail: <a href="mailto:christian@bernauer24.com">christian@bernauer24.com</a></p>')
  .replace(/<h2>9\. Deine Rechte<\/h2><p>[\s\S]*?<\/p>/, '<h2>9. Deine Rechte</h2><p>Du hast im Rahmen der gesetzlichen Bestimmungen das Recht auf Auskunft (Art. 15 DSGVO), Berichtigung (Art. 16), Löschung (Art. 17), Einschränkung der Verarbeitung (Art. 18), Widerspruch (Art. 21) und Beschwerde bei einer Aufsichtsbehörde (Art. 77). Zuständige Aufsichtsbehörde ist das Bayerische Landesamt für Datenschutzaufsicht (BayLDA), Promenade 18, 91522 Ansbach.</p><p>Da der Anbieter der App über die App keine personenbezogenen Daten von dir erhält (abgesehen vom technischen Abruf beim Übersetzungsdienst, siehe Abschnitt 5, für den dieser Dienst verantwortlich ist), betreffen diese Rechte gegenüber dem Anbieter in der Regel nur Kontaktanfragen per E-Mail. Für Daten auf einem von dir verbundenen Server wende dich an dessen Betreiber.</p>')
  .replace('Verantwortlich dafür ist der Betreiber dieses Servers, dessen Datenschutzhinweise du in der App unter „Impressum &amp; Lizenzen“ findest.', 'Verantwortlich dafür ist der Betreiber dieses Servers, dessen Datenschutzhinweise du in der App unter „Impressum &amp; Lizenzen“ findest. Für den vom Anbieter betriebenen Server gilt die <a href="datenschutz.html">Datenschutzerklärung dieser Website</a>.');
const en = strip(L.en)
  .replace('<p>Details about the provider of this app are given in the legal notice.</p>', '<p>Christian Bernauer<br>Dianastr. 2b<br>90547 Stein, Germany<br>Email: <a href="mailto:christian@bernauer24.com">christian@bernauer24.com</a></p>');
const ind = (t) => t.split('\n').map(l => '            ' + l).join('\n');
const body = `<main class="container legal-content">
        <h1>Datenschutzerklärung für die App „Vokabeln – Sprachen lernen“</h1>
        <p><a href="#en">English version below</a></p>
        <section>
${ind(de)}
            <p>Informationen zur App findest du auf der <a href="lernapp.html">Projektseite der Lernapp</a>. Die Datenschutzerklärung für diese Website findest du unter <a href="datenschutz.html">Datenschutz</a>.</p>
            <p><em>Stand: Oktober 2026</em></p>
        </section>

        <section id="en">
            <h1 style="margin-top:4rem">Privacy policy – app “Vocabulary – Learn Languages”</h1>
${ind(en)}
            <p><em>Last updated: October 2026</em></p>
        </section>
    </main>`;
fs.writeFileSync(path.join(HOME, 'lernapp-datenschutz.html'), h + body + f);
console.log('lernapp-datenschutz.html geschrieben');
