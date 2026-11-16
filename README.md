# Funny Games — v2

Refonte du bot Discord du serveur Funny Games.

## Installation

```bash
npm install
cp .env.example .env
# remplir .env : TOKEN, CLIENT_ID, GUILD_ID, puis les IDs de rôles/salons
npm start
```

Les IDs de rôles/salons se récupèrent en activant le **mode développeur** dans
Discord (*Paramètres > Avancés*), puis clic droit sur le rôle/salon >
*Copier l'identifiant*.

## Architecture

```
index.js                     # bootstrap uniquement
src/
  client.js                  # création du client Discord
  config/index.js            # lecture + validation des variables d'env
  core/
    commandRegistry.js       # charge tous les modules, construit la Map de commandes
    eventHandler.js          # branche les listeners Discord sur le registre
    deployCommands.js        # déploiement des slash commands
    permissions.js           # requireAdmin() réutilisable
    withErrorHandling.js     # wrapper try/catch générique pour les commandes
  data/
    jsonStore.js             # persistance JSON générique (écriture atomique)
  modules/
    moderation/              # UNE fonctionnalité = UN dossier
      index.js                # manifeste : name, commands[]
      service.js               # logique métier partagée
      commands/
        addpurge.js
        purge.js
    quiz/                     # devine le film d'horreur à partir de son affiche floutée
      index.js                  # manifeste + boutons/modal persistants + scheduler des paliers
      service.js                 # pixélisation (Jimp), correction tolérante, Components V2
      store.js                    # état persistant (session, tentatives, scores, anti-répétition)
      tmdb.js                      # tirage TMDB d'un film d'horreur filtré
      commands/
        quiz-affiche-floutee.js
    letterboxd/               # annuaire des profils Letterboxd des membres
      index.js
      service.js                 # extraction des liens + scan du salon
      store.js                    # annuaire persistant (letterboxd-profils)
      commands/
        scan-letterbox.js
        list-letterbox.js
        delete-letterbox.js
    rss-feed/                 # publication automatique de flux RSS/Atom (alternative à MonitoRSS)
      index.js                  # manifeste + scheduler (toutes les 10 min)
      service.js                 # lecture du flux, recherche des images, carte V2
      store.js                    # flux suivis + articles déjà publiés (rss-feed)
      commands/
        rss.js                     # /rss ajouter|liste|supprimer|tester
    stream/                   # annonces de streams jeux vidéo sur Twitch
      index.js                  # manifeste + boutons persistants
      jeux.js                    # recherche combinée : Steam puis IGDB
      steam.js                   # fiches en français (API boutique Steam, sans clé)
      igdb.js                    # optionnel : jeux absents de Steam (jeton Twitch)
      service.js                 # carte V2, boutons, rappel H-1
      store.js                    # annonces (stream-annonces)
      commands/
        stream.js
        supprimer-stream.js
    quel-monstre/             # quiz « Quel monstre es-tu ? » (/quiz-monstre), résultat = rôle Discord
      index.js                  # manifeste + vérification de la config au démarrage
      service.js                 # distance, départage, gestion des monstres et des rôles
      store.js                    # monstres enregistrés, identifiés par leur rôle (quel-monstre-monstres)
      data/
        monstres-initiaux.js      # liste initiale, importée une seule fois par l'init
        questions.js              # 13 questions
      commands/
        quiz-monstre.js
        quiz-monstre-init.js
        quiz-monstre-ajouter.js
        quiz-monstre-supprimer.js  # avec autocomplétion
        commun.js                  # utilitaire partagé (pas une commande)
    forbidden-word/           # stub, prêt à implémenter
      index.js
```

## Ajouter un nouveau module (une nouvelle fonctionnalité)

1. Créer `src/modules/<mon-module>/index.js` qui exporte :
   ```js
   module.exports = {
     name: 'mon-module',
     commands: [],       // tableau de { data, execute }
     onMessage: async (message) => {},  // optionnel
     init: (client) => {},              // optionnel, appelé au démarrage
   };
   ```
