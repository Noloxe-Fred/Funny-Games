// Source complémentaire de Steam (voir jeux.js) : résumés en anglais, mais
// jeux console et anciens absents de Steam.

const config = require('../../config');
const twitch = require('./twitch');

const GAMES_URL = 'https://api.igdb.com/v4/games';
const IMG_BASE = 'https://images.igdb.com/igdb/image/upload/t_cover_big_2x';

const CHAMPS = [
  'name',
  'summary',
  'first_release_date',
  'total_rating',
  'url',
  'cover.image_id',
  'genres.name',
  'platforms.abbreviation',
  'involved_companies.developer',
  'involved_companies.company.name',
].join(',');

const estConfigure = twitch.estConfigure;

async function igdbFetch(requete) {
  // IGDB s'authentifie avec le jeton d'application Twitch (voir twitch.js).
  const response = await twitch.fetchAuthentifie((jeton) =>
    fetch(GAMES_URL, {
      method: 'POST',
      headers: {
        'Client-ID': config.twitch.clientId,
        Authorization: `Bearer ${jeton}`,
        Accept: 'application/json',
      },
      body: requete,
    })
  );
  if (!response.ok) {
    throw new Error(`[IGDB] Erreur HTTP ${response.status} sur /games`);
  }
  return response.json();
}

/**
 * Normalise un jeu IGDB vers le format utilisé par le module. La recherche
 * demande déjà tous les champs : pas de second appel "détails" comme TMDB.
 */
function normalize(raw) {
  const developpeur = (raw.involved_companies || []).find((c) => c.developer)?.company?.name || null;

  return {
    id: raw.id,
    source: 'IGDB',
    titre: raw.name || 'Titre inconnu',
    // Timestamp Unix en secondes -> jour calendaire "AAAA-MM-JJ".
    dateSortie: raw.first_release_date ? new Date(raw.first_release_date * 1000).toISOString().slice(0, 10) : null,
    overview: raw.summary || 'Pas de description disponible.',
    // IGDB note sur 100, ramené sur 10 comme les fiches TMDB.
    note: typeof raw.total_rating === 'number' ? Math.round(raw.total_rating) / 10 : null,
    coverUrl: raw.cover?.image_id ? `${IMG_BASE}/${raw.cover.image_id}.jpg` : null,
    genres: (raw.genres || []).map((g) => g.name).filter(Boolean),
    plateformes: (raw.platforms || []).map((p) => p.abbreviation).filter(Boolean),
    developpeur,
    url: raw.url || null,
  };
}

/**
 * Recherche un jeu par titre. `version_parent = null` écarte les éditions
 * (GOTY, Deluxe...) qui doublonnent le jeu de base dans les résultats.
 */
async function rechercher(titre, { limit = 10 } = {}) {
  const recherche = titre.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
  const data = await igdbFetch(
    `fields ${CHAMPS}; search "${recherche}"; where version_parent = null; limit ${limit};`
  );
  return data.map(normalize);
}

module.exports = { estConfigure, rechercher };
