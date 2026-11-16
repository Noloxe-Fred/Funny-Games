const { Events } = require('discord.js');
const quizMonstre = require('./commands/quiz-monstre');
const quizMonstreInit = require('./commands/quiz-monstre-init');
const quizMonstreAjouter = require('./commands/quiz-monstre-ajouter');
const quizMonstreSupprimer = require('./commands/quiz-monstre-supprimer');
const service = require('./service');

// Quiz « Quel monstre es-tu ? » (/quiz-monstre) : 13 questions sur une
// échelle de 1 à 10, le monstre le plus proche (distance euclidienne) est
// attribué sous forme de rôle Discord. Les résultats ne sont pas persistés :
// les rôles sont la source de vérité. Les monstres sont gérés par le bot
// (data-store/) : liste initiale importée par /quiz-monstre-init, puis
// /quiz-monstre-ajouter et /quiz-monstre-supprimer.
module.exports = {
  name: 'quel-monstre',
  commands: [quizMonstre, quizMonstreInit, quizMonstreAjouter, quizMonstreSupprimer],

  // init() est appelé avant la connexion : la vérification des rôles du
  // serveur attend donc que le client soit prêt.
  init: (client) => {
    client.once(Events.ClientReady, () => {
      service.verifierConfiguration(client).catch((err) => {
        console.error('[QUEL-MONSTRE] Erreur lors de la vérification de la configuration :', err);
      });
    });
  },
};
