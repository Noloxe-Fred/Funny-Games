const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  MessageFlags,
  GuildScheduledEventEntityType,
  GuildScheduledEventPrivacyLevel,
} = require('discord.js');
const config = require('../../../config');
const tmdb = require('../tmdb');
const store = require('../store');
const { rafraichirProgramme } = require('../programme/service');
const { formatJourFr, atHeure } = require('../dateUtils');
const {
  attendreClic,
  selectionnerDansWatchlist,
  demanderTitreTmdb,
  choisirResultatTmdb,
  demanderJour,
  demanderSalonVocal,
  demanderHeure,
  demanderMessagePersonnalise,
  buildSeanceContainer,
  programmerRappels,
} = require('../service');

/**
 * Publie une séance film "normale" dans CINE_CLUB_CHANNEL_ID : event Discord
 * natif (best-effort), carte séance avec bouton "Je serai présent", rappel
 * H-1, historique (retire le titre de la watchlist) et mise à jour immédiate
 * du programme en image. Utilisée par la Séance Libre et par la clôture des
 * Séances programmées (sans interaction, d'où `guild` en paramètre).
 * Lève une erreur si le salon d'annonce est introuvable.
 */
async function publierSeanceFilm({ guild, tmdbId, mediaType, dateSeance, salonVocalId, annonceTexte, source }) {
  const targetChannelId = config.cineClub.channelId;
  const salonAnnonce = await guild.channels.fetch(targetChannelId).catch(() => null);
  if (!salonAnnonce) throw new Error(`Salon d'annonce introuvable (ID ${targetChannelId})`);

  const roleId = config.cineClub.roles.seancesCine;
  const fiche = await tmdb.getDetails(tmdbId, mediaType);

  let eventId = null;
  try {
    const evenement = await guild.scheduledEvents.create({
      name: `Séances Ciné : ${fiche.titre}`,
      scheduledStartTime: dateSeance,
      scheduledEndTime: new Date(dateSeance.getTime() + 150 * 60 * 1000),
      privacyLevel: GuildScheduledEventPrivacyLevel.GuildOnly,
      entityType: GuildScheduledEventEntityType.Voice,
      channel: salonVocalId,
      description: fiche.overview.slice(0, 950),
    });
    eventId = evenement.id;
  } catch (err) {
    console.error("[SEANCES-CINE] Impossible de créer l'événement Discord natif :", err);
  }

  const mention = roleId ? `<@&${roleId}> ` : '';
  const sessionKey = `${fiche.mediaType}:${fiche.tmdbId}:${dateSeance.getTime()}`;

  store.setAnnonce(sessionKey, {
    mediaType: fiche.mediaType,
    tmdbId: fiche.tmdbId,
    dateSeance: dateSeance.toISOString(),
    salonVocalId,
    channelId: targetChannelId,
    fiche,
    mention,
    annonceTexte,
    roleId,
    guildId: guild.id,
    eventId,
  });

  const container = buildSeanceContainer({
    sessionKey,
    mediaType: fiche.mediaType,
    dateSeance,
    salonVocalId,
    fiche,
    presentsCount: 0,
    mention,
    annonceTexte,
    guildId: guild.id,
    eventId,
  });

  const messageAnnonce = await salonAnnonce.send({ flags: MessageFlags.IsComponentsV2, components: [container] });
  store.majAnnonce(sessionKey, { messageId: messageAnnonce.id });

  programmerRappels({
    sessionKey,
    channelId: targetChannelId,
    roleId,
    titre: fiche.titre,
    dateSeance,
  });

  store.addToHistorique({
    tmdbId: fiche.tmdbId,
    mediaType: fiche.mediaType,
    titre: fiche.titre,
    dateVu: dateSeance.toISOString(),
    posterUrl: fiche.posterUrl,
    source,
  });

  // Programme en image à jour tout de suite (sans attendre le tick).
  rafraichirProgramme(guild.client);

  return { sessionKey, fiche, channelId: targetChannelId, messageId: messageAnnonce.id };
}

