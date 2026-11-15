const { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const config = require('../../../config');
const { requireStreamerRole, requireChannel } = require('../../../core/permissions');
const withErrorHandling = require('../../../core/withErrorHandling');
const { attendreClic } = require('../service');
const { runSeriesWizard } = require('../wizards/series');
const { runSeanceLibreWizard } = require('../wizards/seance-libre');
const { runSeancesProgrammeesWizard } = require('../wizards/seances-programmees');

const CHOIX = [
  { customId: 'cine_menu_programmees', label: '📊 Séances programmées', style: ButtonStyle.Success },
  { customId: 'cine_menu_series', label: '📺 Séances Séries', style: ButtonStyle.Primary },
  { customId: 'cine_menu_libre', label: '🗓️ Séance Libre', style: ButtonStyle.Secondary },
];

module.exports = {
  data: new SlashCommandBuilder()
    .setName('cine')
    .setDescription('Point d\'entrée unique pour organiser une Séance Ciné'),

  execute: withErrorHandling(async (interaction) => {
    if (!(await requireStreamerRole(interaction))) return;
    if (!(await requireChannel(interaction, config.cineClub.channelId, { label: 'le salon Séances Ciné' }))) return;

    await interaction.deferReply({ ephemeral: true });
    const message = await interaction.editReply({
      content: 'Quel type de séance ?',
      components: [
        new ActionRowBuilder().addComponents(
          CHOIX.map((c) => new ButtonBuilder().setCustomId(c.customId).setLabel(c.label).setStyle(c.style))
        ),
      ],
    });

    let clic;
    try {
      clic = await attendreClic(
        message,
        interaction.user.id,
        CHOIX.map((c) => c.customId)
      );
    } catch {
      return interaction.editReply({ content: '⌛ Temps écoulé, /cine annulé.', components: [] });
    }

    // La branche "Séances Séries" ouvre une modale dès
    // sa première étape : le clic ne doit surtout pas être deferUpdate()
    // avant (une modale doit être la toute première réponse à son
    // interaction).
    if (clic.customId === 'cine_menu_series') return runSeriesWizard(interaction, clic, message);

    await clic.deferUpdate();

    if (clic.customId === 'cine_menu_libre') return runSeanceLibreWizard(interaction, message);
    if (clic.customId === 'cine_menu_programmees') return runSeancesProgrammeesWizard(interaction, message);
  }, 'SEANCES-CINE-CINE'),
};
