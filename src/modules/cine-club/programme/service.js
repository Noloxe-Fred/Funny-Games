// Programme des Séances Ciné en image : liste toutes les séances annoncées
// (cine-club-annonces) et les streams (stream-annonces) pas encore commencés, rendue en PNG (render.js) et
// affichée dans CINE_CLUB_CHANNEL_PROGRAMME_ID — une image d'en-tête puis une
// image par séance, empilées dans un seul message Components V2 (une galerie
// d'une image par bande, donc pleine largeur, l'une sous l'autre), édité sur
// place à chaque changement plutôt que reposté. Discord limite un message à
// 10 fichiers : au-delà, les images suivantes passent dans un 2e message.
//
// Mise à jour automatique : chaque branche de /cine, /stream (et leurs
// commandes de suppression) appelle rafraichirProgramme() dès la séance enregistrée, et un tick par
// minute rattrape le reste (séance commencée...). Les deux comparent la liste
// des séances à venir avec celle de la dernière publication (signature) et
// ne régénèrent que si elle a changé. Inactif tant que /programme-cine n'a
// pas été lancée une première fois.

const {
  AttachmentBuilder,
  MediaGalleryBuilder,
  MediaGalleryItemBuilder,
  MessageFlags,
  TextDisplayBuilder,
} = require('discord.js');
const config = require('../../../config');
const store = require('../store');
const streamStore = require('../../stream/store');
const { rendreProgramme, rendreProgrammeParSeance } = require('./render');

const INTERVALLE_MS = 60 * 1000;
const TIMEOUT_AFFICHE_MS = 10 * 1000;
// Discord réduit les images dans le salon : petite ligne sous la dernière
// image pour inviter à cliquer (dans le dernier message).
const TEXTE_AGRANDIR = "-# 🔍 Cliquez sur une image pour l'agrandir";
// Limite Discord de pièces jointes par message.
const IMAGES_PAR_MESSAGE = 10;
// Format des messages publiés : un état d'un autre format (ancienne version,
// un message par image) est supprimé et republié.
const FORMAT = 'galerie-v2';

// Une publication bloquée (appel Discord qui ne répond jamais...) ne doit
// pas geler la file indéfiniment : au-delà, la suivante passe quand même.
const TIMEOUT_PUBLICATION_MS = 3 * 60 * 1000;

// File d'attente : le tick et /programme-cine ne doivent jamais publier en
// même temps (sinon messages en double).
let file = Promise.resolve();
function enFile(tache) {
  const resultat = file.then(() => {
    let minuteur;
    const delai = new Promise((_, reject) => {
      minuteur = setTimeout(
        () => reject(new Error(`publication du programme bloquée depuis ${TIMEOUT_PUBLICATION_MS / 1000}s`)),
        TIMEOUT_PUBLICATION_MS
      );
    });
    return Promise.race([tache(), delai]).finally(() => clearTimeout(minuteur));
  });
  file = resultat.catch(() => {});
  return resultat;
}

// Séances /cine et streams /stream à venir, mêlés par date. La fiche d'un jeu
// est ramenée au format d'une fiche TMDB (posterUrl).
function annoncesAuProgramme() {
  const streams = streamStore.listAnnoncesAVenir().map((a) => ({
    ...a,
    mediaType: 'game',
    fiche: { ...a.fiche, posterUrl: a.fiche.coverUrl },
  }));
  return [...store.listAnnoncesAVenir(), ...streams].sort((a, b) => new Date(a.dateSeance) - new Date(b.dateSeance));
}

const LIBELLES_TYPE = { movie: 'Film', tv: 'Série', game: 'Jeu vidéo' };

// Tout ce qui est affiché change la signature : une séance supprimée puis
// reprogrammée au même créneau (même sessionKey) avec d'autres épisodes
// doit aussi régénérer l'image.
function signature(annonces) {
  return JSON.stringify(
    annonces.map((a) => [a.sessionKey, a.dateSeance, a.fiche && a.fiche.titre, a.fiche && a.fiche.posterUrl, a.episodes || null])
  );
}

