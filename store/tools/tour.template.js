// NUR FÜR SCREENSHOTS (Test-Build, nie committen): bereitet Daten vor und schaltet durch die Ansichten.
(function () {
    var UI = '__UI__';
    localStorage.setItem('lernapp-mode', 'local');
    localStorage.setItem('ita-ui-lang', UI);
    localStorage.setItem('ita-user-name', 'Christian');
    localStorage.setItem('hasSeenVersion_2_2_32', 'true');
    localStorage.setItem('lernapp-tts', JSON.stringify({ enabled: true }));
    var wait = function (ms) { return new Promise(function (r) { setTimeout(r, ms); }); };
    var mark = function (n) { console.log('SCENE-' + n); };
    var click = function (id) { var e = document.getElementById(id); if (e) e.click(); };
    window.addEventListener('load', async function () {
        try {
            await wait(2500);
            var existing = await apiFetch('/vocab');
            if (existing.length === 0) {
                var base = await apiFetch('/base-vocab?language=it');
                await apiFetch('/vocab/bulk', { method: 'POST', body: JSON.stringify({ language: 'it', words: base.map(function (v) { return { de: v.de, it: v.it, typ: v.typ, emoji: v.emoji, grammatica: v.grammatica, language: 'it', isOwn: false }; }) }) });
                var all = await apiFetch('/vocab');
                var now = Date.now();
                for (var i = 0; i < 160; i++) {
                    var presented = 3 + (i * 7) % 10, correct = Math.max(1, presented - (i % 4));
                    await apiFetch('/vocab/' + all[i].id + '/stats', { method: 'PUT', body: JSON.stringify({ presented: presented, correct: correct, incorrect: presented - correct, streak: 1 + (i % 6), lastReviewedDate: new Date(now - (i % 9) * 86400000).toISOString(), nextReviewDate: new Date(now + (i % 5) * 86400000).toISOString() }) });
                }
                var act = {};
                for (var d = 0; d < 21; d++) { act[new Date(now - d * 86400000).toISOString().slice(0, 10)] = d % 8 === 6 ? 0 : 18 + ((d * 13) % 37); }
                await apiFetch('/auth/daily-activity', { method: 'PUT', body: JSON.stringify(act) });
                await apiFetch('/auth/profile', { method: 'PUT', body: JSON.stringify({ name: 'Christian' }) });
            }
            if (!localStorage.getItem('tour_seeded')) { localStorage.setItem('tour_seeded', '1'); return; } // erster Start: nur Daten vorbereiten
            await wait(3000);
            var scenes = [
                ['dragdrop', function () { closeAllModals(); click('modeDragDropBtn'); }],
                ['quiz', function () { click('modeQuizBtn'); }],
                ['cards', function () { click('modeCardsBtn'); }],
                ['write', function () { click('modeWriteBtn'); }],
                ['grammar', function () { click('modeGrammarBtn'); }],
                ['stats', function () { click('showStatsBtn'); }],
                ['vocablist', function () { closeAllModals(); click('openVocabListModalBtn'); }],
                ['ai', function () { closeAllModals(); click('openLocalAiBtn'); }],
                ['data', function () { closeAllModals(); window.openLocalDataModal(); }]
            ];
            for (var s = 0; s < scenes.length; s++) {
                closeAllModals(); scenes[s][1]();
                await wait(6000);
            }
        } catch (e) { console.log('TOUR-ERROR ' + e.message); }
    });
})();
