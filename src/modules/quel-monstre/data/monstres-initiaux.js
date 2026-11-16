/**
 * Liste INITIALE des monstres du quiz « Quel monstre êtes-vous ? ».
 *
 * TODO : remplacer les descriptions (la commande /quiz-monstre-init refuse
 * de se lancer tant qu'une description commence par « TODO »).
 *
 * Ce fichier n'est lu qu'UNE fois, par la première /quiz-monstre-init, qui
 * crée un rôle Discord par monstre et enregistre tout dans data-store/.
 * Ensuite, les monstres se gèrent depuis Discord :
 *  - /quiz-monstre-ajouter et /quiz-monstre-supprimer ;
 *  - nom et couleur : directement dans les paramètres des rôles.
 * Modifier ce fichier après l'init n'a plus aucun effet.
 *
 * Chaque monstre :
 *  - nom : nom du rôle à créer (100 caractères max, unique)
 *  - description : affichée au résultat (1000 caractères max)
 *  - couleur (optionnel) : couleur du rôle, ex. 0x8B0000
 *  - profil : 13 notes de 1 à 10, une par question, dans l'ordre de
 *    questions.js (Q1 → Q13)
 */
module.exports = [
  {
    nom: 'Freddy Krueger',
    description: 'TODO Description de Freddy Krueger.',
    couleur: 0xB22222, // pull rayé rouge
    profil: [10, 2, 8, 4, 9, 8, 10, 7, 1, 5, 1, 9, 8],
  },
  {
    nom: 'Art le clown',
    description: 'TODO Description de Art le clown.',
    couleur: 0xDCDCDC, // maquillage blanc
    profil: [8, 3, 2, 8, 1, 5, 10, 8, 3, 6, 3, 7, 4],
  },
  {
    nom: 'Xenomorphe',
    description: 'TODO Description de Xenomorphe.',
    couleur: 0x9ACD32, // sang acide
    profil: [5, 5, 1, 1, 1, 4, 10, 2, 8, 7, 2, 9, 5],
  },
  {
    nom: 'Leatherface',
    description: 'TODO Description de Leatherface.',
    couleur: 0x8B5A2B, // masque de cuir
    profil: [5, 8, 4, 7, 2, 3, 5, 5, 2, 3, 6, 8, 2],
  },
  {
    nom: 'Jigsaw',
    description: 'TODO Description de Jigsaw.',
    couleur: 0x4F7942, // filtre vert de Saw
    profil: [2, 5, 4, 2, 6, 4, 1, 1, 9, 9, 7, 4, 10],
  },
  {
    nom: 'Chucky',
    description: 'TODO Description de Chucky.',
    couleur: 0xFF7F11, // cheveux roux
    profil: [9, 2, 7, 8, 7, 4, 8, 9, 2, 3, 2, 5, 9],
  },
  {
    nom: 'Jennifer',
    description: 'TODO Description de Jennifer.',
    couleur: 0xD6246E, // rose vif
    profil: [4, 3, 5, 2, 4, 3, 6, 6, 5, 7, 2, 5, 8],
  },
  {
    nom: 'Carrie',
    description: 'TODO Description de Carrie.',
    couleur: 0xF4A6B7, // robe de bal rose pâle
    profil: [1, 10, 8, 6, 1, 10, 2, 7, 3, 7, 9, 2, 1],
  },
  {
    nom: 'Pennywise',
    description: 'TODO Description de Pennywise.',
    couleur: 0xFF1E1E, // ballon rouge
    profil: [9, 2, 6, 10, 9, 2, 9, 5, 5, 7, 1, 10, 10],
  },
  {
    nom: 'Josef',
    description: 'TODO Description de Josef.',
    couleur: 0x7D7461, // masque de loup
    profil: [6, 4, 5, 2, 8, 3, 7, 3, 6, 5, 2, 3, 9],
  },
  {
    nom: 'Annabelle',
    description: 'TODO Description de Annabelle.',
    couleur: 0xEEDFCC, // robe ivoire
    profil: [7, 5, 5, 5, 1, 4, 10, 2, 10, 10, 5, 9, 8],
  },
  {
    nom: 'Samara',
    description: 'TODO Description de Samara.',
    couleur: 0x1F6F78, // eau du puits
    profil: [2, 9, 5, 5, 2, 10, 9, 5, 8, 10, 5, 8, 6],
  },
  {
    nom: 'Esther',
    description: 'TODO Description de Esther.',
    couleur: 0x5B2C6F, // violet sombre
    profil: [5, 6, 4, 10, 3, 2, 7, 3, 6, 6, 10, 1, 9],
  },
  {
    nom: 'Hannibal Lecter',
    description: 'TODO Description de Hannibal Lecter.',
    couleur: 0x800020, // bordeaux, un bon chianti
    profil: [6, 7, 5, 1, 7, 4, 5, 1, 9, 5, 6, 4, 9],
  },
  {
    nom: 'Buddy',
    description: 'TODO Description de Buddy.',
    couleur: 0x3FA9F5, // bleu vif
    profil: [3, 1, 3, 10, 9, 1, 8, 8, 2, 5, 1, 5, 8],
  },
  {
    nom: 'Jason',
    description: 'TODO Description de Jason.',
    couleur: 0x1F3A5F, // bleu nuit de Crystal Lake
    profil: [4, 9, 2, 5, 1, 8, 5, 6, 7, 9, 4, 10, 1],
  },
  {
    nom: 'Sorcière de Blair',
    description: 'TODO Description de Sorcière de Blair.',
    couleur: 0x3E2C1C, // écorce de la forêt
    profil: [1, 2, 4, 2, 2, 9, 3, 6, 5, 10, 6, 6, 7],
  },
  {
    nom: 'Niki',
    description: 'TODO Description de Niki.',
    couleur: 0xB57EDC, // lavande
    profil: [3, 6, 3, 7, 7, 1, 1, 9, 2, 9, 10, 5, 6],
  },
  {
    nom: 'Pazuzu',
    description: 'TODO Description de Pazuzu.',
    couleur: 0x8A7F5A, // pierre de la statue
    profil: [6, 3, 2, 2, 8, 5, 9, 4, 4, 8, 2, 4, 9],
  },
  {
    nom: 'Guizmo',
    description: 'TODO Description de Guizmo.',
    couleur: 0xE3B778, // fourrure
    profil: [1, 2, 9, 10, 8, 1, 1, 10, 5, 1, 5, 1, 1],
  },
];
