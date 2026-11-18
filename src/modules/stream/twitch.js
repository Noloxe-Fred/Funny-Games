// Authentification et appels à l'API Twitch, partagés par IGDB (igdb.js) et
// l'alerte de live (live.js) : les deux utilisent la même application Twitch.

const config = require('../../config');

const TOKEN_URL = 'https://id.twitch.tv/oauth2/token';
const HELIX_URL = 'https://api.twitch.tv/helix';
const MARGE_EXPIRATION_MS = 60 * 1000;

// Jeton d'application Twitch, gardé en mémoire : il dure environ 60 jours et
// s'obtient en un appel, inutile de le persister.
let jeton = null;

function estConfigure() {
  return Boolean(config.twitch.clientId && config.twitch.clientSecret);
}

async function obtenirJeton() {
  if (jeton && jeton.expireA > Date.now()) return jeton.valeur;

  const { clientId, clientSecret } = config.twitch;
  if (!clientId || !clientSecret) {
    throw new Error('TWITCH_CLIENT_ID / TWITCH_CLIENT_SECRET ne sont pas définis dans .env.');
  }

  const url = new URL(TOKEN_URL);
  url.searchParams.set('client_id', clientId);
  url.searchParams.set('client_secret', clientSecret);
  url.searchParams.set('grant_type', 'client_credentials');

  const response = await fetch(url.toString(), { method: 'POST' });
  if (!response.ok) {
    throw new Error(`[TWITCH] Erreur HTTP ${response.status} à l'obtention du jeton`);
  }
  const data = await response.json();
  jeton = {
    valeur: data.access_token,
    expireA: Date.now() + data.expires_in * 1000 - MARGE_EXPIRATION_MS,
  };
  return jeton.valeur;
}

/**
 * Envoie une requête authentifiée (Client-ID + Bearer). `construire(jeton)`
 * renvoie la promesse fetch : rejouée une fois avec un nouveau jeton si
 * Twitch l'a révoqué avant son expiration annoncée (401).
 */
async function fetchAuthentifie(construire) {
  let response = await construire(await obtenirJeton());
  if (response.status === 401) {
    jeton = null;
    response = await construire(await obtenirJeton());
  }
  return response;
}

/** GET sur l'API Helix, `params` = liste de paires [clé, valeur] (clés répétables). */
async function helix(chemin, params = []) {
  const url = new URL(`${HELIX_URL}/${chemin}`);
  for (const [cle, valeur] of params) url.searchParams.append(cle, valeur);

  const response = await fetchAuthentifie((valeur) =>
    fetch(url.toString(), {
      headers: { 'Client-ID': config.twitch.clientId, Authorization: `Bearer ${valeur}` },
      signal: AbortSignal.timeout(15000),
    })
  );
  if (!response.ok) {
    throw new Error(`[TWITCH] Erreur HTTP ${response.status} sur /${chemin}`);
  }
  return (await response.json()).data || [];
}

module.exports = { estConfigure, fetchAuthentifie, helix };
