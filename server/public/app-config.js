// Voreinstellung für die Apps: Adresse des Lernapp-Servers.
// Leer lassen = beim ersten Start trägt der Nutzer die Server-Adresse selbst ein (Open-Source-Standard).
// Eigene Builds können die Adresse vorbelegen, ohne sie ins Repository zu schreiben:
// Datei "app-config.local.js" neben dieser anlegen (steht in .gitignore) mit
//   window.APP_CONFIG = { defaultServerUrl: 'https://lernapp.example.com' };
window.APP_CONFIG = { defaultServerUrl: '' };