async function telechargerAffiche(url) {
  if (!url) return null;
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT_AFFICHE_MS) });
    if (!response.ok) return null;
    return Buffer.from(await response.arrayBuffer());
  } catch (err) {
    console.error(`[SEANCES-CINE][PROGRAMME] Affiche inaccessible (${url}) :`, err.message);
    return null;
  }
}

function partiesDate(date) {
  const format = (options) =>
    new Intl.DateTimeFormat('fr-FR', { timeZone: 'Europe/Paris', ...options }).format(date);
  const jour = format({ weekday: 'long' });
  return {
    jour: jour.charAt(0).toUpperCase() + jour.slice(1),
    numero: format({ day: 'numeric' }),
    mois: format({ month: 'long' }),
    heure: format({ hour: '2-digit', minute: '2-digit' }).replace(':', 'h'),
  };
}

// Épisodes d'une séance série, affichés à la place du synopsis.
function preparerEpisodes(episodes) {
  if (!episodes || !episodes.liste.length) return null;
  const nb = episodes.liste.length;
  return {
    entete: `SAISON ${episodes.saison} · ${nb} ÉPISODE${nb > 1 ? 'S' : ''}`,
    lignes: episodes.liste.map((e) => `É${e.numero} · ${e.titre}`),
  };
}

async function preparerSeances(annonces) {
  return Promise.all(
    annonces.map(async (a) => ({
      titre: a.fiche.titre,
      type: LIBELLES_TYPE[a.mediaType] || 'Film',
      annee: a.fiche.dateSortie ? a.fiche.dateSortie.slice(0, 4) : null,
      synopsis: a.fiche.overview || '',
      episodes: preparerEpisodes(a.episodes),
      ...partiesDate(new Date(a.dateSeance)),
      afficheBuffer: await telechargerAffiche(a.fiche.posterUrl),
    }))
  );
}

async function supprimerMessages(client, channelId, ids) {
  if (!channelId || ids.length === 0) return;
  try {
    const channel = await client.channels.fetch(channelId);
    for (const id of ids) {
      await channel.messages.delete(id).catch(() => {});
    }
  } catch {
    // Salon supprimé ou inaccessible : rien à nettoyer.
  }
}

function piecesJointes(buffers) {
  return buffers.map((buf, i) => new AttachmentBuilder(buf, { name: `programme-seances-cine-${i + 1}.png` }));
}

// Contenu d'un message : ses images empilées (une galerie par image, pour
// qu'elles s'affichent en pleine largeur et non en mosaïque), et la ligne
// "Cliquez pour agrandir" sous la dernière image du programme.
function contenuMessage(fichiers, dernier) {
  const components = fichiers.map((f) =>
    new MediaGalleryBuilder().addItems(new MediaGalleryItemBuilder().setURL(`attachment://${f.name}`))
  );
  if (dernier) components.push(new TextDisplayBuilder().setContent(TEXTE_AGRANDIR));
  return { flags: MessageFlags.IsComponentsV2, components, files: fichiers };
}

function decouper(fichiers) {
  const lots = [];
  for (let i = 0; i < fichiers.length; i += IMAGES_PAR_MESSAGE) lots.push(fichiers.slice(i, i + IMAGES_PAR_MESSAGE));
  return lots;
}

/**
 * Édite les messages existants dans l'ordre, poste ceux qui manquent,
 * supprime ceux en trop. Lève une erreur si un message existant n'est plus
 * éditable (supprimé à la main...) — l'appelant repart alors de zéro.
 */
