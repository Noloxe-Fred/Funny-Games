const { SlashCommandBuilder, MessageFlags, ContainerBuilder, SeparatorSpacingSize } = require('discord.js');
const withErrorHandling = require('../../../core/withErrorHandling');

const COULEUR_HELP = 0xb8002e;

const COMMANDES = [
  {
    nom: '/search titre',
    acces: 'Tout le monde, tout salon',
    description: 'Cherche un film ou une série sur TMDB et affiche sa fiche, avec un bouton pour l\'ajouter à la watchlist.',
  },
  {
    nom: '/add titre',
    acces: 'Tout le monde, tout salon',
    description:
      'Ajoute un titre à la watchlist commune. Refuse les doublons déjà en watchlist, ' +
      'demande confirmation si le titre a déjà été vu.',
  },
  {
    nom: '/list',
    acces: 'Tout le monde, tout salon',
    description: 'Liste la watchlist, avec filtres type/genre et tri (récent, note, durée).',
  },
  {
    nom: '/delete-watchlist',
    acces: 'Admin ou rôle streamer',
    description: 'Retire un ou plusieurs titres de la watchlist via un menu de sélection.',
  },
  {
    nom: '/cine',
    acces: 'Admin ou rôle streamer, tout salon',
    description:
      'Point d\'entrée unique pour organiser une séance. Séances programmées : sondages (plusieurs réponses) sur les jours ' +
      'choisis parmi les 3 prochaines semaines, l\'horaire (19h30 à 21h30) et les films cochés dans la watchlist ; à la fin ' +
      'des votes (ou bouton « Clôturer le vote »), la séance gagnante est publiée automatiquement. ' +
      'Les 2 autres branches publient directement : Séances Séries ' +
      '(recherche TMDB, choix de la saison et des épisodes diffusés, jour au choix sur les 3 prochaines semaines, heure libre) ' +
      'et Séance Libre (jour au choix à partir d\'aujourd\'hui et sur les 3 prochaines semaines, heure libre, watchlist ou TMDB).',
  },
  {
    nom: '/supprimer-seance',
    acces: 'Admin ou rôle streamer',
    description:
      'Supprime une séance à venir, quelle que soit sa branche : annonce, évènement Discord, rappels, ' +
      'présences, historique, et la retire du programme en image.',
  },
  {
    nom: '/historique',
    acces: 'Tout le monde',
    description: 'Affiche les derniers films/séries vus aux Séances Ciné.',
  },
  {
    nom: '/programme-cine',
    acces: 'Admin ou rôle Modérateur',
    description:
      'Publie le programme en image (séances annoncées pas encore diffusées) dans le salon dédié. ' +
      'À lancer la première fois ou en cas de bug : ensuite il se met à jour tout seul.',
  },
];

module.exports = {
  data: new SlashCommandBuilder()
    .setName('help-cine')
    .setDescription('Affiche la liste des commandes des Séances Ciné et leur usage'),

  execute: withErrorHandling(async (interaction) => {
    const container = new ContainerBuilder().setAccentColor(COULEUR_HELP);

    container.addTextDisplayComponents((t) =>
      t.setContent(
        '# 🎬 Commandes des Séances Ciné\n' +
          'Watchlist ouverte à tout le monde. `/cine` est réservée aux admins et au rôle streamer, ' +
          'utilisable depuis n\'importe quel salon.'
      )
    );

    for (const c of COMMANDES) {
      container.addSeparatorComponents((s) => s.setDivider(true).setSpacing(SeparatorSpacingSize.Small));
      container.addTextDisplayComponents((t) =>
        t.setContent(`**${c.nom}**\n${c.description}\n-# Accès : ${c.acces}`)
      );
    }

    await interaction.reply({ flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral, components: [container] });
  }, 'SEANCES-CINE-HELP'),
};
