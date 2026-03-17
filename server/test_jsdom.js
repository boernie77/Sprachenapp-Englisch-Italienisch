const fs = require('fs');
const jsdom = require("jsdom");
const { JSDOM } = jsdom;

const html = fs.readFileSync('/Users/christian/Neue_Lernapp/sprachenapp-test/server/public/index.html', 'utf8');

const virtualConsole = new jsdom.VirtualConsole();
virtualConsole.on("error", (err) => {
    console.log("JSDOM ERROR:", err);
});
virtualConsole.on("jsdomError", (err) => {
    console.log("JSDOM JSDOM-Error:", err);
});
virtualConsole.on("log", (log) => {
    console.log("JSDOM LOG:", log);
});

const dom = new JSDOM(html, {
    url: "http://192.168.2.204:9009/",
    runScripts: "dangerously",
    resources: "usable",
    virtualConsole
});

// Mock important parts beforeDOMContentLoaded
dom.window.localStorage.setItem('ita-token', 'dummy-token');
dom.window.localStorage.setItem('ita-daily-activity-it', '{"bad":"json');
// Mock matching media for tailwind config
dom.window.matchMedia = dom.window.matchMedia || function() {
    return {
        matches: false,
        addListener: function() {},
        removeListener: function() {}
    };
};
// Mock Capacitor
dom.window.Capacitor = { isNative: false };
dom.window.fetch = async () => ({
    ok: true,
    json: async () => ({})
});

setTimeout(() => {
    console.log("Test finished.");
}, 2000);