/**
 * Branche "Séance Libre" de /cine — programme un film à une date libre
 * parmi les 3 prochaines semaines (à partir d'aujourd'hui, voir demanderJour), à une heure
 * libre. Film choisi soit dans la watchlist, soit via une recherche TMDB
 * libre. Mentionne le rôle Séances Ciné (CINE_CLUB_ROLE_SEANCES_CINE_ID).
 */
async function runSeanceLibreWizard(interaction, message) {
  await interaction.editReply({
    content: '🗓️ **Séance Libre** — comment choisir le film ?',
    components: [
      new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('cinelibre_source_watchlist').setLabel('🎯 Watchlist').setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId('cinelibre_source_tmdb').setLabel('🔎 Recherche TMDB').setStyle(ButtonStyle.Primary)
      ),
    ],
  });

  let clicSource;
  try {
    clicSource = await attendreClic(message, interaction.user.id, ['cinelibre_source_watchlist', 'cinelibre_source_tmdb']);
  } catch {
    return interaction.editReply({ content: '⌛ Temps écoulé, commande annulée.', components: [] });
  }

  let elu; // { tmdbId, mediaType }

  if (clicSource.customId === 'cinelibre_source_watchlist') {
    await clicSource.deferUpdate();
    const watchlist = store.listWatchlist({ mediaType: 'movie' });
    const choix = await selectionnerDansWatchlist(interaction, message, watchlist);
    if (choix.length === 0) return; // message d'erreur déjà posté par le sélecteur
    elu = choix[0];
  } else {
    // Recherche TMDB : la modale doit être la toute première réponse à ce
    // clic, donc pas de deferUpdate() avant demanderTitreTmdb().
    const titre = await demanderTitreTmdb(interaction, clicSource, message, { label: 'Film à diffuser' });
    if (!titre) return;

    await interaction.editReply({ content: 'Recherche en cours...', components: [] });
    const resultats = await tmdb.searchMulti(titre, { limit: 10 });
    if (resultats.length === 0) {
      return interaction.editReply({ content: `❌ Aucun résultat TMDB pour "${titre}".`, components: [] });
    }
    const choisi = await choisirResultatTmdb(interaction, message, resultats);
    if (!choisi) return; // message d'erreur/timeout déjà posté par choisirResultatTmdb
    elu = choisi;
  }

  const jourChoisi = await demanderJour(interaction, message);
  if (!jourChoisi) return; // message d'erreur/timeout déjà posté par demanderJour

  const heureChoisie = await demanderHeure(interaction, message, {
    defaut: '20h45',
    label: `l'heure de diffusion (${formatJourFr(jourChoisi)})`,
    jour: jourChoisi,
  });
  if (!heureChoisie) return; // message d'erreur/timeout déjà posté par demanderHeure
  const dateSeance = atHeure(jourChoisi, heureChoisie.heure, heureChoisie.minute);

  const salonVocalId = await demanderSalonVocal(interaction, message);
  if (!salonVocalId) return; // message d'erreur/timeout déjà posté

  const annonceTexte = await demanderMessagePersonnalise(interaction, message, {
    defaut: `Séance Ciné programmée pour ${formatJourFr(jourChoisi).toLowerCase()} !`,
  });
  if (!annonceTexte) return; // message d'erreur/timeout déjà posté par demanderMessagePersonnalise

  let channelId;
  try {
    ({ channelId } = await publierSeanceFilm({
      guild: interaction.guild,
      tmdbId: elu.tmdbId,
      mediaType: elu.mediaType,
      dateSeance,
      salonVocalId,
      annonceTexte,
      source: 'libre',
    }));
  } catch (err) {
    console.error('[SEANCES-CINE] Publication de la Séance Libre impossible :', err);
    return interaction.editReply({ content: `❌ ${err.message}`, components: [] });
  }

  await interaction.editReply({ content: `✅ Annonce postée dans <#${channelId}> !`, components: [] });
}

module.exports = { runSeanceLibreWizard, publierSeanceFilm };
