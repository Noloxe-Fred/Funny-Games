const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder,
  MessageFlags,
} = require('discord.js');
const config = require('../../../config');
const { requireStreamerRole } = require('../../../core/permissions');
const store = require('../store');
const tmdb = require('../tmdb');
const { atHeure, formatJourFr, parseHeure, prochainsJours } = require('../dateUtils');
const { attendreClic, buildFicheContainer, demanderSalonVocal } = require('../service');
const { publierSeanceFilm } = require('./seance-libre');

// Limites Discord : 10 réponses max par sondage, 55 caractères par réponse,
// durée entre 1h et 32 jours (768h), 25 options max par menu de sélection.
const MAX_REPONSES_SONDAGE = 10;
const MAX_TEXTE_REPONSE = 55;
const DUREE_MAX_H = 768;
const TAILLE_PAGE = 25;

const NB_JOURS_PROPOSES = 22; // mêmes jours que la Séance Libre : aujourd'hui + 3 semaines
const HORAIRES = ['19h30', '20h', '20h30', '21h', '21h30'];

// Bouton persistant "Clôturer le vote" sur le message d'introduction :
// `cineprog_clore:<id du vote>`, dispatché par le registre (voir index.js).
const PREFIXE_CLORE = 'cineprog_clore';
const MAX_ESSAIS = 5;

function tronquer(texte, max) {
  return texte.length <= max ? texte : `${texte.slice(0, max - 1)}…`;
}

function cle(entree) {
  return `${entree.mediaType}:${entree.tmdbId}`;
}

/**
 * Étape 1 : jours proposés au vote (plusieurs cochables, 10 max).
 * Renvoie les dates choisies (00:00, triées), ou null (annulation/timeout,
 * message déjà posté).
 */
async function choisirJours(interaction, message) {
  const jours = prochainsJours(NB_JOURS_PROPOSES);
  const select = new StringSelectMenuBuilder()
    .setCustomId('cineprog_jours')
    .setPlaceholder('Jours à proposer')
    .setMinValues(1)
    .setMaxValues(MAX_REPONSES_SONDAGE)
    .addOptions(
      jours.map((j, i) => ({ label: `${i === 0 ? "Aujourd'hui — " : ''}${formatJourFr(j)}`, value: String(i) }))
    );

  await interaction.editReply({
    content: `📊 **Séances programmées** — quels jours proposer au vote ? (${MAX_REPONSES_SONDAGE} max)`,
    components: [new ActionRowBuilder().addComponents(select)],
  });

  let clic;
  try {
    clic = await attendreClic(message, interaction.user.id, ['cineprog_jours'], 300_000);
  } catch {
    await interaction.editReply({ content: '⌛ Temps écoulé, commande annulée.', components: [] });
    return null;
  }
  await clic.deferUpdate();
  return clic.values.map(Number).sort((a, b) => a - b).map((i) => jours[i]);
}

/**
 * Étape 2 : films de la watchlist proposés au vote (plusieurs cochables,
 * 10 max au total). Sélecteur paginé : la sélection de chaque page est
 * conservée quand on navigue, "Valider" termine.
 * Renvoie les entrées choisies, ou null (annulation/timeout/watchlist vide,
 * message déjà posté).
 */
