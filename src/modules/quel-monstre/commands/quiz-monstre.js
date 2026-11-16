const {
  SlashCommandBuilder,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  EmbedBuilder,
} = require('discord.js');
const withErrorHandling = require('../../../core/withErrorHandling');
const service = require('../service');

// Temps laissé pour répondre à CHAQUE question avant abandon du quiz.
const DELAI_QUESTION_MS = 5 * 60 * 1000;

// Joueurs ayant un quiz en cours (mémoire vive uniquement) : empêche deux
// quiz simultanés pour le même joueur. Vidé à la fin, à l'abandon ou en cas
// d'erreur.
const quizEnCours = new Set();

const LIBELLE_MIN = 'Pas du tout';
const LIBELLE_MAX = 'Extrêmement';
const COULEUR = 0x8b0000;

function barreProgression(index, total) {
  return '▰'.repeat(index) + '▱'.repeat(total - index);
}

function vueQuestion(index) {
  const { questions } = service;
  const question = questions[index];
  const min = question.min ?? LIBELLE_MIN;
  const max = question.max ?? LIBELLE_MAX;

  const options = Array.from({ length: 10 }, (_, i) => {
    const valeur = i + 1;
    let label = String(valeur);
    if (valeur === 1) label += ` — ${min}`;
    if (valeur === 10) label += ` — ${max}`;
    return { label, value: String(valeur) };
  });

  const select = new StringSelectMenuBuilder()
    .setCustomId(`quel_monstre:q${index}`)
    .setPlaceholder(`De 1 (${min}) à 10 (${max})`)
    .addOptions(options);

  return {
    content:
      `🩸 **Quel monstre êtes-vous ?** — Question ${index + 1}/${questions.length}\n` +
      `${barreProgression(index, questions.length)}\n\n` +
      `### ${question.texte}\n` +
      `Notez de **1** à **10** : 1 = ${min} · 10 = ${max}`,
    embeds: [],
    components: [new ActionRowBuilder().addComponents(select)],
  };
}

function vueResultat(guild, { monstre, compatibilite }, avertissement) {
  const embed = new EmbedBuilder()
    .setColor(COULEUR)
    .setTitle(`🩸 Vous êtes…${service.nomAffiche(guild, monstre)}`)
    .setDescription(monstre.description)
    .addFields({ name: 'Compatibilité', value: `**${compatibilite} %**`, inline: true });

  if (avertissement) {
    embed.addFields({ name: '⚠️ Rôle non attribué', value: avertissement });
  } else {
    embed.addFields({ name: 'Rôle', value: `<@&${monstre.roleId}>`, inline: true });
  }

  return { content: '', embeds: [embed], components: [] };
}

/** Pose les questions une à une. Retourne { reponses, derniere } ou null si abandon. */
async function poserQuestions(interaction) {
  const { questions } = service;
  const reponses = [];

  const message = await interaction.reply({ ...vueQuestion(0), ephemeral: true, fetchReply: true });
  // Dernière interaction reçue : c'est par elle qu'on édite le message
  // éphémère (chaque réponse renouvelle le jeton de 15 min de Discord).
  let derniere = interaction;

  for (let index = 0; index < questions.length; index++) {
    let choix;
    try {
      choix = await message.awaitMessageComponent({
        filter: (i) => i.user.id === interaction.user.id && i.customId === `quel_monstre:q${index}`,
        time: DELAI_QUESTION_MS,
      });
    } catch {
      await derniere
        .editReply({
          content: '⌛ Temps écoulé, quiz abandonné. Relancez `/quiz-monstre` quand vous voulez pour recommencer.',
          embeds: [],
          components: [],
        })
        .catch(() => {});
      return null;
    }

    reponses.push(Number(choix.values[0]));
    derniere = choix;

    if (index + 1 < questions.length) {
      await choix.update(vueQuestion(index + 1));
    } else {
      await choix.update({ content: '🔮 Analyse de votre âme en cours…', embeds: [], components: [] });
    }
  }

  return { reponses, derniere };
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('quiz-monstre')
    .setDescription('Quel monstre êtes-vous ? Répondez à 13 questions pour le découvrir.')
    .setDMPermission(false),

  execute: withErrorHandling(async (interaction) => {
    const etat = service.etatConfiguration();
    if (!etat.pret) {
      return interaction.reply({ content: `❌ Le quiz est indisponible : ${etat.erreur}`, ephemeral: true });
    }

    const dejaMonstre = service.monstreDuMembre(interaction.member);
    if (dejaMonstre) {
      return interaction.reply({
        content: `🩸 Vous avez déjà passé le quiz : vous êtes<@&${dejaMonstre.roleId}>.`,
        ephemeral: true,
      });
    }

    const userId = interaction.user.id;
    if (quizEnCours.has(userId)) {
      return interaction.reply({
        content: '⏳ Vous avez déjà un quiz en cours : terminez-le (ou laissez-le expirer) avant d\'en relancer un.',
        ephemeral: true,
      });
    }

    quizEnCours.add(userId);
    try {
      const resultat = await poserQuestions(interaction);
      if (!resultat) return;
      const { reponses, derniere } = resultat;

      // Revérification juste avant l'attribution : un rôle monstre a pu être
      // donné à la main pendant le quiz.
      const membre = await interaction.guild.members.fetch({ user: userId, force: true });
      const entreTemps = service.monstreDuMembre(membre);
      if (entreTemps) {
        return derniere.editReply({
          content: `🩸 Un monstre vous a été attribué pendant le quiz : vous êtes<@&${entreTemps.roleId}>.`,
          embeds: [],
          components: [],
        });
      }

      const trouve = await service.trouverMonstre(interaction.guild, reponses);
      const erreur = await service.attribuerRole(membre, trouve.monstre);
      if (erreur) {
        console.error(`[QUEL-MONSTRE] Rôle non attribué à ${interaction.user.tag} : ${erreur}.`);
      }

      await derniere.editReply(
        vueResultat(
          interaction.guild,
          trouve,
          erreur ? `Le bot n'a pas pu vous donner votre rôle (${erreur}). Prévenez un admin.` : null
        )
      );
    } finally {
      quizEnCours.delete(userId);
    }
  }, 'QUEL-MONSTRE'),
};