2. Mettre **toutes** les commandes liées à cette fonctionnalité dans
   `src/modules/<mon-module>/commands/`.
3. Rien d'autre à faire : le `commandRegistry` charge automatiquement tout
   dossier présent dans `src/modules/`.

Convention : noms de dossiers en kebab-case, sans espace (ex: `forbidden-word`,
pas `le mot interdit`) pour rester compatible partout (shell, CLI, etc.).

## Changements par rapport à la v1

- **Structure par fonctionnalité** : `purge` + `addpurge` (même fonctionnalité)
  regroupées dans `modules/moderation/`, au lieu de deux dossiers séparés.
- **IDs Discord au lieu de noms** : un renommage de rôle/salon sur Discord ne
  casse plus le bot.
- **Registry de commandes en Map** : lookup en O(1) au lieu de boucler sur
  tous les modules à chaque interaction.
- **`onMessage` ciblé** : seuls les modules qui en définissent un sont notifiés
  à chaque message (avant : tous les modules étaient scannés systématiquement).
- **Persistance JSON** : chaque module gère son propre état via
  `data/jsonStore.js` (fichiers générés automatiquement dans `data-store/`,
  jamais versionnés) — le quiz par exemple répartit le sien sur plusieurs
  namespaces (`quiz-session`, `quiz-tentatives`, `quiz-scores`, `quiz-historique`).
- **Erreurs et permissions factorisées** : `withErrorHandling()` et
  `requireAdmin()` au lieu de dupliquer le try/catch dans chaque commande.
- **`rss-parser` retiré** du `package.json` : dépendance inutilisée dans le
  code d'origine.
- **`config/bot.js` vide retiré**, remplacé par `src/config/index.js` qui
  valide les variables d'environnement au démarrage (erreur explicite si
  `TOKEN`/`CLIENT_ID`/`GUILD_ID` manquent, au lieu d'un crash plus tard).

## Module en attente

`forbidden-word` (anciennement "le mot interdit") est un stub vide, prêt à
être implémenté quand tu veux — voir les commentaires dans son `index.js`.

## Quiz Affiche Floutée

- `/quiz-affiche-floutee` (réservé à `ADMIN_ROLE_ID` ou `MOD_ROLE_ID`) tire
  un film d'horreur au hasard sur TMDB (genre Horreur, note ≥ 5/10, sorti
  entre 1920 et aujourd'hui) et poste son affiche très pixélisée dans
  `QUIZ_CHANNEL_ID`, avec un bouton **Répondre** qui ouvre une fenêtre modale
  (champ texte libre). Le rôle `QUIZ_ROLE_JOUONS_A_UN_JEU_ID` (si configuré)
  est mentionné sur chaque post du quiz (chaque palier et le reveal, soit
  tous les 2 jours).
- La réponse est vérifiée avec tolérance aux fautes de frappe/accents
  (distance de Levenshtein). Le retour est **éphémère** (visible seulement
  par le joueur) et ne révèle jamais le titre en cas d'erreur.
- La carte du palier en cours affiche un compteur des réponses données
  (toutes tentatives confondues), mis à jour à chaque réponse ; le total
  final est rappelé sur le reveal. Elle liste aussi, dans l'ordre, le
  pseudo serveur (displayName) des joueurs ayant déjà trouvé la bonne
  réponse (liste reprise sur les cartes des paliers suivants).
- Chaque bonne réponse est annoncée publiquement dans `QUIZ_RESPONSE_CHANNEL_ID`
  (pseudo, palier atteint, points gagnés, nombre de tentatives) — sans jamais
  répéter le texte proposé ni le titre.
- Toutes les 2 jours, une version un peu moins pixélisée est postée (4 paliers
  au total), puis le titre est révélé avec la liste des gagnants de la manche
  (points de cette manche uniquement — le score cumulé reste secret).