async function choisirFilms(interaction, message) {
  const entrees = store
    .listWatchlist({ mediaType: 'movie' })
    .sort((a, b) => a.titre.localeCompare(b.titre, 'fr', { sensitivity: 'base' }));

  if (entrees.length === 0) {
    await interaction.editReply({ content: '❌ La watchlist ne contient aucun film, commande annulée.', components: [] });
    return null;
  }

  const nbPages = Math.ceil(entrees.length / TAILLE_PAGE);
  const choisis = new Map(); // cle -> entrée
  let page = 0;
  let avertissement = '';

  while (true) {
    const pageEntrees = entrees.slice(page * TAILLE_PAGE, (page + 1) * TAILLE_PAGE);
    const select = new StringSelectMenuBuilder()
      .setCustomId('cineprog_films')
      .setPlaceholder('Films à proposer')
      .setMinValues(0)
      .setMaxValues(Math.min(pageEntrees.length, MAX_REPONSES_SONDAGE))
      .addOptions(
        pageEntrees.map((e) => ({ label: e.titre.slice(0, 100), value: cle(e), default: choisis.has(cle(e)) }))
      );

    const boutons = [];
    if (nbPages > 1) {
      boutons.push(
        new ButtonBuilder().setCustomId('cineprog_prev').setLabel('◀️ Précédent').setStyle(ButtonStyle.Secondary).setDisabled(page === 0),
        new ButtonBuilder().setCustomId('cineprog_next').setLabel('Suivant ▶️').setStyle(ButtonStyle.Secondary).setDisabled(page >= nbPages - 1)
      );
    }
    boutons.push(
      new ButtonBuilder()
        .setCustomId('cineprog_films_ok')
        .setLabel('✅ Valider')
        .setStyle(ButtonStyle.Success)
        .setDisabled(choisis.size === 0)
    );

    const recap = choisis.size
      ? [...choisis.values()].map((e) => `• ${e.titre}`).join('\n')
      : '_Aucun film coché._';
    await interaction.editReply({
      content:
        `🎬 Quels films proposer ? (${MAX_REPONSES_SONDAGE} max — un seul film = pas de sondage sur le film)` +
        `${nbPages > 1 ? `  ·  page ${page + 1}/${nbPages}` : ''}\n${avertissement}${recap}`,
      components: [new ActionRowBuilder().addComponents(select), new ActionRowBuilder().addComponents(boutons)],
    });
    avertissement = '';

    let clic;
    try {
      clic = await attendreClic(
        message,
        interaction.user.id,
        ['cineprog_films', 'cineprog_prev', 'cineprog_next', 'cineprog_films_ok'],
        300_000
      );
    } catch {
      await interaction.editReply({ content: '⌛ Temps écoulé, commande annulée.', components: [] });
      return null;
    }
    await clic.deferUpdate();

    if (clic.customId === 'cineprog_films_ok') return [...choisis.values()];
    if (clic.customId === 'cineprog_prev') page = Math.max(0, page - 1);
    else if (clic.customId === 'cineprog_next') page = Math.min(nbPages - 1, page + 1);
    else {
      // La sélection de cette page remplace celle qu'elle avait avant.
      const autres = [...choisis.entries()].filter(([k]) => !pageEntrees.some((e) => cle(e) === k));
      if (autres.length + clic.values.length > MAX_REPONSES_SONDAGE) {
        avertissement = `⚠️ ${MAX_REPONSES_SONDAGE} films maximum, sélection non prise en compte.\n`;
        continue;
      }
      choisis.clear();
      for (const [k, e] of autres) choisis.set(k, e);
      for (const v of clic.values) choisis.set(v, pageEntrees.find((e) => cle(e) === v));
    }
  }
}

/**
 * Durée des sondages : jusqu'à la veille du premier jour proposé à 20h.
 * Bornée aux limites Discord (1h à 32 jours).
 */
function dureeSondageHeures(premierJour) {
  const fin = premierJour.getTime() - 4 * 60 * 60 * 1000; // veille, 20h
  const heures = Math.floor((fin - Date.now()) / (60 * 60 * 1000));
  return Math.min(DUREE_MAX_H, Math.max(1, heures));
}

function sondage(question, reponses, duree) {
  return {
    poll: {
      question: { text: question },
      answers: reponses.map((texte) => ({ text: tronquer(texte, MAX_TEXTE_REPONSE) })),
      duration: duree,
      allowMultiselect: true,
    },
  };
}

function boutonClore(voteId) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`${PREFIXE_CLORE}:${voteId}`)
      .setLabel('🔒 Clôturer le vote')
      .setStyle(ButtonStyle.Secondary)
  );
}

