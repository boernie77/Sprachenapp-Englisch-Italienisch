// Übertragung zwischen dem lokalen Speicher der App und einem Server-Konto.
//  - pushToServer: lokalen Lernstand in das Konto übernehmen (nichts wird überschrieben oder gelöscht: neue Wörter werden angelegt,
//    bei vorhandenen gewinnt der neuere Lernstand je Wort, die Tagesaktivität nimmt je Tag den größeren Wert)
//  - pullFromServer: Serverdaten auf das Gerät kopieren (ersetzt den lokalen Lernstand)
// `api(endpoint, options)` ist apiFetch() der App (liefert JSON, wirft bei Fehlern); `local` ist LocalApi.create(...).
(function (root) {
    'use strict';

    const LANGUAGES = ['it', 'en', 'es'];
    const USER_SENTENCE_START = 1000000; // selbst erzeugte KI-Sätze im lokalen Speicher
    const CHUNK = 500;
    const PARALLEL = 4;

    const norm = (t) => String(t == null ? '' : t).trim().toLowerCase();
    const keyOf = (v) => `${v.typ === 'Satz' ? 'S' : 'V'}|${norm(v.it)}|${norm(v.de)}`;
    const time = (d) => (d ? new Date(d).getTime() || 0 : 0);
    const hasStat = (s) => !!s && (s.presented > 0 || s.correct > 0 || s.incorrect > 0 || s.streak > 0 || s.lastReviewedDate || s.nextReviewDate);
    const statBody = (s) => ({
        presented: s.presented || 0, correct: s.correct || 0, incorrect: s.incorrect || 0, streak: s.streak || 0,
        lastReviewedDate: s.lastReviewedDate || null, nextReviewDate: s.nextReviewDate || null
    });

    // Der neuere Lernstand gewinnt (wie beim Abgleich in der App): späteres Datum, bei Gleichstand mehr Wiederholungen
    function localWins(local, server) {
        if (!server) return true;
        const l = time(local.lastReviewedDate), s = time(server.lastReviewedDate);
        return l > s || (l === s && (local.presented || 0) > (server.presented || 0));
    }

    async function inParallel(items, fn) {
        let next = 0;
        const worker = async () => { while (next < items.length) { const i = next++; await fn(items[i], i); } };
        await Promise.all(Array.from({ length: Math.min(PARALLEL, items.length) }, worker));
    }

    // Wörter und selbst erzeugte KI-Sätze eines lokalen Datenbestands (Ergebnis von exportData) je Sprache
    function localItems(data, language) {
        const stats = new Map((data.stats || []).map(s => [s.vocabId, s]));
        const items = (data.vocab || []).filter(v => !v.deleted && v.language === language)
            .map(v => ({ ...v, stat: stats.get(v.id) || null }));
        const ki = (data.sentences || []).filter(s => !s.deleted && s.language === language && s.id >= USER_SENTENCE_START)
            .map(s => ({ de: s.de, it: s.it, typ: 'Satz', grammatica: s.category || null, level: s.level || null, forWord: s.forWord || null, isOwn: true, isActive: true, isMarked: false, stat: null }));
        return [...items, ...ki];
    }

    async function pushToServer({ data, api, onProgress = () => { } }) {
        const result = { created: 0, merged: 0, stats: 0, skipped: 0 };
        for (const language of LANGUAGES) {
            const items = localItems(data, language);
            if (!items.length) continue;
            onProgress({ language, step: 'read', total: items.length });
            const server = await api(`/vocab?language=${language}`);
            const byKey = new Map(server.map(v => [keyOf(v), v]));
            const seen = new Set();
            const toCreate = [];
            const statJobs = []; // { id, stat }
            for (const item of items) {
                const k = keyOf(item);
                if (seen.has(k)) { result.skipped++; continue; }
                seen.add(k);
                const sv = byKey.get(k);
                if (sv) {
                    result.merged++;
                    const serverStat = sv.Stat || sv.Stats || sv.Statistic || null;
                    if (hasStat(item.stat) && localWins(item.stat, serverStat)) statJobs.push({ id: sv.id, stat: item.stat });
                } else toCreate.push(item);
            }
            for (let i = 0; i < toCreate.length; i += CHUNK) {
                const chunk = toCreate.slice(i, i + CHUNK);
                const created = await api('/vocab/bulk', {
                    method: 'POST',
                    body: JSON.stringify({
                        language,
                        words: chunk.map(v => ({ de: v.de, it: v.it, typ: v.typ, emoji: v.emoji, grammatica: v.grammatica, level: v.level, forWord: v.forWord,
                            isActive: v.isActive, isMarked: v.isMarked, isOwn: v.isOwn, language }))
                    })
                });
                created.forEach((c, j) => { if (chunk[j] && hasStat(chunk[j].stat)) statJobs.push({ id: c.id, stat: chunk[j].stat }); });
                result.created += created.length;
                onProgress({ language, step: 'create', done: Math.min(i + CHUNK, toCreate.length), total: toCreate.length });
            }
            await inParallel(statJobs, async (job) => {
                await api(`/vocab/${job.id}/stats`, { method: 'PUT', body: JSON.stringify(statBody(job.stat)) });
                result.stats++;
            });
        }
        const activity = (data.meta || []).find(m => m.key === 'dailyActivity');
        if (activity && activity.value && Object.keys(activity.value).length) {
            await api('/auth/daily-activity', { method: 'PUT', body: JSON.stringify(activity.value) });
        }
        const nameRow = (data.meta || []).find(m => m.key === 'name');
        if (nameRow && nameRow.value) {
            const me = await api('/auth/me').catch(() => null);
            if (me && !me.name) await api('/auth/profile', { method: 'PUT', body: JSON.stringify({ name: nameRow.value }) });
        }
        return result;
    }

    async function pullFromServer({ local, api, onProgress = () => { } }) {
        const vocab = [];
        for (const language of LANGUAGES) {
            onProgress({ language, step: 'read' });
            (await api(`/vocab?language=${language}`)).forEach(v => vocab.push({ ...v, language }));
        }
        const me = await api('/auth/me').catch(() => ({}));
        return local.replaceUserData({ vocab, dailyActivity: me.dailyActivity || {}, name: me.name || null });
    }

    const api = { pushToServer, pullFromServer, localItems, keyOf, localWins, LANGUAGES };
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
    else root.LocalSync = api;
})(typeof window !== 'undefined' ? window : globalThis);