- Points selon le palier où la bonne réponse a été trouvée : **4** (palier 1),
  **3** (palier 2), **2** (palier 3), **1** (palier 4). Une seule réponse
  comptée par joueur (la première correcte).
- Bouton **Palier suivant** sur la carte de chaque palier (réservé
  Admin/Modérateur Quiz) pour poster le palier suivant sans attendre les
  2 jours — sur le palier 4, il devient **Révéler la réponse**.
- Bouton **Question suivante** sur le message de reveal (réservé
  Admin/Modérateur Quiz) pour relancer une manche immédiatement.
- Au bout de 10 manches, un palmarès cumulé est publié puis les scores sont
  remis à zéro pour un nouveau cycle.
- Dépendance ajoutée : [`jimp`](https://www.npmjs.com/package/jimp) (pur JS,
  pas de binaire natif à compiler) pour la pixélisation des affiches.

## Séances Ciné — `/cine`

Commande unique (admin ou rôle streamer, salon `CINE_CLUB_CHANNEL_ID`) qui
ouvre un formulaire à boutons. Toutes les annonces et sondages mentionnent
le seul rôle `CINE_CLUB_ROLE_SEANCES_CINE_ID`.

- **📊 Séances programmées** (`wizards/seances-programmees.js`) : le
  streamer coche les jours à proposer (parmi les 3 prochaines semaines,
  10 max) puis les films de la watchlist (10 max), vérifie le récapitulatif
  et publie dans `CINE_CLUB_CHANNEL_ID` des sondages Discord natifs à
  plusieurs réponses : jours, horaires (19h30 / 20h / 20h30 / 21h / 21h30)
  et films. Un seul jour ou un seul film coché : pas de sondage pour
  celui-ci, il est annoncé dans le message d'introduction (avec la fiche
  TMDB pour le film). Le streamer choisit aussi le salon vocal de diffusion.
  Le bot a besoin de la permission « Créer des sondages ».
- **Fin des votes** : automatique la veille du premier jour proposé à 20h,
  ou plus tôt via le bouton **🔒 Clôturer le vote** du message
  d'introduction (admin ou rôle streamer). Le bot arrête les sondages,
  compte les votants de chaque réponse (égalité : la première de la liste,
  donc le jour et l'horaire les plus tôt) et publie la séance gagnante comme
  une Séance Libre : carte séance dans `CINE_CLUB_CHANNEL_ID`, event Discord,
  rappel H-1 et programme en image mis à jour. Sans aucun vote, pas de
  séance. Les votes en cours sont persistés (`data-store/cine-club-votes.json`)
  et clos au premier tick après un redémarrage s'ils sont échus.
- **📺 Séances Séries**, **🗓️ Séance Libre** (à partir d'aujourd'hui) :
  publient directement l'annonce de la séance (fiche, event Discord,
  rappel H-1, programme en image).

## Séances Ciné — programme en image

- Une image façon affiche d'horreur (identité « Chair » de Funny Games : en-tête
  en chair veinée avec globes oculaires baveux et titre qui saigne, fiches
  séance sérigraphiées avec ticket de date à liseré vert fluo) liste toutes les séances
  annoncées (toutes branches de `/cine`) et les streams de `/stream` pas encore
  commencés : affiche, type Film/Série/Jeu vidéo, année, titre, synopsis tronqué, date et heure. Affichée
  dans `CINE_CLUB_CHANNEL_PROGRAMME_ID`.
- Une image d'en-tête « Séances Ciné », puis une image par séance (toutes
  de même largeur et plus larges que hautes, donc affichées à la même
  échelle par Discord, quel que soit le nombre de séances) — un message par
  image, suivi
  d'une petite ligne « Cliquez sur une image pour l'agrandir » (Discord
  réduit les images dans le salon ; reposté si besoin pour rester en bas).
  Le rappel hebdomadaire garde l'ancien découpage (4 séances sur la
  première image, 5 par image suivante) dans une seule galerie.
