// Alerte « en live » : interroge l'API Twitch toutes les minutes et publie une
// carte dans le salon configuré quand une chaîne surveillée démarre un live.
// Polling plutôt qu'EventSub : les webhooks exigent une URL publique en HTTPS
// et le WebSocket un jeton utilisateur, alors qu'un jeton d'application suffit ici.

const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ContainerBuilder,
  MediaGalleryBuilder,
  MediaGalleryItemBuilder,
  MessageFlags,
  SectionBuilder,
  SeparatorSpacingSize,
  TextDisplayBuilder,
  ThumbnailBuilder,
} = require('discord.js');
const config = require('../../config');
const jsonStore = require('../../data/jsonStore');
const twitch = require('./twitch');

const INTERVALLE_VERIFICATION_MS = 60 * 1000;
const COULEUR_LIVE = 0x9146ff; // violet Twitch
// Le dernier live annoncé par chaîne est persisté : pas de seconde annonce du
// même live après un redémarrage du bot.
const NS_LIVES = 'stream-lives-annonces';

function echapper(texte) {
  return texte.replace(/[\\*_~`|>[\]]/g, '\\$&');
}

/** Lives en cours parmi `logins` (100 max par appel Helix). */
async function livesEnCours(logins) {
  const lives = [];
  for (let i = 0; i < logins.length; i += 100) {
    const lot = logins.slice(i, i + 100).map((login) => ['user_login', login]);
    lives.push(...(await twitch.helix('streams', [['type', 'live'], ...lot])));
  }
  return lives;
}

/** Jaquette de la catégorie Twitch du live (null si aucune catégorie). */
async function jaquetteJeu(gameId) {
  if (!gameId) return null;
  const [jeu] = await twitch.helix('games', [['id', gameId]]);
  return jeu?.box_art_url ? jeu.box_art_url.replace('{width}', '285').replace('{height}', '380') : null;
}

function construireMessage(live, roleId, jaquette) {
  const urlChaine = `https://www.twitch.tv/${live.user_login}`;
  // Le paramètre empêche Discord de resservir un aperçu d'un live précédent.
  const apercu = `${live.thumbnail_url.replace('{width}', '1280').replace('{height}', '720')}?t=${Date.now()}`;

  const container = new ContainerBuilder().setAccentColor(COULEUR_LIVE);
  // Seule la chaîne du serveur est surveillée : pas besoin de nommer le streamer.
  const textes = [
    new TextDisplayBuilder().setContent(
      live.game_name ? `## 🔴 Le live démarre sur ${echapper(live.game_name)} !` : '## 🔴 Le live démarre !'
    ),
  ];
  if (live.title) textes.push(new TextDisplayBuilder().setContent(echapper(live.title)));
  if (jaquette) {
    container.addSectionComponents(
      new SectionBuilder()
        .addTextDisplayComponents(...textes)
        .setThumbnailAccessory(new ThumbnailBuilder().setURL(jaquette))
    );
  } else {
    container.addTextDisplayComponents(...textes);
  }
  container.addMediaGalleryComponents(
    new MediaGalleryBuilder().addItems(new MediaGalleryItemBuilder().setURL(apercu))
  );
  container.addSeparatorComponents((s) => s.setSpacing(SeparatorSpacingSize.Small));
  container.addActionRowComponents(
    new ActionRowBuilder().addComponents(
      new ButtonBuilder().setStyle(ButtonStyle.Link).setLabel('Regarder le live').setURL(urlChaine)
    )
  );

  const components = [];
  if (roleId) components.push(new TextDisplayBuilder().setContent(`<@&${roleId}>`));
  components.push(container);

  return {
    flags: MessageFlags.IsComponentsV2,
    components,
    allowedMentions: { roles: roleId ? [roleId] : [] },
  };
}

async function verifier(client) {
  const { logins, channelId, roleId } = config.stream.live;
  const lives = await livesEnCours(logins);
  if (!lives.length) return;

  const annonces = jsonStore.read(NS_LIVES, {});
  for (const live of lives) {
    const login = live.user_login.toLowerCase();
    // L'id change à chaque nouveau live : un live déjà annoncé est ignoré.
    if (annonces[login] === live.id) continue;

    try {
      // Une jaquette introuvable ne doit pas bloquer l'annonce.
      const jaquette = await jaquetteJeu(live.game_id).catch((err) => {
        console.error('[STREAM] Jaquette du jeu introuvable :', err.message);
        return null;
      });
      const salon = await client.channels.fetch(channelId);
      await salon.send(construireMessage(live, roleId, jaquette));
      annonces[login] = live.id;
      jsonStore.write(NS_LIVES, annonces);
      console.log(`[STREAM] Live de ${live.user_name} annoncé.`);
    } catch (err) {
      console.error(`[STREAM] Annonce du live de ${live.user_name} impossible :`, err);
    }
  }
}

function demarrerSurveillanceLives(client) {
  const { logins, channelId } = config.stream.live;
  if (!twitch.estConfigure() || !logins.length || !channelId) {
    console.warn(
      '[STREAM] Alerte de live désactivée : TWITCH_CLIENT_ID, TWITCH_CLIENT_SECRET et un salon ' +
        '(TWITCH_LIVE_CHANNEL_ID ou STREAM_CHANNEL_ID) sont requis.'
    );
    return;
  }

  let enCours = false;
  const tick = async () => {
    // Un appel lent ne doit pas se chevaucher avec le suivant (double annonce).
    if (enCours) return;
    enCours = true;
    try {
      await verifier(client);
    } catch (err) {
      console.error('[STREAM] Vérification des lives impossible :', err.message);
    } finally {
      enCours = false;
    }
  };

  client.once('ready', tick);
  setInterval(tick, INTERVALLE_VERIFICATION_MS);
  console.log(`[STREAM] Surveillance des lives Twitch : ${logins.join(', ')}`);
}

module.exports = { demarrerSurveillanceLives };
