const jsonStore = require('../../data/jsonStore');

const NS_MONSTRES = 'quel-monstre-monstres';

/**
 * Monstres du quiz, gérés par le bot (/quiz-monstre-init, -ajouter,
 * -supprimer). À ne pas modifier à la main.
 *
 * Structure : { monstres: [{ roleId, nom, description, couleur, profil }] }
 *  - roleId : ID du rôle Discord du monstre, qui sert aussi d'identifiant.
 *  - nom : nom donné à la création. Le nom AFFICHÉ est celui du rôle sur
 *    Discord (renommable depuis Discord) ; celui-ci ne sert qu'à recréer le
 *    rôle s'il a été supprimé.
 *
 * Les résultats des joueurs ne sont pas stockés ici : ils sont portés par
 * leurs rôles Discord.
 *
 * Gardé en mémoire après la première lecture : seul ce module écrit dans
 * ce fichier.
 */
let cache = null;

function getMonstres() {
  if (!cache) cache = jsonStore.read(NS_MONSTRES, { monstres: [] }).monstres ?? [];
  return cache;
}

/** Remplace entièrement la liste. */
function setMonstres(monstres) {
  cache = monstres.map((m) => ({ ...m }));
  jsonStore.write(NS_MONSTRES, { monstres: cache });
}

module.exports = { getMonstres, setMonstres };
