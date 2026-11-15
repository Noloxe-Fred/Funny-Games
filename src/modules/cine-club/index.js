const search = require('./commands/search');
const add = require('./commands/add');
const list = require('./commands/list');
const deleteWatchlist = require('./commands/delete-watchlist');
const cine = require('./commands/cine');
const historique = require('./commands/historique');
const helpCine = require('./commands/help-cine');
const programmeCine = require('./commands/programme-cine');
const supprimerSeance = require('./commands/supprimer-seance');
const { demarrerSchedulerProgramme } = require('./programme/service');
const { demarrerSchedulerRappelHebdo } = require('./programme/rappel-hebdo');
const {
  demarrerSchedulerRappels,
  handlePresenceButton,
  handleStartEventButton,
} = require('./service');
const { handleCloreVoteButton, demarrerSchedulerVotes, PREFIXE_CLORE } = require('./wizards/seances-programmees');

module.exports = {
  name: 'cine-club',
  commands: [search, add, list, deleteWatchlist, cine, historique, helpCine, programmeCine, supprimerSeance],

  // Boutons persistants sur les annonces (carte séance) /cine — survivent à
  // un redémarrage du bot puisqu'ils sont dispatchés par préfixe de customId
  // via le registre central (voir core/commandRegistry.js), pas par un
  // collector scoped à la commande d'origine.
  buttons: [
    { prefix: 'cine_presence', execute: handlePresenceButton },
    { prefix: 'cine_start_event', execute: handleStartEventButton },
    // "Clôturer le vote" sur les sondages des Séances programmées.
    { prefix: PREFIXE_CLORE, execute: handleCloreVoteButton },
  ],

  // Démarre la boucle qui vérifie chaque minute les rappels (H-1) des
  // séances annoncées par /cine. Les rappels survivent à un restart car ils sont persistés en
  // JSON — au redémarrage, ceux déjà passés sont envoyés au premier tick
  // (max 60s de retard), ceux futurs attendent leur heure.
  //
  // Second tick par minute : tient à jour le programme en image
  // (programme/service.js) dès que la liste des séances à venir change.
  //
  // Troisième tick : rappel du programme chaque dimanche à 18h dans
  // "la-discute" (programme/rappel-hebdo.js).
  init: (client) => {
    demarrerSchedulerRappels(client);
    demarrerSchedulerProgramme(client);
    demarrerSchedulerRappelHebdo(client);
    // Quatrième tick : clôture automatique des votes des Séances programmées.
    demarrerSchedulerVotes(client);
  },
};