- `/programme-cine` (Admin ou rôle Modo `MOD_ROLE_ID`) supprime les anciennes images
  et republie le programme. À lancer la première fois (la mise à jour
  automatique reste inactive tant qu'elle n'a jamais été lancée) ou en cas
  de bug.
- Ensuite, l'image est régénérée dès que la liste des séances à venir change :
  immédiatement quand une séance est annoncée (toutes les branches de `/cine`)
  ou supprimée (`/supprimer-seance`), et via un tick par minute pour le reste
  (séance commencée, publication ratée). Mise à jour en **éditant**
  les messages existants (ajout/suppression des images en plus ou en moins).
  Si un message a été supprimé à la main, tout est republié.
- Rappel hebdomadaire : chaque **dimanche à 18h**, le programme en image est
  posté dans `CINE_CLUB_CHANNEL_DISCUTE_ID` (« la-discute ») avec mention de
  `CINE_CLUB_ROLE_SEANCES_CINE_ID` s'il y a une séance à venir et de
  `STREAM_ROLE_ID` s'il y a un stream à venir, et la ligne « Le programme de la
  semaine sur HHE. » sous les images (un message Components V2). Une seule
  fois par dimanche (date persistée dans `data-store/cine-club-rappel-hebdo.json`) ;
  si le bot était éteint à 18h, il part au redémarrage avant minuit. Rien
  n'est posté s'il n'y a aucune séance à venir. Inactif sans la variable.
- Rappels des séances : un seul rappel, **1h avant** la séance, dans le salon
  de l'annonce (le rappel de la veille a été supprimé ; ceux encore
  persistés sont ignorés).
- Code : `src/modules/cine-club/programme/` (`render.js` dessin
  [`@napi-rs/canvas`](https://www.npmjs.com/package/@napi-rs/canvas), binaire
  précompilé, aucune dépendance système ; `service.js` publication ;
  `rappel-hebdo.js` rappel du dimanche ; polices
  Anton, Nosifer, Space Mono et Outfit dans `fonts/`, licence OFL). État persistant :
  `data-store/cine-club-programme.json`.

## Letterboxd

- `/scan-letterbox` (admin) lit **tout** l'historique du salon
  `SOCIAL_NETWORKS_CHANNEL_ID` (ou du salon passé en option `salon`) et
  enregistre, pour chaque membre, son pseudo serveur (displayName) et son lien
  Letterboxd. Formats reconnus : `letterboxd.com/<pseudo>` (avec ou sans
  `https://`/`www.`, sous-pages comme `/films` tolérées) normalisé en
  `https://letterboxd.com/<pseudo>/`, et `boxd.it/<code>` conservé tel quel.
  Les liens vers des films/listes (`letterboxd.com/film/...`) sont ignorés.
- Si un membre a posté plusieurs messages, le lien du plus récent est retenu.
  Bots et membres ayant quitté le serveur sont ignorés. Chaque scan remplace
  entièrement l'annuaire (`data-store/letterboxd-profils.json`).
- `/list-letterbox` (tout le monde) affiche la liste triée par pseudo dans un
  embed (découpé en plusieurs messages si la liste est très longue).
- `/delete-letterbox` (admin) ouvre un formulaire éphémère avec un menu
  déroulant à choix multiples pour retirer des profils de l'annuaire
  (pagination Précédent/Suivant au-delà de 25 profils, limite Discord).
  ⚠️ Un nouveau `/scan-letterbox` ré-ajoutera un profil supprimé si son
  message est toujours dans le salon.

## Flux RSS

Alternative maison à MonitoRSS : publie automatiquement les nouveaux articles
de flux RSS 2.0 ou Atom dans des salons, sous forme de carte Components V2
**avec l'image à la une en grand et les autres images de l'article en
galerie**.

- `/rss ajouter url salon [role]` (admin) : suit un flux et publie ses
  nouveaux articles dans le salon, en mentionnant le rôle si fourni. Les
  articles déjà présents dans le flux au moment de l'ajout sont ignorés (pas
  d'inondation du salon avec l'historique). Un même flux peut être suivi dans
  plusieurs salons.
