// Gesprächsmodus (Oberfläche): Start, Gespräch mit Korrekturen, Verlauf.
// Eigenständig: bekommt alles Nötige von index.html über ChatUi.create(env) und baut seine Oberfläche in env.root.
// Alle Texte der KI und des Nutzers werden mit textContent gesetzt (kein HTML aus fremden Texten).
(function (root) {
    'use strict';

    const PREFS_KEY = 'lernapp-chat-prefs';

    const TEXT = {
        de: {
            start_title: 'Worüber sprechen wir?', start_sub: 'Die KI antwortet auf deinem Niveau und korrigiert dich.',
            topic: 'Thema', level: 'Niveau', practice: 'Meine Wörter üben', practice_sub: 'Baut Wörter aus deiner Liste ein',
            speak: 'Vorlesen', speak_sub: 'Antworten der KI werden gesprochen', own_topic: 'Eigenes Thema …', own_topic_ph: 'z. B. mein Hund',
            start: 'Gespräch starten', cost: 'Nutzt deinen KI-Schlüssel. Jede Nachricht kostet nur Bruchteile eines Cents.',
            recent: 'Letzte Gespräche', delete: 'Löschen', messages: '{0} Nachrichten', back: '‹ Zurück',
            translation: 'DE', translation_title: 'Übersetzung ein/aus', speak_title: 'Vorlesen ein/aus', play: 'Anhören',
            ph: 'Antwort schreiben …', send: 'Senden', thinking: 'Die KI antwortet …', all_ok: '✓ Alles richtig', tip: '💡',
            ai_note: 'KI kann sich irren. Bei Zweifeln bitte nachschlagen.',
            need_ai_title: 'Gespräch einrichten', need_ai: 'Für das Gespräch brauchst du einen KI-Schlüssel. Er bleibt auf deinem Gerät.',
            need_ai_btn: 'KI & Stimme einrichten', no_server: 'Das Gespräch ist auf diesem Server nicht freigegeben.',
            error: 'Fehler: {0}', topics: { travel: 'Reisen', daily: 'Alltag', food: 'Essen & Trinken', work: 'Arbeit' }, untitled: 'Gespräch'
        },
        en: {
            start_title: 'What shall we talk about?', start_sub: 'The AI answers at your level and corrects you.',
            topic: 'Topic', level: 'Level', practice: 'Practise my words', practice_sub: 'Works words from your list into the chat',
            speak: 'Read aloud', speak_sub: 'AI replies are spoken', own_topic: 'Own topic …', own_topic_ph: 'e.g. my dog',
            start: 'Start conversation', cost: 'Uses your AI key. Each message costs only a fraction of a cent.',
            recent: 'Recent conversations', delete: 'Delete', messages: '{0} messages', back: '‹ Back',
            translation: 'DE', translation_title: 'Translation on/off', speak_title: 'Read aloud on/off', play: 'Listen',
            ph: 'Write a reply …', send: 'Send', thinking: 'The AI is replying …', all_ok: '✓ All correct', tip: '💡',
            ai_note: 'The AI can be wrong. Please double-check when in doubt.',
            need_ai_title: 'Set up conversation', need_ai: 'You need an AI key for conversations. It stays on your device.',
            need_ai_btn: 'Set up AI & voice', no_server: 'Conversation is not enabled on this server.',
            error: 'Error: {0}', topics: { travel: 'Travel', daily: 'Daily life', food: 'Food & drink', work: 'Work' }, untitled: 'Conversation'
        }
    };

    const TOPIC_IDS = ['travel', 'daily', 'food', 'work'];
    // Thema für die KI (Englisch, so versteht es jedes Modell gleich)
    const TOPIC_PROMPT = { travel: 'travel and holidays', daily: 'everyday life', food: 'food and drinks', work: 'work and jobs' };
    const HELLO = { it: 'Ciao! ', en: 'Hi! ', es: '¡Hola! ' };
    const OPENER = {
        it: { travel: 'Ti piace viaggiare? Dove sei stato ultimamente?', daily: 'Com\'è andata la tua giornata?', food: 'Cosa ti piace mangiare?', work: 'Che lavoro fai?', free: 'Di cosa vuoi parlare?' },
        en: { travel: 'Do you like travelling? Where have you been lately?', daily: 'How was your day?', food: 'What do you like to eat?', work: 'What do you do for a living?', free: 'What would you like to talk about?' },
        es: { travel: '¿Te gusta viajar? ¿Dónde has estado últimamente?', daily: '¿Cómo ha ido tu día?', food: '¿Qué te gusta comer?', work: '¿A qué te dedicas?', free: '¿De qué te apetece hablar?' }
    };
    const LEVELS = ['A1', 'A2', 'B1', 'B2'];

    function newId() {
        try { if (root.crypto && root.crypto.randomUUID) return root.crypto.randomUUID().replace(/-/g, '').slice(0, 24); } catch (e) { /* weiter */ }
        return Array.from({ length: 24 }, () => Math.floor(Math.random() * 16).toString(16)).join('');
    }

    function create(env) {
        const doc = env.document || root.document;
        const st = { chat: null, messages: [], busy: false, availability: null, recents: [], prefs: loadPrefs(), shownLang: null };
        let view = null; // Elemente der laufenden Gesprächsansicht

        const lang = () => env.lang();
        const t = (key, ...args) => {
            const dict = TEXT[env.uiLang()] || TEXT.de;
            let s = dict[key] !== undefined ? dict[key] : TEXT.de[key];
            if (typeof s !== 'string') return key;
            args.forEach((v, i) => { s = s.replace('{' + i + '}', v); });
            return s;
        };
        const topicName = (id) => (TEXT[env.uiLang()] || TEXT.de).topics[id] || id;

        function loadPrefs() {
            const d = { level: 'A2', topic: 'travel', custom: '', practice: false, speak: true, showDe: false };
            try { return { ...d, ...JSON.parse(root.localStorage.getItem(PREFS_KEY) || '{}') }; } catch (e) { return d; }
        }
        function savePrefs() { try { root.localStorage.setItem(PREFS_KEY, JSON.stringify(st.prefs)); } catch (e) { /* Speicher nicht verfügbar */ } }

        function h(tag, cls, text, attrs) {
            const e = doc.createElement(tag);
            if (cls) e.className = cls;
            if (text !== undefined && text !== null) e.textContent = text;
            if (attrs) for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
            return e;
        }
        function clear() { env.root.textContent = ''; view = null; }

        // ---------------------------------------------------------------------------------
        // Verfügbarkeit
        // ---------------------------------------------------------------------------------
        async function checkAvailability() {
            try {
                if (env.isLocal) {
                    const o = await env.apiFetch('/ai/options');
                    return { ok: !!(o && o.enabled), reason: 'need_ai' };
                }
                const s = await env.apiFetch('/ai/chat-status');
                return { ok: !!(s && s.available), reason: 'no_server' };
            } catch (e) {
                return { ok: false, reason: env.isLocal ? 'need_ai' : 'no_server' };
            }
        }

        // ---------------------------------------------------------------------------------
        // Start
        // ---------------------------------------------------------------------------------
        async function show() {
            env.root.classList.toggle('show-de', !!st.prefs.showDe);
            if (st.chat && st.shownLang === lang() && view) { return; } // Gespräch läuft noch: so lassen
            if (st.chat && st.shownLang !== lang()) { st.chat = null; st.messages = []; }
            st.shownLang = lang();
            clear();
            env.root.appendChild(h('div', 'chat-status', '…'));
            st.availability = await checkAvailability();
            if (st.shownLang !== lang()) return;
            if (!st.availability.ok) return renderUnavailable();
            try { st.recents = await env.apiFetch('/chats'); } catch (e) { st.recents = []; }
            renderStart();
        }

        function hide() {
            env.stopSpeech();
            if (st.chat && st.messages.length > 1) save();
        }

        function renderUnavailable() {
            clear();
            const card = h('div', 'chat-card');
            card.appendChild(h('h2', '', t('need_ai_title')));
            card.appendChild(h('p', 'chat-sub', t(st.availability.reason)));
            if (st.availability.reason === 'need_ai') {
                const b = h('button', 'chat-btn', t('need_ai_btn'), { type: 'button' });
                b.style.marginTop = '1rem';
                b.addEventListener('click', () => env.openSettings());
                card.appendChild(b);
            }
            env.root.appendChild(card);
        }

        function seg(options, current, onPick) {
            const wrap = h('div', 'chat-seg');
            options.forEach(o => {
                const b = h('button', current === o ? 'on' : '', o, { type: 'button' });
                b.addEventListener('click', () => { onPick(o); wrap.querySelectorAll('button').forEach(x => x.classList.toggle('on', x === b)); });
                wrap.appendChild(b);
            });
            return wrap;
        }
        function switchRow(title, sub, key) {
            const row = h('div', 'chat-row');
            const txt = h('div');
            txt.appendChild(h('b', '', title));
            if (sub) txt.appendChild(h('div', 'chat-sub', sub));
            const sw = h('button', 'chat-switch', null, { type: 'button', role: 'switch', 'aria-checked': String(!!st.prefs[key]), 'aria-label': title });
            sw.addEventListener('click', () => { st.prefs[key] = !st.prefs[key]; sw.setAttribute('aria-checked', String(st.prefs[key])); savePrefs(); });
            row.append(txt, sw);
            return row;
        }

        function renderStart() {
            clear();
            const card = h('div', 'chat-card');
            card.appendChild(h('h2', '', t('start_title')));
            card.appendChild(h('div', 'chat-sub', t('start_sub')));

            card.appendChild(h('div', 'chat-label', t('topic')));
            const chips = h('div', 'chat-chips');
            const own = h('input', 'chat-input', null, { type: 'text', maxlength: '80', placeholder: t('own_topic_ph'), 'aria-label': t('own_topic') });
            own.value = st.prefs.custom || '';
            own.style.marginTop = '.5rem';
            own.style.display = st.prefs.topic === 'free' ? '' : 'none';
            own.addEventListener('input', () => { st.prefs.custom = own.value; savePrefs(); });
            [...TOPIC_IDS, 'free'].forEach(id => {
                const b = h('button', 'chat-chip' + (st.prefs.topic === id ? ' on' : ''), id === 'free' ? t('own_topic') : topicName(id), { type: 'button' });
                b.addEventListener('click', () => {
                    st.prefs.topic = id; savePrefs();
                    chips.querySelectorAll('.chat-chip').forEach(x => x.classList.toggle('on', x === b));
                    own.style.display = id === 'free' ? '' : 'none';
                    if (id === 'free') own.focus();
                });
                chips.appendChild(b);
            });
            card.append(chips, own);

            card.appendChild(h('div', 'chat-label', t('level')));
            card.appendChild(seg(LEVELS, st.prefs.level, (l) => { st.prefs.level = l; savePrefs(); }));
            card.appendChild(switchRow(t('practice'), t('practice_sub'), 'practice'));
            if (env.ttsAvailable()) card.appendChild(switchRow(t('speak'), t('speak_sub'), 'speak'));

            const go = h('button', 'chat-btn', t('start'), { type: 'button' });
            go.style.marginTop = '1.1rem';
            go.addEventListener('click', startChat);
            card.appendChild(go);
            if (env.isLocal) card.appendChild(h('div', 'chat-note', t('cost')));
            env.root.appendChild(card);

            if (st.recents.length) {
                const rc = h('div', 'chat-card');
                rc.style.marginTop = '.75rem';
                rc.appendChild(h('div', 'chat-label', t('recent')));
                rc.lastChild.style.marginTop = '0';
                st.recents.slice(0, 6).forEach(c => {
                    const row = h('div', 'chat-recent');
                    const open = h('button', 't', null, { type: 'button' });
                    open.append(h('b', '', c.title || c.topic || t('untitled')), h('span', '', `${c.level} · ${t('messages', c.messageCount)} · ${new Date(c.updatedAt).toLocaleDateString()}`));
                    open.addEventListener('click', () => resume(c.id));
                    const del = h('button', 'chat-link', t('delete'), { type: 'button' });
                    del.addEventListener('click', async () => {
                        try { await env.apiFetch('/chats/' + encodeURIComponent(c.id), { method: 'DELETE' }); } catch (e) { /* weiter */ }
                        st.recents = st.recents.filter(x => x.id !== c.id);
                        renderStart();
                    });
                    row.append(open, del);
                    rc.appendChild(row);
                });
                env.root.appendChild(rc);
            }
        }

        // ---------------------------------------------------------------------------------
        // Gespräch
        // ---------------------------------------------------------------------------------
        const topicLabel = () => (st.prefs.topic === 'free' ? (st.prefs.custom || '').trim() : topicName(st.prefs.topic));
        const topicForAi = () => (st.prefs.topic === 'free' ? (st.prefs.custom || '').trim() : TOPIC_PROMPT[st.prefs.topic]);

        function startChat() {
            const l = lang();
            const opener = (OPENER[l] || OPENER.en)[st.prefs.topic] || (OPENER[l] || OPENER.en).free;
            st.chat = { id: newId(), level: st.prefs.level, topic: topicLabel(), topicAi: topicForAi() };
            st.messages = [{ role: 'assistant', content: (HELLO[l] || '') + opener, greeting: true, ts: Date.now() }];
            renderChat();
            if (st.prefs.speak && env.ttsAvailable()) env.speak(st.messages[0].content, l);
        }

        async function resume(id) {
            try {
                const c = await env.apiFetch('/chats/' + encodeURIComponent(id));
                st.chat = { id: c.id, level: c.level, topic: c.topic, topicAi: c.topic };
                st.messages = c.messages || [];
                renderChat();
            } catch (e) { env.toast(e.message, 'error'); }
        }

        function renderChat() {
            clear();
            const wrap = h('div', 'chat-view');
            const bar = h('div', 'chat-bar');
            const back = h('button', 'chat-tool', t('back'), { type: 'button' });
            back.addEventListener('click', async () => { env.stopSpeech(); await save(); st.chat = null; st.messages = []; show(); });
            const title = h('b', '', [st.chat.topic, st.chat.level].filter(Boolean).join(' · '));
            const tools = h('div', 'chat-tools');
            const tr = h('button', 'chat-tool', t('translation'), { type: 'button', 'aria-pressed': String(!!st.prefs.showDe), title: t('translation_title') });
            tr.addEventListener('click', () => { st.prefs.showDe = !st.prefs.showDe; savePrefs(); tr.setAttribute('aria-pressed', String(st.prefs.showDe)); env.root.classList.toggle('show-de', st.prefs.showDe); });
            tools.appendChild(tr);
            if (env.ttsAvailable()) {
                const sp = h('button', 'chat-tool', '🔊', { type: 'button', 'aria-pressed': String(!!st.prefs.speak), title: t('speak_title') });
                sp.addEventListener('click', () => { st.prefs.speak = !st.prefs.speak; savePrefs(); sp.setAttribute('aria-pressed', String(st.prefs.speak)); if (!st.prefs.speak) env.stopSpeech(); });
                tools.appendChild(sp);
            }
            bar.append(back, title, tools);

            const log = h('div', 'chat-log', null, { 'aria-live': 'polite' });
            const status = h('div', 'chat-status');
            const compose = h('div', 'chat-compose');
            const input = h('textarea', '', null, { rows: '1', placeholder: t('ph'), maxlength: '1000', 'aria-label': t('ph') });
            const send = h('button', 'chat-btn', t('send'), { type: 'button' });
            input.addEventListener('input', () => { input.style.height = 'auto'; input.style.height = Math.min(input.scrollHeight, 112) + 'px'; });
            input.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); send.click(); } });
            send.addEventListener('click', () => submit());
            compose.append(input, send);
            wrap.append(bar, log, status, compose, h('div', 'chat-note', t('ai_note')));
            env.root.appendChild(wrap);
            view = { wrap, log, status, input, send };
            st.messages.forEach(m => log.appendChild(renderMessage(m)));
            scroll();
            input.focus({ preventScroll: true });
        }

        function scroll() { if (view) view.log.scrollTop = view.log.scrollHeight; }

        function renderMessage(m) {
            const e = h('div', 'chat-msg' + (m.role === 'user' ? ' me' : ''));
            e.appendChild(h('span', '', m.content));
            if (m.role === 'assistant') {
                if (env.ttsAvailable()) {
                    const p = h('button', 'chat-play', '🔊', { type: 'button', title: t('play'), 'aria-label': t('play') });
                    p.addEventListener('click', () => env.speak(m.content, lang()));
                    e.appendChild(p);
                }
                if (m.de) e.appendChild(h('div', 'de', m.de));
            } else if (m.checked) {
                if ((m.corrections || []).length) {
                    m.corrections.forEach(c => {
                        const box = h('div', 'chat-corr');
                        box.append(h('s', '', c.original), doc.createTextNode(' → '), h('strong', '', c.corrected), h('br'), doc.createTextNode(c.explanation_de));
                        e.appendChild(box);
                    });
                } else e.appendChild(h('div', 'chat-ok', t('all_ok')));
                if (m.tip) e.appendChild(h('div', 'chat-tip', t('tip') + ' ' + m.tip));
            }
            return e;
        }

        async function submit() {
            if (st.busy || !view) return;
            const text = view.input.value.trim();
            if (!text) return;
            st.busy = true;
            env.stopSpeech();
            view.send.disabled = true;
            view.input.value = ''; view.input.style.height = 'auto';
            view.status.textContent = t('thinking');
            view.status.className = 'chat-status';
            const userMsg = { role: 'user', content: text, ts: Date.now() };
            st.messages.push(userMsg);
            const userEl = renderMessage(userMsg);
            view.log.appendChild(userEl);
            scroll();
            try {
                const body = {
                    language: lang(), level: st.chat.level, topic: st.chat.topicAi || st.chat.topic,
                    practiceWords: st.prefs.practice ? env.practiceWords(lang()) : [],
                    messages: st.messages.filter(m => !m.greeting).map(m => ({ role: m.role, content: m.content }))
                };
                const r = await env.apiFetch('/ai/chat', { method: 'POST', body: JSON.stringify(body), timeoutMs: 90000 });
                userMsg.checked = true; userMsg.corrections = r.corrections || []; userMsg.tip = r.tip_de || '';
                const aiMsg = { role: 'assistant', content: r.reply, de: r.reply_de || '', newWords: r.new_words || [], ts: Date.now() };
                st.messages.push(aiMsg);
                userEl.replaceWith(renderMessage(userMsg));
                view.log.appendChild(renderMessage(aiMsg));
                view.status.textContent = '';
                scroll();
                save();
                if (st.prefs.speak && env.ttsAvailable()) env.speak(r.reply, lang());
            } catch (e) {
                st.messages.pop();
                userEl.remove();
                view.input.value = text;
                view.status.textContent = t('error', e.message || '');
                view.status.className = 'chat-error';
            } finally {
                st.busy = false;
                if (view) { view.send.disabled = false; view.input.focus({ preventScroll: true }); }
            }
        }

        async function save() {
            if (!st.chat || st.messages.filter(m => m.role === 'user').length === 0) return;
            const firstUser = st.messages.find(m => m.role === 'user');
            try {
                await env.apiFetch('/chats/' + encodeURIComponent(st.chat.id), {
                    method: 'PUT',
                    body: JSON.stringify({
                        language: lang(), level: st.chat.level, topic: st.chat.topic,
                        title: (firstUser.content || '').slice(0, 60), messages: st.messages
                    })
                });
            } catch (e) { /* Speichern ist Zusatz: das Gespräch läuft weiter */ }
        }

        return { show, hide, state: st };
    }

    const api = { create, TEXT };
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
    else root.ChatUi = api;
})(typeof window !== 'undefined' ? window : globalThis);
