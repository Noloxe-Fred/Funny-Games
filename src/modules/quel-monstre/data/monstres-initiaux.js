/**
 * Liste INITIALE des monstres du quiz « Quel monstre êtes-vous ? ».
 *
 * /quiz-monstre-init refuse de se lancer tant qu'une description commence
 * par « TODO ».
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
    description:
      'Le croque-mitaine des Griffes de la nuit (Wes Craven, 1984). Brûlé vif par les parents d\'Elm Street, il revient tuer leurs enfants dans leurs rêves, armé de son gant à lames. Pull rayé, chapeau mou, et une vanne pour chaque victime. Comme lui, vous avez la réplique assassine facile et vous adorez vous entendre parler. Charmeur·se en public mais solitaire au fond, vous êtes colérique, rusé·e et insensible aux coups… mais beaucoup moins brave dès qu\'on vous sort de votre terrain de jeu. La romance ? Très peu pour vous. La politique ? Encore moins.',
    couleur: 0xB22222, // pull rayé rouge
    profil: [10, 2, 8, 4, 9, 8, 10, 7, 1, 5, 1, 9, 8],
  },
  {
    nom: 'Art le clown',
    description:
      'Le clown muet de la saga Terrifier (Damien Leone) : maquillage noir et blanc, sac poubelle rempli d\'outils, et des grimaces de mime pendant qu\'il commet les carnages les plus gores du cinéma récent. Comme lui, vous n\'avez pas besoin de mots : une grimace, un clin d\'œil moqueur, et tout est dit. Gamin·e dans l\'âme, téméraire jusqu\'à l\'absurde, vous foncez à l\'instinct et la moutarde vous monte vite au nez. Vos causes ? Aucune. Votre humour ? Noir, très noir.',
    couleur: 0xDCDCDC, // maquillage blanc
    profil: [8, 3, 2, 8, 1, 5, 10, 8, 3, 6, 3, 7, 4],
  },
  {
    nom: 'Xenomorphe',
    description:
      'La créature d\'Alien (Ridley Scott, 1979), dessinée par H.R. Giger : née dans la poitrine d\'un hôte, elle a le sang acide et une double mâchoire. L\'androïde Ash l\'admire comme un survivant parfait, sans conscience, sans remords et sans morale. Comme elle, vous êtes une machine d\'efficacité : intrépide, silencieux·se, méthodique, impossible à déstabiliser et dur·e au mal. Les sentiments, l\'idéologie, les enfantillages : très peu pour vous. Mais on ne vous chasse pas impunément de votre vaisseau.',
    couleur: 0x9ACD32, // sang acide
    profil: [5, 5, 1, 1, 1, 4, 10, 2, 8, 7, 2, 9, 5],
  },
  {
    nom: 'Leatherface',
    description:
      'Le géant de Massacre à la tronçonneuse (Tobe Hooper, 1974), masqué de peau humaine, qui garde la maison d\'une famille de cannibales texans. Derrière la tronçonneuse, il y a un grand enfant qui obéit à ses aînés, panique quand on entre chez lui et danse au soleil couchant. Comme lui, vous êtes timide et peu causant·e, mais vous ne vivez que pour votre clan. Spontané·e, sans calcul, plutôt fleur bleue sous la carapace… Attention seulement à vos colères : elles font du bruit.',
    couleur: 0x8B5A2B, // masque de cuir
    profil: [5, 8, 4, 7, 2, 3, 5, 5, 2, 3, 6, 8, 2],
  },
  {
    nom: 'Jigsaw',
    description:
      'John Kramer, le tueur de Saw (James Wan, 2004). Condamné par un cancer, il enferme ceux qu\'il juge ingrats envers la vie dans des pièges mortels pour leur apprendre à l\'apprécier. « Je veux jouer à un jeu. » Comme lui, vous défendez une cause et une morale bien à vous, avec une logique implacable et un calme olympien. Vous préparez tout, ne laissez rien au hasard et n\'oubliez jamais un affront. Romantique en secret (Jill s\'en souvient), mais surtout maître·sse de la manipulation.',
    couleur: 0xB3001B, // robe rouge
    profil: [2, 5, 4, 2, 6, 4, 1, 1, 9, 9, 7, 4, 10],
  },
  {
    nom: 'Chucky',
    description:
      'Charles Lee Ray, un tueur en série qui transfère son âme dans une poupée « Brave Gars » dans Jeu d\'enfant (Tom Holland, 1988). Grande gueule, insultes en rafale et rire glaçant. Comme lui, vous êtes un concentré d\'énergie : sarcastique, bavard·e, impulsif·ve et soupe au lait. Gamin·e, oui, mais pas innocent·e : vous savez embobiner votre monde. Petit secret : derrière les menaces se cache quelqu\'un qui préfère détaler quand ça chauffe vraiment.',
    couleur: 0xFF7F11, // cheveux roux
    profil: [9, 2, 7, 8, 7, 4, 8, 9, 2, 3, 2, 5, 9],
  },
  {
    nom: 'Jennifer',
    description:
      'La pom-pom girl de Jennifer\'s Body (Karyn Kusama, 2009, écrit par Diablo Cody). Sacrifiée par un groupe de rock en quête de gloire, elle revient possédée par un démon qui se nourrit des garçons du lycée. Mal comprise à sa sortie, elle est devenue une icône depuis. Comme elle, vous êtes à l\'aise sous les projecteurs et vous savez jouer de votre charme pour obtenir ce que vous voulez. L\'amour ? Un outil plus qu\'un rêve. Et on ne vous trahit pas deux fois : vous savez garder une rancune… et la servir froide.',
    couleur: 0xD6246E, // rose vif
    profil: [4, 3, 5, 2, 4, 3, 6, 6, 5, 7, 2, 5, 8],
  },
  {
    nom: 'Carrie',
    description:
      'Carrie White, l\'adolescente télékinésiste imaginée par Stephen King et portée à l\'écran par Brian De Palma (1976). Martyrisée par ses camarades et par une mère fanatique, elle croit enfin vivre son conte de fées au bal de promo… jusqu\'au seau de sang de porc. Comme elle, vous êtes discrète, timide, sincère et sans une once de cynisme : une âme sensible qui rêve du grand amour. Mais vous avez un sens aigu de l\'injustice, et quand la coupe est pleine, votre colère peut tout embraser.',
    couleur: 0xF4A6B7, // robe de bal rose pâle
    profil: [1, 10, 8, 6, 1, 10, 2, 7, 3, 7, 9, 2, 1],
  },
  {
    nom: 'Pennywise',
    description:
      'Grippe-Sou, le clown dansant de Ça (Stephen King), incarné par Tim Curry (1990) puis Bill Skarsgård (2017). C\'est une entité millénaire qui se réveille tous les 27 ans à Derry pour dévorer les enfants sous la forme de leurs pires peurs. « Ici, tout le monde flotte ! » Comme lui, vous êtes un showman : bavard·e, joueur·se, éternel·le gamin·e, toujours une blague grinçante en réserve. Mais derrière le ballon rouge, vous êtes roi ou reine de l\'embrouille, increvable, et vous n\'oubliez jamais ceux qui vous ont défié·e.',
    couleur: 0xFF1E1E, // ballon rouge
    profil: [9, 2, 6, 10, 9, 2, 9, 5, 5, 7, 1, 10, 10],
  },
  {
    nom: 'Josef',
    description:
      'Le « client » de Creep (Patrick Brice, 2014), joué par Mark Duplass. Il engage un vidéaste pour filmer sa journée, se montre beaucoup trop sympathique… et finit par sortir son masque de loup, Peachfuzz. Comme lui, vous êtes bavard·e, sociable, pince-sans-rire, et vous mettez n\'importe qui à l\'aise. Mais votre jovialité est un rôle : vous calculez tout, vous testez les limites, et vous savez exactement où vous menez la conversation. Un petit câlin ?',
    couleur: 0x7D7461, // masque de loup
    profil: [6, 4, 5, 2, 8, 3, 7, 3, 6, 5, 2, 3, 9],
  },
  {
    nom: 'Annabelle',
    description:
      'La poupée maudite de l\'univers Conjuring (James Wan, 2013), inspirée d\'une vraie poupée Raggedy Ann conservée sous verre par Ed et Lorraine Warren. Elle ne bouge pas et ne parle pas : un démon se sert d\'elle, et elle attend son heure. Comme elle, vous n\'avez pas besoin de faire du bruit pour qu\'on vous remarque. Calme absolu, regard en coin, ironie silencieuse : vous observez, vous patientez, vous manœuvrez. Et surtout, vous n\'oubliez rien. Ceux qui ont ouvert votre vitrine s\'en souviennent.',
    couleur: 0xEEDFCC, // robe ivoire
    profil: [7, 5, 5, 5, 1, 4, 10, 2, 10, 10, 5, 9, 8],
  },
  {
    nom: 'Samara',
    description:
      'La fillette du puits de The Ring (Gore Verbinski, 2002), remake du Ringu de Hideo Nakata. Rejetée, enfermée puis jetée dans un puits par sa mère adoptive, elle survit dans une cassette vidéo : quiconque la regarde meurt sept jours plus tard. Comme elle, vous êtes une âme solitaire et silencieuse, qui préfère les recoins à la foule. Glaciale en apparence et imperturbable, vous avez pourtant une rancune qui ne s\'éteint jamais : on a pu vous oublier au fond d\'un puits, vous finirez toujours par en sortir.',
    couleur: 0x1F6F78, // eau du puits
    profil: [2, 9, 5, 5, 2, 10, 9, 5, 8, 10, 5, 8, 6],
  },
  {
    nom: 'Esther',
    description:
      'L\'orpheline d\'Esther (Jaume Collet-Serra, 2009), adoptée par une famille en deuil. Celle-ci découvre qu\'elle n\'a pas neuf ans mais plus de trente, et un passé très chargé. Comme elle, vous jouez à merveille la carte de l\'innocence, vous aimez être entouré·e et vous savez vous rendre indispensable. Cœur d\'artichaut (trop, même : évitez de tomber amoureux·se du père de famille), vous êtes d\'une grande sensibilité… et redoutablement manipulateur·ice quand il s\'agit d\'obtenir ce que vous voulez.',
    couleur: 0x5B2C6F, // violet sombre
    profil: [5, 6, 4, 10, 3, 2, 7, 3, 6, 6, 10, 1, 9],
  },
  {
    nom: 'Hannibal Lecter',
    description:
      'Le docteur Lecter, psychiatre brillant et cannibale raffiné du Silence des agneaux (Jonathan Demme, 1991). Anthony Hopkins a obtenu l\'Oscar pour à peine seize minutes à l\'écran. Comme lui, vous êtes un esprit cultivé, sérieux et d\'une logique implacable, qui aime la conversation… surtout quand vous la menez. Toujours maître·sse de vous-même, l\'ironie fine et le pouls qui ne dépasse jamais 85, vous êtes plus réservé·e que solitaire, et rusé·e jusqu\'au bout des ongles. On vous invite à dîner ? Méfiance.',
    couleur: 0x800020, // bordeaux, un bon chianti
    profil: [6, 7, 5, 1, 7, 4, 5, 1, 9, 5, 6, 4, 9],
  },
  {
    nom: 'Buddy',
    description:
      'La licorne orange de Buddy (Casper Kelly, 2026), animatrice d\'une émission pour enfants à la Barney dont chaque épisode est plus sombre que le précédent. Coincés dans le programme, les enfants découvrent que Buddy fait disparaître les gens, rend les adultes amnésiques et dociles, et ne tolère aucun écart. Comme lui, vous êtes une boule d\'énergie : ultra-sociable, bavard·e, enfantin·e, jamais seul·e. Mais votre bonne humeur a ses règles, la contrariété vous fait sortir de vos gonds, et vous savez très bien faire croire aux autres qu\'ils ont tout imaginé.',
    couleur: 0xFFA040, // fourrure orange
    profil: [3, 1, 3, 10, 9, 1, 8, 8, 2, 5, 1, 5, 8],
  },
  {
    nom: 'Jason',
    description:
      'Jason Voorhees, le colosse au masque de hockey de Vendredi 13. Noyé enfant au camp de Crystal Lake à cause de moniteurs distraits, il hante les bois du lac et punit tous ceux qui s\'y aventurent (même si, dans le premier film de 1980, c\'est sa mère qui tue). Comme lui, vous êtes taiseux·se, solitaire, imperturbable et increvable : vous ne courez pas, vous avancez. Franc·he et sans détour, vous n\'avez rien d\'un·e manipulateur·ice… mais vous avez une rancune tenace et un attachement sans faille à votre maman.',
    couleur: 0x1F3A5F, // bleu nuit de Crystal Lake
    profil: [4, 9, 2, 5, 1, 8, 5, 6, 7, 9, 4, 10, 1],
  },
  {
    nom: 'Sorcière de Blair',
    description:
      'La légende au cœur du Projet Blair Witch (Daniel Myrick et Eduardo Sánchez, 1999), le film qui a lancé le found footage moderne. Trois étudiants partent tourner un documentaire dans la forêt de Burkittsville, et on ne retrouve que leurs bobines. La sorcière n\'apparaît jamais à l\'écran. Comme elle, vous n\'avez pas besoin d\'être vu·e pour être dans toutes les têtes : solitaire mais omniprésent·e, vous tenez à vos convictions et ne pardonnez jamais. Zéro sarcasme, beaucoup de mystère… et quelques tas de pierres.',
    couleur: 0x3E2C1C, // écorce de la forêt
    profil: [1, 2, 4, 2, 2, 9, 3, 6, 5, 10, 6, 6, 7],
  },
  {
    nom: 'Nikki',
    description:
      'L\'héroïne d\'Obsession (Curry Barker, 2026). Bear, un timide vendeur de magasin de musique, utilise un jouet exauceur de vœux pour qu\'elle tombe amoureuse de lui… et se retrouve avec une petite amie qui ne le lâche plus d\'une semelle. Phénomène de l\'année, elle hante même les Halloween Horror Nights. Comme elle, vous aimez à la folie, passionnément, absolument : jamais sans votre moitié. Bavard·e, spontané·e, un brin gamin·e, vous défendez vos causes corps et âme. Mais gare à la jalousie : votre colère éclate vite et votre rancune dure longtemps.',
    couleur: 0x8E2C2C, // haut rayé rouge et noir
    profil: [3, 6, 3, 7, 7, 1, 1, 9, 2, 9, 10, 5, 6],
  },
  {
    nom: 'Pazuzu',
    description:
      'Le démon assyrien qui possède la petite Regan dans L\'Exorciste (William Friedkin, 1973), d\'après William Peter Blatty. Voix d\'outre-tombe, obscénités, tête qui pivote : il passe son temps à provoquer et humilier les prêtres venus le chasser. Comme lui, vous avez la langue bien pendue et le sarcasme acéré, vous ne craignez personne et vous adorez déstabiliser votre auditoire. Rusé·e et joueur·se, vous lisez les faiblesses des autres comme un livre ouvert… et vous n\'oubliez pas ceux qui ont voulu vous chasser.',
    couleur: 0xC9C5B9, // teint cadavérique
    profil: [6, 3, 2, 2, 8, 5, 9, 4, 4, 8, 2, 4, 9],
  },
  {
    nom: 'Guizmo',
    description:
      'Le mogwaï de Gremlins (Joe Dante, 1984), une adorable boule de poils qui chantonne. Trois règles : pas d\'eau, pas de lumière vive, jamais à manger après minuit. C\'est le seul vrai gentil de la liste : les gremlins naissent de lui, mais ce n\'est pas sa faute s\'ils sont infernaux. Comme lui, vous êtes doux·ce, sincère, sociable et éternel·le enfant, plus enclin·e à vous cacher qu\'à vous battre. Mais quand une cause vous tient à cœur, vous enfilez le bandeau de Rambo (Gremlins 2) et vous partez au combat. Sans rancune, évidemment.',
    couleur: 0xE3B778, // fourrure
    profil: [1, 2, 9, 10, 8, 1, 1, 10, 5, 1, 5, 1, 1],
  },
];
