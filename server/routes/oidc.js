const express = require('express');
const jwt = require('jsonwebtoken');
const { Issuer, generators } = require('openid-client');
const { User } = require('../models');
const { JWT_SECRET } = require('../middleware/auth');

const router = express.Router();

let _clientPromise;
function getClient() {
  if (!_clientPromise) {
    if (!process.env.OIDC_ISSUER_URL || !process.env.OIDC_CLIENT_ID || !process.env.OIDC_CLIENT_SECRET) {
      return Promise.reject(new Error('OIDC nicht konfiguriert (OIDC_ISSUER_URL/CLIENT_ID/CLIENT_SECRET fehlt)'));
    }
    _clientPromise = (async () => {
      const issuer = await Issuer.discover(process.env.OIDC_ISSUER_URL);
      const appUrl = process.env.APP_URL || 'http://localhost:3001';
      return new issuer.Client({
        client_id: process.env.OIDC_CLIENT_ID,
        client_secret: process.env.OIDC_CLIENT_SECRET,
        redirect_uris: [`${appUrl}/api/auth/oidc/callback`],
        response_types: ['code']
      });
    })().catch(err => { _clientPromise = null; throw err; });
  }
  return _clientPromise;
}

const pendingStates = new Map();
const STATE_TTL_MS = 5 * 60 * 1000;

function gcStates() {
  const now = Date.now();
  for (const [k, v] of pendingStates) {
    if (now - v.created > STATE_TTL_MS) pendingStates.delete(k);
  }
}

router.get('/login', async (req, res) => {
  try {
    const client = await getClient();
    const state = generators.state();
    const nonce = generators.nonce();
    const code_verifier = generators.codeVerifier();
    const code_challenge = generators.codeChallenge(code_verifier);
    pendingStates.set(state, { nonce, code_verifier, created: Date.now() });
    gcStates();
    res.redirect(client.authorizationUrl({
      scope: 'openid email profile', state, nonce, code_challenge, code_challenge_method: 'S256'
    }));
  } catch (err) {
    console.error('[oidc] /login error:', err.message);
    res.status(500).json({ error: `OIDC login failed: ${err.message}` });
  }
});

router.get('/callback', async (req, res) => {
  const appUrl = process.env.APP_URL || 'http://localhost:3001';
  const fail = (msg) => res.redirect(`${appUrl}/?sso_error=${encodeURIComponent(msg)}`);
  try {
    const client = await getClient();
    const params = client.callbackParams(req);
    const stateInfo = pendingStates.get(params.state);
    if (!stateInfo) return fail('SSO-State abgelaufen');
    pendingStates.delete(params.state);

    const tokens = await client.callback(`${appUrl}/api/auth/oidc/callback`, params, {
      state: params.state, nonce: stateInfo.nonce, code_verifier: stateInfo.code_verifier
    });
    const claims = tokens.claims();
    const email = claims.email;
    const sub = claims.sub;
    if (!email) return fail('OIDC-Claim email fehlt');

    let user = await User.findOne({ where: { oidcSubject: sub } });
    if (!user) {
      user = await User.findOne({ where: { email } });
      if (!user) return fail(`Kein Lernapp-Konto fuer ${email} gefunden. Admin um Einladung bitten.`);
      user.oidcSubject = sub;
      await user.save();
    }
    if (user.isActive === false) return fail('Konto deaktiviert');

    user.loginCount = (user.loginCount || 0) + 1;
    user.lastLogin = new Date();
    await user.save();

    const token = jwt.sign({ id: user.id, email: user.email, isAdmin: user.isAdmin }, JWT_SECRET, { expiresIn: '24h' });
    const payload = {
      token,
      id: user.id,
      isAdmin: user.isAdmin,
      name: user.name,
      dailyActivity: user.dailyActivity || {}
    };
    const encoded = Buffer.from(JSON.stringify(payload)).toString('base64url');
    res.redirect(`${appUrl}/#sso=${encoded}`);
  } catch (err) {
    console.error('[oidc] /callback error:', err.message);
    return fail(`SSO fehlgeschlagen: ${err.message}`);
  }
});

module.exports = router;