- `/rss liste` (admin) : flux suivis, salon et rôle mentionné.
- `/rss supprimer` (admin) : menu déroulant pour arrêter de suivre un flux.
- `/rss tester` (admin) : aperçu éphémère du dernier article tel qu'il serait
  publié, sans rien poster dans le salon.
- Vérification au démarrage puis toutes les 10 minutes. Les identifiants
  d'articles publiés sont persistés (`data-store/rss-feed.json`, 300 derniers
  par flux) : pas de doublon après un redémarrage.
- **Carte publiée** (Components V2, un embed classique n'acceptant qu'une
  seule grande image) : nom du flux, titre cliquable, image à la une en
  pleine largeur, résumé, puis les autres images de l'article en mosaïque de
  vignettes (9 au maximum, « +N autres images » au-delà), auteur · catégorie
  · date, bouton « Lire l'article ». S'il n'y a qu'une seule autre image, elle
  s'affiche en vignette à droite du résumé (une galerie d'une image serait
  aussi grande que l'image à la une).
- **Image à la une** : beaucoup de flux (WordPress par défaut, dont
  horreurnews.com) ne la contiennent pas, d'où les embeds sans image de
  MonitoRSS. Ordre de recherche : image déclarée dans le flux
  (`media:content`, `media:thumbnail`, `enclosure`), puis balise `og:image`
  de la page de l'article, puis première `<img>` du contenu. Les images de la
  galerie sont les `<img>` du contenu, dédoublonnées (WordPress décline une
  même image en plusieurs tailles `-1024x576`). Les formats que Discord
  n'affiche pas (avif, svg...) sont ignorés.
- **Images en pièces jointes** : le bot télécharge lui-même les images et les
  joint au message (`attachment://`) au lieu de donner leur URL. Sinon c'est
  Discord qui va les chercher sur le site, et les protections anti-robots
  (o2switch pour horreurnews.com) bloquent ses serveurs : les images ne
  s'affichent pas. Limite de 5 Mo par image (contrôlée avant et pendant le
  téléchargement, une image trop lourde est ignorée) et de 9 Mo par message
  (limite Discord de 10 Mo sans boost). Les images restent en mémoire le temps
  de l'envoi, rien n'est écrit sur le disque ; une image en échec est omise, et si c'est l'image à la une, la
  première image de la galerie la remplace.
- **En-têtes de navigateur** : le flux, les pages et les images sont demandés
  avec un user-agent de navigateur classique ; un user-agent contenant « bot »
  se fait refuser en 403 par ces mêmes protections.