/**
 * Branche "Séances programmées" de /cine — publie, dans le salon Séances
 * Ciné, les sondages pour choisir le jour, l'heure et le film d'une séance :
 * - jours : choisis par le streamer parmi les 3 prochaines semaines ;
 * - horaires : 19h30 / 20h / 20h30 / 21h / 21h30 ;
 * - films : choisis dans la watchlist.
 * Plusieurs réponses possibles pour les membres. Un seul jour ou un seul
 * film coché = pas de sondage pour celui-ci, il est simplement annoncé.
 *
 * À la fin des votes (automatique, ou bouton "Clôturer le vote"), le bot
 * dépouille les sondages et publie la séance gagnante (voir cloturerVote).
 */
async function runSeancesProgrammeesWizard(interaction, message) {
  const jours = await choisirJours(interaction, message);
  if (!jours) return;

  const films = await choisirFilms(interaction, message);
  if (!films) return;

  const salonVocalId = await demanderSalonVocal(interaction, message);
  if (!salonVocalId) return; // message d'erreur/timeout déjà posté

  const duree = dureeSondageHeures(jours[0]);
  const finVote = Date.now() + duree * 60 * 60 * 1000;
  const finVoteTs = Math.floor(finVote / 1000);

  // Récapitulatif avant publication.
  await interaction.editReply({
    content:
      '**Récapitulatif**\n' +
      `📅 Jours : ${jours.map(formatJourFr).join(', ')}\n` +
      `🕗 Horaires : ${HORAIRES.join(', ')}\n` +
      `🎬 Films : ${films.map((f) => f.titre).join(', ')}\n` +
      `🔊 Salon vocal : <#${salonVocalId}>\n` +
      `⏳ Fin des votes : <t:${finVoteTs}:F> (ou bouton « Clôturer le vote »)\n\n` +
      `La séance gagnante sera publiée automatiquement. Publier les sondages dans <#${config.cineClub.channelId}> ?`,
    components: [
      new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('cineprog_publier').setLabel('📣 Publier').setStyle(ButtonStyle.Success),
        new ButtonBuilder().setCustomId('cineprog_annuler').setLabel('Annuler').setStyle(ButtonStyle.Secondary)
      ),
    ],
  });

  let confirmation;
  try {
    confirmation = await attendreClic(message, interaction.user.id, ['cineprog_publier', 'cineprog_annuler']);
  } catch {
    return interaction.editReply({ content: '⌛ Temps écoulé, commande annulée.', components: [] });
  }
  await confirmation.deferUpdate();
  if (confirmation.customId === 'cineprog_annuler') {
    return interaction.editReply({ content: 'Commande annulée.', components: [] });
  }

  await interaction.editReply({ content: 'Publication en cours...', components: [] });

  const salon = await interaction.guild.channels.fetch(config.cineClub.channelId).catch(() => null);
  if (!salon) {
    return interaction.editReply({
      content: `❌ Salon Séances Ciné introuvable (ID ${config.cineClub.channelId}).`,
      components: [],
    });
  }

  const voteId = String(Date.now());
  const roleId = config.cineClub.roles.seancesCine;
  const lignes = [`${roleId ? `<@&${roleId}> ` : ''}📊 **Séances programmées** — à vous de voter !`];
  if (jours.length === 1) lignes.push(`📅 La séance aura lieu **${formatJourFr(jours[0]).toLowerCase()}**.`);
  if (films.length === 1) lignes.push(`🎞️ Au programme : **${films[0].titre}**.`);
  lignes.push(`Plusieurs réponses possibles · fin des votes <t:${finVoteTs}:R>.`);

  const sondages = { jours: null, horaires: null, films: null };
  let intro;
  try {
    intro = await salon.send({
      content: lignes.join('\n'),
      components: [boutonClore(voteId)],
      allowedMentions: { roles: roleId ? [roleId] : [] },
    });

    if (films.length === 1) {
      const fiche = await tmdb.getDetails(films[0].tmdbId, films[0].mediaType).catch(() => null);
      if (fiche) {
        await salon.send({ flags: MessageFlags.IsComponentsV2, components: [buildFicheContainer(fiche)] });
      }
    }

    if (jours.length > 1) {
      sondages.jours = (await salon.send(sondage('📅 Quel(s) jour(s) pour la séance ?', jours.map(formatJourFr), duree))).id;
    }
    sondages.horaires = (await salon.send(sondage('🕗 À quelle(s) heure(s) ?', HORAIRES, duree))).id;
    if (films.length > 1) {
      sondages.films = (await salon.send(sondage('🎬 Quel(s) film(s) ?', films.map((f) => f.titre), duree))).id;
    }
  } catch (err) {
    console.error('[SEANCES-CINE] Publication des sondages impossible :', err);
    return interaction.editReply({
      content: '❌ Publication incomplète (permission « Créer des sondages » manquante ?). Voir les logs du bot.',
      components: [],
    });
  }

  store.setVote(voteId, {
    id: voteId,
    statut: 'ouvert',
    guildId: interaction.guild.id,
    channelId: salon.id,
    introMessageId: intro.id,
    introTexte: lignes.join('\n'),
    sondages,
    jours: jours.map((j) => j.toISOString()),
    films: films.map((f) => ({ tmdbId: f.tmdbId, mediaType: f.mediaType, titre: f.titre })),
    salonVocalId,
    finVote,
  });

  await interaction.editReply({ content: `✅ Sondages publiés dans <#${salon.id}> !`, components: [] });
}