async function mettreAJourMessages(channel, anciensIds, fichiers) {
  const lots = decouper(fichiers);
  const ids = [];
  for (let i = 0; i < lots.length; i++) {
    const contenu = contenuMessage(lots[i], i === lots.length - 1);
    if (anciensIds[i]) {
      const message = await channel.messages.fetch(anciensIds[i]);
      await message.edit({ ...contenu, attachments: [] });
      ids.push(message.id);
    } else {
      const message = await channel.send(contenu);
      ids.push(message.id);
    }
  }
  for (const id of anciensIds.slice(lots.length)) {
    await channel.messages.delete(id).catch(() => {});
  }
  return ids;
}

/**
 * Rend le programme actuel (séances à venir) en images PNG. Partagé avec le
 * rappel hebdomadaire (rappel-hebdo.js). Renvoie { annonces, buffers }.
 */
async function genererImagesProgramme({ parSeance = false } = {}) {
  const annonces = annoncesAuProgramme();
  const rendre = parSeance ? rendreProgrammeParSeance : rendreProgramme;
  const buffers = await rendre(await preparerSeances(annonces));
  return { annonces, buffers };
}

/**
 * Régénère et publie le programme. `forcer` : supprime les anciennes images
 * et reposte tout (utilisé par /programme-cine). Renvoie
 * { seances, images }.
 */
function publierProgramme(client, { forcer = false } = {}) {
  return enFile(async () => {
    const channelId = config.cineClub.channelProgrammeId;
    if (!channelId) throw new Error("CINE_CLUB_CHANNEL_PROGRAMME_ID n'est pas défini dans .env.");
    const channel = await client.channels.fetch(channelId);

    // Salon programme : une image par séance (même échelle d'affichage
    // quel que soit le nombre de séances par image).
    const { annonces, buffers } = await genererImagesProgramme({ parSeance: true });

    const etat = store.getProgramme();
    let anciensIds = etat.messageIds || [];
    if (forcer || etat.channelId !== channelId || etat.format !== FORMAT) {
      // texteId : ligne "Cliquez pour agrandir" de l'ancien format (message à part).
      await supprimerMessages(client, etat.channelId, [...anciensIds, etat.texteId].filter(Boolean));
      anciensIds = [];
    }

    let messageIds;
    try {
      messageIds = await mettreAJourMessages(channel, anciensIds, piecesJointes(buffers));
    } catch (err) {
      console.warn('[SEANCES-CINE][PROGRAMME] Messages existants non éditables, republication complète :', err.message);
      await supprimerMessages(client, channelId, anciensIds);
      messageIds = await mettreAJourMessages(channel, [], piecesJointes(buffers));
    }

    store.setProgramme({ channelId, format: FORMAT, messageIds, signature: signature(annonces) });
    return { seances: annonces.length, images: buffers.length };
  });
}

/**
 * Republie si la liste des séances à venir a changé depuis la dernière
 * publication (sans rien faire tant que /programme-cine n'a jamais été
 * lancée). Ne lève jamais : renvoie true si le programme a été republié,
 * false sinon (rien à faire ou erreur, loguée). À appeler juste après
 * avoir ajouté/supprimé une séance, pour ne pas attendre le tick.
 */
async function rafraichirProgramme(client) {
  const etat = store.getProgramme();
  if (!etat.messageIds || etat.messageIds.length === 0) return false; // jamais lancé
  // Ancien format (un message par image) : republié dans le nouveau dès le
  // premier tick, même sans changement de séances.
  if (etat.format === FORMAT && signature(annoncesAuProgramme()) === etat.signature) return false;

  try {
    await publierProgramme(client);
    return true;
  } catch (err) {
    console.error('[SEANCES-CINE][PROGRAMME] Mise à jour du programme impossible :', err);
    return false;
  }
}

/**
 * Tick par minute : rattrape les changements non signalés (séance qui
 * commence, publication immédiate ratée...). À appeler une seule fois au
 * démarrage.
 */
function demarrerSchedulerProgramme(client) {
  setInterval(() => rafraichirProgramme(client), INTERVALLE_MS);
}

module.exports = { genererImagesProgramme, publierProgramme, rafraichirProgramme, demarrerSchedulerProgramme };
