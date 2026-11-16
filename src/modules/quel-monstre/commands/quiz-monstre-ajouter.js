const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { requireAdmin } = require('../../../core/permissions');
const withErrorHandling = require('../../../core/withErrorHandling');
const service = require('../service');
const { texteEtat } = require('./commun');

const LIMITE_MESSAGE = 2000;

/** Profil aligné sur les questions, pour que l'admin vérifie sa saisie. */
function detailProfil(profil) {
  const lignes = service.questions.map((q, i) => {
    const texte = q.texte.length > 60 ? `${q.texte.slice(0, 59)}…` : q.texte;
    return `Q${String(i + 1).padEnd(2)} ${String(profil[i]).padStart(2)}  ${texte}`;
  });
  return '```\n' + lignes.join('\n') + '\n```';
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('quiz-monstre-ajouter')
    .setDescription('Quiz monstre : ajoute un monstre et crée son rôle')
    .addStringOption((o) =>
      o.setName('nom').setDescription('Nom du monstre (= nom du rôle créé)').setRequired(true).setMaxLength(service.LONGUEUR_NOM_MAX)
    )
    .addStringOption((o) =>
      o
        .setName('profil')
        .setDescription(`${service.questions.length} notes de 1 à 10, une par question dans l'ordre. Ex. : 5 3 8 1 10 4 6 2 7 9 3 5 8`)
        .setRequired(true)
        .setMaxLength(100)
    )
    .addStringOption((o) =>
      o
        .setName('description')
        .setDescription('Description affichée au joueur avec son résultat')
        .setRequired(true)
        .setMaxLength(service.LONGUEUR_DESCRIPTION_MAX)
    )
    .addStringOption((o) =>
      o.setName('couleur').setDescription('Couleur du rôle (optionnel), ex. #8b0000').setMaxLength(9)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .setDMPermission(false),

  execute: withErrorHandling(async (interaction) => {
    if (!(await requireAdmin(interaction))) return;

    const probleme = service.problemePermissionGerer(interaction.guild);
    if (probleme) {
      return interaction.reply({ content: `❌ Impossible de créer le rôle : ${probleme}.`, ephemeral: true });
    }

    const { profil, erreur: erreurProfil } = service.lireProfil(interaction.options.getString('profil'));
    if (erreurProfil) {
      return interaction.reply({ content: `❌ Profil invalide : ${erreurProfil}`, ephemeral: true });
    }
    const { couleur, erreur: erreurCouleur } = service.lireCouleur(interaction.options.getString('couleur'));
    if (erreurCouleur) {
      return interaction.reply({ content: `❌ ${erreurCouleur}`, ephemeral: true });
    }

    await interaction.deferReply({ ephemeral: true });

    const identiques = service.profilsIdentiques(profil);
    const { monstre, role, erreurs } = await service.ajouterMonstre(interaction.guild, {
      nom: interaction.options.getString('nom'),
      description: interaction.options.getString('description'),
      profil,
      couleur,
    });
    if (erreurs) {
      return interaction.editReply(`❌ Monstre non ajouté :\n- ${erreurs.join('\n- ')}`);
    }

    const etat = await service.verifierConfiguration(interaction.client);
    const lignes = [
      `✅ Monstre ajouté : <@&${role.id}>`,
      `> ${monstre.description}`,
      detailProfil(monstre.profil),
    ];
    if (identiques.length) {
      lignes.push(
        `⚠️ Même profil exactement que : ${identiques.map((m) => `<@&${m.roleId}>`).join(', ')}. ` +
          'Ils seront toujours ex æquo (départagés par le nombre de membres, puis au hasard).'
      );
    }
    lignes.push('', texteEtat(etat));

    await interaction.editReply({ content: lignes.join('\n').slice(0, LIMITE_MESSAGE), allowedMentions: { parse: [] } });
  }, 'QUEL-MONSTRE-AJOUTER'),
};
