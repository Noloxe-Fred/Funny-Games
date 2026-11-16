// Éléments partagés par les commandes d'administration du quiz monstre
// (pas une commande : non listé dans index.js).

/** Résumé lisible de l'état du quiz après une modification. */
function texteEtat(etat) {
  if (!etat.pret) {
    return `⚠️ **Le quiz n'est pas utilisable pour l'instant** :\n- ${etat.details.join('\n- ')}`;
  }
  let texte = '🩸 **Le quiz est prêt** : `/quiz-monstre` est utilisable.';
  if (etat.details.length) {
    texte += `\n⚠️ Attention, les rôles ne pourront pas être attribués en l'état :\n- ${etat.details.join('\n- ')}`;
  }
  return texte;
}

module.exports = { texteEtat };
