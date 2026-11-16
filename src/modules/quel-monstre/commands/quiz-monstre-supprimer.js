const {
  SlashCommandBuilder,
  PermissionFlagsBits,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} = require('discord.js');
const { requireAdmin } = require('../../../core/permissions');
const withErrorHandling = require('../../../core/withErrorHandling');
const service = require('../service');
const { texteEtat } = require('./commun');

const DELAI_CONFIRMATION_MS = 60 * 1000;
const LIMITE_AUTOCOMPLETE = 25;
const LIMITE_MESSAGE = 2000;

module.exports = {
  data: new SlashCommandBuilder()
    .setName('quiz-monstre-supprimer')
    .setDescription('Quiz monstre : retire un monstre du quiz')
    .addStringOption((o) =>
      o.setName('monstre').setDescription('Monstre à retirer').setRequired(true).setAutocomplete(true)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .setDMPermission(false),

  // Suggestions : nom actuel du rôle sur Discord, valeur = ID du rôle.
  autocomplete: async (interaction) => {
    const saisie = interaction.options.getFocused().toLowerCase();
    const choix = service
      .monstres()
      .map((m) => ({ name: service.nomAffiche(interaction.guild, m).slice(0, 100), value: m.roleId || m.nom }))
      .filter((c) => c.name.toLowerCase().includes(saisie))
      .sort((a, b) => a.name.localeCompare(b.name, 'fr'))
      .slice(0, LIMITE_AUTOCOMPLETE);
    await interaction.respond(choix);
  },

  execute: withErrorHandling(async (interaction) => {
    if (!(await requireAdmin(interaction))) return;

    const monstre = service.trouverParRoleOuNom(interaction.guild, interaction.options.getString('monstre'));
    if (!monstre) {
      return interaction.reply({
        content: '❌ Monstre introuvable. Choisis-le dans la liste proposée en tapant son nom.',
        ephemeral: true,
      });
    }

    await interaction.deferReply({ ephemeral: true });

    const nom = service.nomAffiche(interaction.guild, monstre);
    const effectif = monstre.roleId ? await service.effectif(interaction.guild, monstre) : 0;

    const boutons = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('quel_monstre_suppr:role').setLabel('Retirer et supprimer le rôle').setStyle(ButtonStyle.Danger),
      new ButtonBuilder().setCustomId('quel_monstre_suppr:garder').setLabel('Retirer, garder le rôle').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('quel_monstre_suppr:annuler').setLabel('Annuler').setStyle(ButtonStyle.Secondary)
    );

    const message = await interaction.editReply({
      content:
        `🗑️ Retirer **${nom}** du quiz ?\n` +
        `- ${effectif} membre(s) ont ce rôle. Une fois le monstre retiré, ils pourront repasser le quiz.\n` +
        '- **Supprimer le rôle** : il disparaît du serveur et des membres qui l\'ont.\n' +
        '- **Garder le rôle** : il reste sur le serveur comme un rôle ordinaire (à supprimer à la main plus tard si besoin).\n' +
        '- Le profil et la description du monstre seront perdus.',
      components: [boutons],
    });

    let choix;
    try {
      choix = await message.awaitMessageComponent({
        filter: (i) => i.user.id === interaction.user.id && i.customId.startsWith('quel_monstre_suppr:'),
        time: DELAI_CONFIRMATION_MS,
      });
    } catch {
      return interaction.editReply({ content: '⌛ Temps écoulé, rien n\'a été supprimé.', components: [] });
    }

    const action = choix.customId.split(':')[1];
    if (action === 'annuler') {
      return choix.update({ content: '↩️ Annulé, rien n\'a été supprimé.', components: [] });
    }

    await choix.update({ content: '⏳ Suppression en cours…', components: [] });
    const resultat = await service.supprimerMonstre(interaction.guild, monstre, { supprimerRole: action === 'role' });
    if (!resultat.monstre) {
      return interaction.editReply(`❌ ${resultat.erreur}`);
    }

    const etat = await service.verifierConfiguration(interaction.client);
    const lignes = [
      `✅ **${nom}** a été retiré du quiz.`,
      resultat.roleSupprime ? '🗑️ Son rôle a été supprimé du serveur.' : null,
      action === 'garder' ? `Son rôle <@&${monstre.roleId}> reste sur le serveur comme rôle ordinaire.` : null,
      resultat.erreur ? `⚠️ ${resultat.erreur}` : null,
      '',
      texteEtat(etat),
    ].filter((l) => l !== null);

    await interaction.editReply({ content: lignes.join('\n').slice(0, LIMITE_MESSAGE), allowedMentions: { parse: [] } });
  }, 'QUEL-MONSTRE-SUPPRIMER'),
};
