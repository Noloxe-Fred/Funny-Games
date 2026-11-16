const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { requireAdmin } = require('../../../core/permissions');
const withErrorHandling = require('../../../core/withErrorHandling');
const service = require('../service');
const { texteEtat } = require('./commun');

const LIMITE_MESSAGE = 2000;

function ligne(emoji, libelle, elements, format) {
  if (!elements.length) return null;
  return `${emoji} **${libelle} (${elements.length})** : ${elements.map(format).join(', ')}`;
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('quiz-monstre-init')
    .setDescription('Quiz monstre : crée les rôles de la liste initiale, ou recrée les rôles supprimés')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .setDMPermission(false),

  execute: withErrorHandling(async (interaction) => {
    if (!(await requireAdmin(interaction))) return;

    const probleme = service.problemePermissionGerer(interaction.guild);
    if (probleme) {
      return interaction.reply({ content: `❌ Impossible de créer les rôles : ${probleme}.`, ephemeral: true });
    }

    // La liste initiale n'est importée que si aucun monstre n'est encore
    // enregistré : on ne la valide que dans ce cas.
    if (service.monstres().length === 0) {
      const erreurs = service.erreursMonstresInitiaux();
      if (erreurs.length) {
        return interaction.reply({
          content: `❌ Liste initiale invalide (data/monstres-initiaux.js), aucun rôle créé :\n- ${erreurs.join('\n- ')}`.slice(
            0,
            LIMITE_MESSAGE
          ),
          ephemeral: true,
        });
      }
    }

    await interaction.deferReply({ ephemeral: true });

    const rapport = await service.initialiser(interaction.guild);
    const etat = await service.verifierConfiguration(interaction.client);

    const lignes = [
      rapport.import ? '📥 **Import de la liste initiale.**' : null,
      ligne('🆕', 'Créés', rapport.crees, ({ role }) => `<@&${role.id}>`),
      ligne('♻️', 'Recréés (rôle supprimé)', rapport.recrees, ({ role }) => `<@&${role.id}>`),
      ligne('✅', 'Déjà en place', rapport.conserves, ({ role }) => `<@&${role.id}>`),
      ligne('❌', 'Échecs (relance la commande)', rapport.echecs, ({ monstre, erreur }) => `${monstre.nom} — ${erreur}`),
      '',
      texteEtat(etat),
    ].filter((l) => l !== null);

    await interaction.editReply({
      content: lignes.join('\n').slice(0, LIMITE_MESSAGE),
      allowedMentions: { parse: [] },
    });
  }, 'QUEL-MONSTRE-INIT'),
};