// --- Clôture et dépouillement --------------------------------------------

/**
 * Nombre de votants par réponse d'un sondage (dans l'ordre des réponses),
 * compté via la liste des votants : exact même si Discord n'a pas encore
 * finalisé les résultats (clôture anticipée).
 */
async function compterVotes(salon, messageId) {
  const msg = await salon.messages.fetch(messageId);
  if (!msg.poll) return [];

  // Clôture anticipée : on arrête le sondage côté Discord (déjà fini = erreur ignorée).
  if (!msg.poll.resultsFinalized) await msg.poll.end().catch(() => {});

  const reponses = [...msg.poll.answers.values()].sort((a, b) => a.id - b.id);
  const comptes = [];
  for (const reponse of reponses) {
    let total = 0;
    let after;
    while (true) {
      const votants = await reponse.voters.fetch({ limit: 100, after });
      total += votants.size;
      if (votants.size < 100) break;
      after = votants.lastKey();
    }
    comptes.push(total);
  }
  return comptes;
}

/** Index de la réponse gagnante (égalité : la première de la liste). */
function indexGagnant(comptes) {
  let meilleur = 0;
  comptes.forEach((c, i) => {
    if (c > comptes[meilleur]) meilleur = i;
  });
  return meilleur;
}

/**
 * Clôt un vote : arrête les sondages, compte les votes, publie la séance
 * gagnante (carte séance dans CINE_CLUB_CHANNEL_ID + programme en image mis
 * à jour) et met à jour le message d'introduction. Appelée par le bouton
 * "Clôturer le vote" ou automatiquement à la fin des votes.
 * Renvoie un compte rendu texte.
 */