- Le pied de page WordPress (« L'article ... est apparu en premier sur ... »)
  est retiré du résumé.

## Stream jeux vidéo

Annonce un stream sur [la chaîne Twitch](https://www.twitch.tv/funny_games_discord),
sur le modèle de la branche « Séance Libre » de `/cine`.

- `/stream jeu` (admin ou rôle streamer, depuis n'importe quel salon) : recherche du
  jeu, choix du jeu, du jour (3 prochaines semaines), de l'heure (20h30 par
  défaut) et du message. Publie une carte Components V2 dans `STREAM_CHANNEL_ID`
  en mentionnant `STREAM_ROLE_ID`, avec lien Twitch, bouton « Je serai présent »,
  fiche du jeu, lien et démarrage de l'event.
- **Event Discord externe** de 3 h dont le lieu est la chaîne Twitch (pas de salon vocal).
- **Rappel H-1** avec mention du rôle, envoyé par le scheduler de `cine-club`.
- `/supprimer-stream` (admin ou rôle streamer) : retire annonce, event, rappel, présences
  et place au programme.
- **Programme en image** : les streams y figurent aux côtés des séances, triés
  par date, avec l'étiquette « Jeu vidéo », y compris dans le rappel du dimanche.
  Ils n'apparaissent ni dans `/supprimer-seance` ni dans l'historique.
- **Steam** (source principale) : API de la boutique, sans clé, non documentée
  officiellement. Le résumé est en français si l'éditeur l'a traduit, sinon en
  anglais. Les jeux absents de Steam (exclusivités console...) n'y figurent pas.
- **IGDB** (optionnel) : complète les résultats avec ces jeux, résumé en anglais.
  Actif si `TWITCH_CLIENT_ID` et `TWITCH_CLIENT_SECRET` sont renseignés (application
  Twitch).

## Quel monstre es-tu ? — `/quiz-monstre`

Le joueur répond à 13 questions (échelle 1 à 10, une question par message
éphémère, menu déroulant à 10 options) et reçoit le monstre dont le profil
est le plus proche, sous forme de **rôle Discord**.

### Gestion des monstres (admins)

Les monstres sont enregistrés par le bot dans
`data-store/quel-monstre-monstres.json` (à ne pas modifier à la main),
chacun identifié par l'**ID de son rôle Discord**.

- **`/quiz-monstre-init`** : la première fois, importe la liste de
  `data/monstres-initiaux.js` et crée un rôle par monstre. Ensuite, ne
  fait que recréer les rôles supprimés par erreur (le fichier n'est plus
  relu). Sans risque de doublon, peut être relancée après un échec.
- **`/quiz-monstre-ajouter nom profil description [couleur]`** : crée le
  rôle et enregistre le monstre. `profil` = 13 notes de 1 à 10 dans
  l'ordre des questions, séparées par des espaces ou des virgules
  (`5 3 8 1 10 4 6 2 7 9 3 5 8`). `couleur` au format `#8b0000`. La
  réponse affiche le profil aligné sur chaque question pour vérification,
  et prévient si un autre monstre a exactement le même profil.
- **`/quiz-monstre-supprimer monstre`** (autocomplétion) : demande
  confirmation, puis retire le monstre du quiz en supprimant son rôle ou en
  le gardant comme rôle ordinaire. Ses membres pourront repasser le quiz.
- **Nom et couleur** : directement dans les paramètres des rôles Discord.
  Le quiz affiche toujours le nom actuel du rôle.

Après chaque modification, la configuration est revérifiée : si un rôle
monstre a disparu ou si aucun monstre n'est enregistré, `/quiz-monstre`
refuse de se lancer et l'admin voit pourquoi. Les problèmes de permission
(Gérer les rôles, rôle du bot sous les rôles monstres) sont signalés et
revérifiés à chaque attribution. Les rôles créés par le bot sont placés en
bas de la hiérarchie, donc sous le sien.

### Attribution

- Distance euclidienne entre les réponses et chaque profil ; la plus petite
  l'emporte. En cas d'égalité (à `MARGE` près, 0 par défaut, dans
  `service.js`) : le rôle le moins peuplé, puis tirage au hasard. Les
  membres ne sont récupérés (`guild.members.fetch()`, intent **Server
  Members** requis) qu'en cas d'égalité.
- Compatibilité affichée : `1 - distance / distanceMax`, avec
  distanceMax = √(13 × 81).
- **Résultats non persistés** : « a déjà joué » = possède un rôle monstre.
  `/quiz-monstre` rappelle alors son monstre au joueur sans relancer le
  quiz. Pour faire rejouer quelqu'un, un admin lui retire son rôle à la main.
  Le rôle est revérifié juste avant l'attribution.
- **Sessions** : en mémoire vive, un seul quiz à la fois par joueur,
  5 minutes par question avant abandon (le joueur peut alors recommencer).
- **Questions** : `data/questions.js`. En ajouter une après le lancement
  invaliderait tous les profils (il en faut une valeur par question).
