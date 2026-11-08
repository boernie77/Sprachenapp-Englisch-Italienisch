// Zugang zum Gesprächsmodus auf dem Server: standardmäßig aus.
// Zwei Bedingungen: (1) Serverschalter CHAT_ENABLED=true (Umgebungsvariable des Betreibers), (2) Freigabe des Nutzers (Admins gelten als freigegeben).
// Schlüssel und Kosten liegen ausschließlich beim Betreiber des Servers.
const serverEnabled = (env = process.env) => String(env.CHAT_ENABLED || '').trim().toLowerCase() === 'true';

const userMayChat = (user, env = process.env) => !!user && user.isActive !== false && serverEnabled(env) && (user.isAdmin === true || user.chatAllowed === true);

module.exports = { serverEnabled, userMayChat };