async function cloturerVote(client, voteId) {
  const vote = store.getVote(voteId);
  if (!vote || vote.statut !== 'ouvert') return 'Ce vote est déjà clôturé.';
  // Marqué clos tout de suite : évite une double clôture (bouton + tick).
  store.majVote(voteId, { statut: 'clos' });

  const guild = await client.guilds.fetch(vote.guildId);
  const salon = await guild.channels.fetch(vote.channelId);

  let resultat;
  try {
    const comptesJours = vote.sondages.jours ? await compterVotes(salon, vote.sondages.jours) : [];
    const comptesHoraires = await compterVotes(salon, vote.sondages.horaires);
    const comptesFilms = vote.sondages.films ? await compterVotes(salon, vote.sondages.films) : [];

    const totalVotes = [...comptesJours, ...comptesHoraires, ...comptesFilms].reduce((a, b) => a + b, 0);
    if (totalVotes === 0) {
      resultat = '🔒 Vote clôturé sans aucun vote : pas de séance programmée.';
    } else {
      const jour = new Date(vote.jours[vote.sondages.jours ? indexGagnant(comptesJours) : 0]);
      const horaire = HORAIRES[indexGagnant(comptesHoraires)];
      const film = vote.films[vote.sondages.films ? indexGagnant(comptesFilms) : 0];
      const { heure, minute } = parseHeure(horaire);
      const dateSeance = atHeure(jour, heure, minute);

      if (dateSeance.getTime() <= Date.now()) {
        resultat =
          `🔒 Vote clôturé : **${film.titre}**, ${formatJourFr(jour).toLowerCase()} à ${horaire} — ` +
          'date déjà passée, séance non publiée.';
      } else {
        const seance = await publierSeanceFilm({
          guild,
          tmdbId: film.tmdbId,
          mediaType: film.mediaType,
          dateSeance,
          salonVocalId: vote.salonVocalId,
          annonceTexte: `Séance Ciné choisie par vos votes, ${formatJourFr(jour).toLowerCase()} à ${horaire} !`,
          source: 'programmee',
        });
        const lien = `https://discord.com/channels/${guild.id}/${seance.channelId}/${seance.messageId}`;
        resultat =
          `🔒 Vote clôturé : **${seance.fiche.titre}**, ${formatJourFr(jour).toLowerCase()} à ${horaire}. ` +
          `[Voir la séance](${lien})`;
      }
    }
  } catch (err) {
    console.error(`[SEANCES-CINE] Clôture du vote ${voteId} impossible :`, err);
    // Remis en "ouvert" pour réessayer (bouton ou tick suivant), sauf après
    // MAX_ESSAIS échecs : on abandonne pour ne pas réessayer indéfiniment.
    const essais = (vote.essais || 0) + 1;
    const abandon = essais >= MAX_ESSAIS;
    store.majVote(voteId, { statut: abandon ? 'erreur' : 'ouvert', essais });
    return abandon
      ? '❌ Clôture impossible après plusieurs essais : programme la séance à la main avec Séance Libre (voir les logs du bot).'
      : '❌ Clôture impossible pour le moment, nouvel essai dans une minute (voir les logs du bot).';
  }

  store.majVote(voteId, { resultat });
  try {
    const intro = await salon.messages.fetch(vote.introMessageId);
    await intro.edit({
      content: `${vote.introTexte.replace(/\nPlusieurs réponses possibles.*$/, '')}\n\n${resultat}`,
      components: [],
      allowedMentions: { parse: [] },
    });
  } catch (err) {
    console.error("[SEANCES-CINE] Mise à jour du message d'introduction impossible :", err);
  }
  return resultat;
}

/** Bouton "Clôturer le vote" — réservé aux admins et au rôle streamer. */
async function handleCloreVoteButton(interaction) {
  if (!(await requireStreamerRole(interaction))) return;
  await interaction.deferReply({ ephemeral: true });
  const voteId = interaction.customId.split(':')[1];
  const compteRendu = await cloturerVote(interaction.client, voteId);
  await interaction.editReply({ content: compteRendu });
}

/**
 * Vérifie chaque minute les votes arrivés à leur fin et les clôt. Les votes
 * sont persistés : après un restart, ceux déjà échus sont clos au premier tick.
 */
function demarrerSchedulerVotes(client) {
  setInterval(async () => {
    for (const vote of store.listVotesOuverts()) {
      if (vote.finVote > Date.now()) continue;
      await cloturerVote(client, vote.id).catch((err) =>
        console.error(`[SEANCES-CINE] Clôture automatique du vote ${vote.id} impossible :`, err)
      );
    }
  }, 60 * 1000);
}

module.exports = {
  runSeancesProgrammeesWizard,
  cloturerVote,
  handleCloreVoteButton,
  demarrerSchedulerVotes,
  PREFIXE_CLORE,
};
