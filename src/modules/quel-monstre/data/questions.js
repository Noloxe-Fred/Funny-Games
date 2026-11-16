/**
 * Questions du quiz « Quel monstre êtes-vous ? ».
 *
 * Chaque question :
 *  - texte : la question affichée au joueur
 *  - min / max (optionnels) : libellés des extrémités de l'échelle 1-10.
 *    Sans eux : 1 = « Pas du tout », 10 = « Extrêmement » (questions
 *    d'intensité, « À quel point êtes-vous… ? »).
 *
 * L'ORDRE et le SENS de l'échelle comptent : la n-ième question correspond
 * à la n-ième note du profil de chaque monstre. Ne pas réordonner, inverser
 * une échelle, ajouter ou retirer une question une fois les profils saisis.
 */
module.exports = [
  { texte: 'À quel point êtes-vous sarcastique ?' },
  { texte: 'Êtes-vous plutôt extraverti·e ou introverti·e ?', min: 'Extraverti·e', max: 'Introverti·e' },
  { texte: 'Face au danger, êtes-vous plutôt téméraire ou peureux·se ?', min: 'Téméraire', max: 'Peureux·se' },
  { texte: 'À quel point êtes-vous enfantin·e ?' },
  { texte: 'À quel point êtes-vous bavard·e ?' },
  { texte: 'À quel point êtes-vous solitaire ?' },
  { texte: 'Êtes-vous plutôt militant·e ou apolitique ?', min: 'Militant·e', max: 'Apolitique' },
  { texte: 'Êtes-vous plutôt rationnel·le ou instinctif·ve ?', min: 'Rationnel·le', max: 'Instinctif·ve' },
  {
    texte: 'Face à une contrariété, cédez-vous facilement à la colère ou gardez-vous votre sang-froid ?',
    min: 'Je cède à la colère',
    max: 'Je garde mon sang-froid',
  },
  { texte: 'À quel point êtes-vous rancunier·ère ?' },
  { texte: 'À quel point êtes-vous romantique ?' },
  { texte: 'Êtes-vous plutôt sensible ou résistant·e à la douleur ?', min: 'Sensible', max: 'Résistant·e' },
  { texte: 'Pour atteindre vos objectifs, êtes-vous plutôt honnête ou rusé·e ?', min: 'Honnête', max: 'Rusé·e' },
];
