// Lokaler Speicher für den Betrieb ohne Server (Standalone-Modus).
// IndexedDB im Browser/der App, ein Arbeitsspeicher-Ersatz für Tests in Node (window.LocalStore bzw. require()).
// Alle Zugriffe sind asynchron. Schlüsselfelder: vocab.id, stats.vocabId, sentences.id, choices.sentenceId, meta.key
(function (root) {
    'use strict';

    const DB_NAME = 'lernapp-local';
    const DB_VERSION = 1;
    const STORES = { vocab: 'id', stats: 'vocabId', sentences: 'id', choices: 'sentenceId', meta: 'key' };

    function wrap(req) {
        return new Promise((resolve, reject) => {
            req.onsuccess = () => resolve(req.result);
            req.onerror = () => reject(req.error);
        });
    }

    function done(tx) {
        return new Promise((resolve, reject) => {
            tx.oncomplete = () => resolve();
            tx.onerror = () => reject(tx.error);
            tx.onabort = () => reject(tx.error || new Error('Transaktion abgebrochen'));
        });
    }

    function createIdbBackend(idb) {
        let dbPromise = null;
        const open = () => dbPromise || (dbPromise = new Promise((resolve, reject) => {
            const req = idb.open(DB_NAME, DB_VERSION);
            req.onupgradeneeded = () => {
                const db = req.result;
                for (const [name, keyPath] of Object.entries(STORES)) {
                    if (!db.objectStoreNames.contains(name)) db.createObjectStore(name, { keyPath });
                }
            };
            req.onsuccess = () => resolve(req.result);
            req.onerror = () => reject(req.error);
        }));
        const tx = async (store, mode) => (await open()).transaction(store, mode);

        return {
            async getAll(store) { return wrap((await tx(store, 'readonly')).objectStore(store).getAll()); },
            async get(store, key) { return wrap((await tx(store, 'readonly')).objectStore(store).get(key)); },
            async put(store, obj) { const t = await tx(store, 'readwrite'); t.objectStore(store).put(obj); return done(t); },
            async putMany(store, objs) {
                if (!objs.length) return;
                const t = await tx(store, 'readwrite');
                const os = t.objectStore(store);
                objs.forEach(o => os.put(o));
                return done(t);
            },
            async removeMany(store, keys) {
                if (!keys.length) return;
                const t = await tx(store, 'readwrite');
                const os = t.objectStore(store);
                keys.forEach(k => os.delete(k));
                return done(t);
            },
            async clear(store) { const t = await tx(store, 'readwrite'); t.objectStore(store).clear(); return done(t); },
            async destroy() {
                if (dbPromise) { (await dbPromise).close(); dbPromise = null; }
                await wrap(idb.deleteDatabase(DB_NAME));
            }
        };
    }

    function createMemoryBackend() {
        const data = {};
        Object.keys(STORES).forEach(s => { data[s] = new Map(); });
        const copy = (v) => (v === undefined ? undefined : JSON.parse(JSON.stringify(v)));
        return {
            async getAll(store) { return [...data[store].values()].map(copy); },
            async get(store, key) { return copy(data[store].get(key)); },
            async put(store, obj) { data[store].set(obj[STORES[store]], copy(obj)); },
            async putMany(store, objs) { objs.forEach(o => data[store].set(o[STORES[store]], copy(o))); },
            async removeMany(store, keys) { keys.forEach(k => data[store].delete(k)); },
            async clear(store) { data[store].clear(); },
            async destroy() { Object.keys(STORES).forEach(s => data[s].clear()); }
        };
    }

    // Kleine Hilfen für den Schlüssel/Wert-Speicher `meta`
    function withMeta(backend) {
        return Object.assign(backend, {
            async getMeta(key, fallback) {
                const row = await backend.get('meta', key);
                return row && row.value !== undefined ? row.value : fallback;
            },
            setMeta(key, value) { return backend.put('meta', { key, value }); }
        });
    }

    const api = {
        STORES,
        createIdbBackend: (idb) => withMeta(createIdbBackend(idb)),
        createMemoryBackend: () => withMeta(createMemoryBackend()),
        createDefault() {
            return withMeta(createIdbBackend(root.indexedDB));
        }
    };

    if (typeof module !== 'undefined' && module.exports) module.exports = api;
    else root.LocalStore = api;
})(typeof window !== 'undefined' ? window : globalThis);
