const { PermissionFlagsBits } = require('discord.js');
const config = require('../../config');
const monstresInitiaux = require('./data/monstres-initiaux');
const questions = require('./data/questions');
const store = require('./store');

/**
 * Quiz « Quel monstre es-tu ? » — logique métier.
 *
 * Les monstres sont gérés par le bot (store.js), identifiés par l'ID de leur
 * rôle Discord. Les résultats des joueurs ne sont pas persistés : ils sont
 * portés par les rôles Discord.
 *  - « a déjà joué » = possède un des rôles monstres ;
 *  - « nombre d'attributions d'un monstre » = effectif actuel de son rôle.
 */

// Tolérance du départage, en unités de distance euclidienne (pas au carré).
// 0 = seules les égalités exactes sont départagées. En l'augmentant, les
// monstres dont la distance dépasse le minimum d'au plus MARGE sont aussi
// considérés comme ex æquo.
const MARGE = 0;

const VALEUR_MIN = 1;
const VALEUR_MAX = 10;
const LONGUEUR_NOM_MAX = 100; // limite Discord des noms de rôle
const LONGUEUR_DESCRIPTION_MAX = 1000;

// Distance maximale possible : un écart de 9 (10 - 1) sur chaque question.
// En distance au carré : 13 × 81 ; on compare ensuite des distances (racine).
const DISTANCE_MAX = Math.sqrt(questions.length * (VALEUR_MAX - VALEUR_MIN) ** 2);

const RAISON_AUDIT = 'Quiz « Quel monstre es-tu ? »';

// État de la vérification de configuration. Tant qu'elle n'est pas passée,
// /quiz-monstre refuse de se lancer.
let etat = { pret: false, erreur: 'vérification de la configuration en cours, réessaie dans un instant.', details: [] };

function etatConfiguration() {
  return etat;
}

function monstres() {
  return store.getMonstres();
}

/**
 * Sérialise les opérations qui modifient la liste des monstres (init,
 * ajout, suppression) : elles attendent Discord entre la lecture et
 * l'écriture, deux d'entre elles en parallèle pourraient s'écraser.
 */
let fileAttente = Promise.resolve();
function avecVerrou(operation) {
  const resultat = fileAttente.then(operation);
  fileAttente = resultat.catch(() => {});
  return resultat;
}

/**
 * Nom affiché du monstre : celui de son rôle sur Discord (Discord est la
 * référence, on peut le renommer librement depuis les paramètres du
 * serveur), ou le nom enregistré si le rôle est introuvable.
 */
function nomAffiche(guild, monstre) {
  return (monstre.roleId && guild.roles.cache.get(monstre.roleId)?.name) || monstre.nom;
}

/** Retrouve un monstre par l'ID de son rôle ou par son nom (insensible à la casse). */
function trouverParRoleOuNom(guild, saisie) {
  const texte = String(saisie ?? '').trim().toLowerCase();
  return (
    (texte && monstres().find((m) => m.roleId === texte)) ??
    monstres().find((m) => nomAffiche(guild, m).toLowerCase() === texte || m.nom.toLowerCase() === texte) ??
    null
  );
}

// ---------------------------------------------------------------------------
// Saisie d'un profil
// ---------------------------------------------------------------------------

/**
 * Lit un profil saisi par un admin : 13 nombres de 1 à 10, séparés par des
 * espaces, virgules, points-virgules ou barres obliques.
 * Ex. « 5 3 8 1 10 4 6 2 7 9 3 5 8 » ou « 5,3,8,1,10,4,6,2,7,9,3,5,8 ».
 * @returns {{ profil?: number[], erreur?: string }}
 */
function lireProfil(texte) {
  const morceaux = String(texte ?? '').split(/[\s,;/]+/).filter(Boolean);
  const invalide = morceaux.find((v) => !/^\d+$/.test(v) || Number(v) < VALEUR_MIN || Number(v) > VALEUR_MAX);
  if (invalide !== undefined) {
    return { erreur: `« ${invalide} » n'est pas un nombre entier entre ${VALEUR_MIN} et ${VALEUR_MAX}.` };
  }
  if (morceaux.length !== questions.length) {
    return {
      erreur: `j'ai lu ${morceaux.length} valeur(s), il en faut exactement ${questions.length} (une par question, dans l'ordre).`,
    };
  }
  return { profil: morceaux.map(Number) };
}

/** Lit une couleur « #8b0000 », « 8b0000 » ou « 0x8b0000 ». */
function lireCouleur(texte) {
  if (texte == null || texte === '') return { couleur: null };
  const hex = String(texte).trim().replace(/^(#|0x)/i, '');
  if (!/^[0-9a-f]{6}$/i.test(hex)) return { erreur: `couleur « ${texte} » invalide (format attendu : #8b0000).` };
  return { couleur: parseInt(hex, 16) };
}

// ---------------------------------------------------------------------------
// Algorithme d'attribution
// ---------------------------------------------------------------------------

function distanceCarree(a, b) {
  let somme = 0;
  for (let i = 0; i < a.length; i++) somme += (a[i] - b[i]) ** 2;
  return somme;
}

/** Pourcentage de compatibilité, entre 0 et 100, arrondi à l'entier. */
function compatibilite(distance) {
  return Math.round((1 - distance / DISTANCE_MAX) * 100);
}

/**
 * Monstres les plus proches des réponses : celui à la distance minimale,
 * plus ceux à moins de MARGE de ce minimum (ex æquo à départager).
 */
function candidatsLesPlusProches(reponses) {
  const distances = monstres().map((monstre) => ({
    monstre,
    distance: Math.sqrt(distanceCarree(reponses, monstre.profil)),
  }));
  const min = Math.min(...distances.map((d) => d.distance));
  return distances.filter((d) => d.distance <= min + MARGE);
}

/**
 * Départage des ex æquo : le rôle le moins peuplé l'emporte, puis tirage au
 * hasard si les effectifs sont égaux. Les membres ne sont récupérés (fetch
 * complet, intent Server Members requis) qu'en cas d'égalité.
 */
async function departager(guild, candidats) {
  if (candidats.length === 1) return candidats[0];

  await guild.members.fetch();
  const avecEffectif = candidats.map((c) => ({
    ...c,
    effectif: guild.roles.cache.get(c.monstre.roleId)?.members.size ?? 0,
  }));
  const effectifMin = Math.min(...avecEffectif.map((c) => c.effectif));
  const restants = avecEffectif.filter((c) => c.effectif === effectifMin);
  return restants[Math.floor(Math.random() * restants.length)];
}

/**
 * Trouve le monstre correspondant aux réponses (13 entiers de 1 à 10).
 * @returns {Promise<{ monstre, distance: number, compatibilite: number }>}
 */
async function trouverMonstre(guild, reponses) {
  const gagnant = await departager(guild, candidatsLesPlusProches(reponses));
  return {
    monstre: gagnant.monstre,
    distance: gagnant.distance,
    compatibilite: compatibilite(gagnant.distance),
  };
}

// ---------------------------------------------------------------------------
// Rôles
// ---------------------------------------------------------------------------

/** Monstre déjà attribué au membre (via ses rôles), ou null. */
function monstreDuMembre(member) {
  return monstres().find((m) => m.roleId && member.roles.cache.has(m.roleId)) ?? null;
}

function problemePermissionGerer(guild) {
  return guild.members.me?.permissions.has(PermissionFlagsBits.ManageRoles)
    ? null
    : 'le bot n\'a pas la permission « Gérer les rôles »';
}

/**
 * Vérifie que le bot peut attribuer ce rôle : permission Manage Roles et
 * rôle du bot au-dessus du rôle monstre dans la hiérarchie.
 * @returns {string|null} message d'erreur, ou null si tout est bon
 */
function problemePermission(guild, role) {
  const probleme = problemePermissionGerer(guild);
  if (probleme) return probleme;
  if (guild.members.me.roles.highest.comparePositionTo(role) <= 0) {
    return `le rôle du bot doit être placé au-dessus du rôle « ${role.name} » dans la hiérarchie du serveur`;
  }
  if (role.managed) {
    return `le rôle « ${role.name} » est géré par une intégration et ne peut pas être attribué`;
  }
  return null;
}

/**
 * Attribue au membre le rôle du monstre.
 * @returns {Promise<string|null>} message d'erreur, ou null si réussi
 */
async function attribuerRole(member, monstre) {
  const role = member.guild.roles.cache.get(monstre.roleId)
    ?? (await member.guild.roles.fetch(monstre.roleId).catch(() => null));
  if (!role) return `le rôle du monstre « ${monstre.nom} » est introuvable (relancer /quiz-monstre-init)`;

  const probleme = problemePermission(member.guild, role);
  if (probleme) return probleme;

  try {
    await member.roles.add(role, RAISON_AUDIT);
    return null;
  } catch (err) {
    console.error(`[QUEL-MONSTRE] Échec de l'attribution du rôle ${role.id} à ${member.user.tag} :`, err);
    return 'Discord a refusé l\'attribution du rôle';
  }
}

/**
 * Crée le rôle d'un monstre : affiché séparément dans la liste des membres,
 * et placé tout en bas de la hiérarchie. Pas besoin de `position` : Discord
 * crée tout nouveau rôle juste au-dessus de @everyone, donc créer les monstres
 * dans l'ordre de la liste les range de haut en bas dans ce même ordre.
 * Ensuite, position et affichage se gèrent dans les paramètres des rôles.
 */
function creerRole(guild, { nom, couleur }) {
  return guild.roles.create({
    name: nom,
    ...(couleur != null ? { colors: { primaryColor: couleur } } : {}),
    hoist: true,
    mentionable: false,
    permissions: [],
    reason: RAISON_AUDIT,
  });
}

// ---------------------------------------------------------------------------
// Gestion des monstres (/quiz-monstre-init, -ajouter, -supprimer)
// ---------------------------------------------------------------------------

/**
 * Erreurs d'une définition de monstre (nom, description, profil).
 * `nomsPris` : noms déjà utilisés (en minuscules), pour refuser les doublons.
 */
function erreursMonstre({ nom, description, profil }, nomsPris = new Set()) {
  const erreurs = [];
  if (!nom || !String(nom).trim()) erreurs.push('nom manquant');
  else if (nom.length > LONGUEUR_NOM_MAX) erreurs.push(`nom « ${nom} » trop long (${LONGUEUR_NOM_MAX} caractères max)`);
  else if (nomsPris.has(nom.trim().toLowerCase())) erreurs.push(`un monstre s'appelle déjà « ${nom} »`);
  if (!description || !String(description).trim()) erreurs.push(`description manquante pour « ${nom} »`);
  else if (description.length > LONGUEUR_DESCRIPTION_MAX) {
    erreurs.push(`description de « ${nom} » trop longue (${LONGUEUR_DESCRIPTION_MAX} caractères max)`);
  }
  const profilValide =
    Array.isArray(profil) &&
    profil.length === questions.length &&
    profil.every((v) => Number.isInteger(v) && v >= VALEUR_MIN && v <= VALEUR_MAX);
  if (!profilValide) {
    erreurs.push(`profil invalide pour « ${nom} » : il faut ${questions.length} entiers entre ${VALEUR_MIN} et ${VALEUR_MAX}`);
  }
  return erreurs;
}

function nomsUtilises(guild, sauf = null) {
  const noms = new Set();
  for (const m of monstres()) {
    if (m === sauf) continue;
    noms.add(m.nom.toLowerCase());
    noms.add(nomAffiche(guild, m).toLowerCase());
  }
  return noms;
}

/** Erreurs de la liste initiale (data/monstres-initiaux.js). */
function erreursMonstresInitiaux() {
  const erreurs = [];
  const noms = new Set();
  for (const m of monstresInitiaux) {
    erreurs.push(...erreursMonstre(m, noms));
    if (m.nom) noms.add(m.nom.trim().toLowerCase());
    // Les descriptions sont copiées dans data-store/ à l'import et le fichier
    // n'est plus relu ensuite : on refuse d'importer des textes provisoires.
    if (/^\s*TODO/i.test(m.description ?? '')) {
      erreurs.push(`description provisoire (TODO) pour « ${m.nom} » : à remplir avant l'init`);
    }
    if (m.couleur != null && !(Number.isInteger(m.couleur) && m.couleur >= 0 && m.couleur <= 0xffffff)) {
      erreurs.push(`couleur invalide pour « ${m.nom} » (format attendu : 0x8b0000)`);
    }
  }
  return erreurs;
}

/**
 * /quiz-monstre-init :
 *  - première fois (aucun monstre enregistré) : importe la liste de
 *    data/monstres-initiaux.js et crée un rôle par monstre ;
 *  - ensuite : recrée seulement les rôles supprimés à la main. Les rôles
 *    existants ne sont jamais modifiés (nom et couleur se gèrent depuis
 *    Discord) et la liste initiale n'est plus relue.
 *
 * La liste est enregistrée après CHAQUE création, pour ne pas perdre les
 * rôles déjà créés si Discord échoue en cours de route (relancer la
 * commande reprend là où elle s'est arrêtée).
 *
 * @returns {Promise<{ import: boolean, crees, recrees, conserves, echecs }>}
 */
function initialiser(guild) {
  return avecVerrou(async () => {
    await guild.roles.fetch();
    const rapport = { import: false, crees: [], recrees: [], conserves: [], echecs: [] };
    const liste = monstres().map((m) => ({ ...m }));

    if (liste.length === 0) {
      rapport.import = true;
      for (const m of monstresInitiaux) {
        liste.push({
          roleId: null,
          nom: m.nom.trim(),
          description: m.description.trim(),
          couleur: m.couleur ?? null,
          profil: [...m.profil],
        });
      }
    }

    for (const monstre of liste) {
      const existant = monstre.roleId ? guild.roles.cache.get(monstre.roleId) : null;
      if (existant) {
        rapport.conserves.push({ monstre, role: existant });
        continue;
      }
      const etaitCree = Boolean(monstre.roleId);
      try {
        const role = await creerRole(guild, monstre);
        monstre.roleId = role.id;
        store.setMonstres(liste);
        (etaitCree ? rapport.recrees : rapport.crees).push({ monstre, role });
      } catch (err) {
        console.error(`[QUEL-MONSTRE] Création du rôle « ${monstre.nom} » impossible :`, err);
        rapport.echecs.push({ monstre, erreur: err.message });
      }
    }

    // Toute la liste est enregistrée, y compris les monstres dont le rôle
    // n'a pas pu être créé : la vérification les signale et la prochaine
    // init réessaiera.
    store.setMonstres(liste);
    return rapport;
  });
}

/**
 * Ajoute un monstre : crée son rôle puis l'enregistre.
 * @returns {Promise<{ monstre?, role?, erreurs?: string[] }>}
 */
function ajouterMonstre(guild, { nom, description, profil, couleur }) {
  return avecVerrou(async () => {
    await guild.roles.fetch();
    const donnees = { nom: nom.trim(), description: description.trim(), profil, couleur: couleur ?? null };
    const erreurs = erreursMonstre(donnees, nomsUtilises(guild));
    if (erreurs.length) return { erreurs };

    const role = await creerRole(guild, donnees);
    const monstre = { roleId: role.id, ...donnees };
    store.setMonstres([...monstres(), monstre]);
    return { monstre, role };
  });
}

/**
 * Supprime un monstre du quiz, et son rôle Discord si demandé. Les membres
 * qui avaient ce rôle pourront repasser le quiz (le rôle n'est plus un rôle
 * monstre, ou n'existe plus).
 * @returns {Promise<{ monstre?, roleSupprime: boolean, erreur?: string }>}
 */
function supprimerMonstre(guild, monstreCible, { supprimerRole }) {
  return avecVerrou(async () => {
    const monstre = monstres().find((m) => m === monstreCible);
    if (!monstre) return { roleSupprime: false, erreur: 'ce monstre n\'existe plus.' };

    store.setMonstres(monstres().filter((m) => m !== monstre));

    const { roleId } = monstre;
    if (!supprimerRole || !roleId) return { monstre, roleSupprime: false };
    const role = guild.roles.cache.get(roleId) ?? (await guild.roles.fetch(roleId).catch(() => null));
    if (!role) return { monstre, roleSupprime: false };
    try {
      await role.delete(RAISON_AUDIT);
      return { monstre, roleSupprime: true };
    } catch (err) {
      console.error(`[QUEL-MONSTRE] Suppression du rôle ${roleId} impossible :`, err);
      return { monstre, roleSupprime: false, erreur: `le rôle n'a pas pu être supprimé (${err.message}), supprime-le à la main.` };
    }
  });
}

/** Effectif actuel du rôle d'un monstre (fetch complet des membres). */
async function effectif(guild, monstre) {
  await guild.members.fetch();
  return guild.roles.cache.get(monstre.roleId)?.members.size ?? 0;
}

/** Monstres ayant exactement ce profil (toujours ex æquo avec lui). */
function profilsIdentiques(profil, sauf = null) {
  return monstres().filter((m) => m !== sauf && m.profil.every((v, i) => v === profil[i]));
}

// ---------------------------------------------------------------------------
// Vérification de la configuration
// ---------------------------------------------------------------------------

/**
 * Appelée au démarrage (client prêt) et après chaque modification des
 * monstres. Vérifie les questions, les monstres enregistrés et que chacun a
 * un rôle existant sur le serveur. En cas d'erreur, le quiz reste
 * désactivé. Les problèmes de permission sont signalés sans bloquer
 * (revérifiés à chaque attribution).
 *
 * @returns {Promise<{ pret: boolean, erreur: string|null, details: string[] }>}
 */
async function verifierConfiguration(client) {
  const erreurs = [];
  const liste = monstres();

  if (questions.length === 0) erreurs.push('aucune question définie dans data/questions.js');
  if (liste.length === 0) erreurs.push('aucun monstre enregistré : lance /quiz-monstre-init');
  for (const m of liste) erreurs.push(...erreursMonstre(m));

  let guild = null;
  if (!erreurs.length) {
    try {
      guild = await client.guilds.fetch(config.guildId);
      await guild.roles.fetch();
    } catch (err) {
      erreurs.push(`impossible de récupérer les rôles du serveur ${config.guildId} (${err.message})`);
    }
  }

  if (guild) {
    const sansRole = liste.filter((m) => !m.roleId || !guild.roles.cache.has(m.roleId));
    if (sansRole.length) {
      erreurs.push(
        `rôle supprimé du serveur pour : ${sansRole.map((m) => m.nom).join(', ')} — relance /quiz-monstre-init pour le recréer`
      );
    }
  }

  if (erreurs.length) {
    etat = { pret: false, erreur: 'la configuration du quiz est incomplète (voir les logs du bot).', details: erreurs };
    console.error(`[QUEL-MONSTRE] ❌ Configuration invalide — /quiz-monstre désactivé :\n  - ${erreurs.join('\n  - ')}`);
    return etat;
  }

  const avertissements = [
    ...new Set(liste.map((m) => problemePermission(guild, guild.roles.cache.get(m.roleId))).filter(Boolean)),
  ];
  for (const a of avertissements) {
    console.warn(`[QUEL-MONSTRE] ⚠️  Attribution des rôles impossible en l'état : ${a}.`);
  }

  etat = { pret: true, erreur: null, details: avertissements };
  console.log(`[QUEL-MONSTRE] ✅ ${liste.length} monstres, ${questions.length} questions, rôles vérifiés.`);
  return etat;
}

module.exports = {
  MARGE,
  DISTANCE_MAX,
  LONGUEUR_NOM_MAX,
  LONGUEUR_DESCRIPTION_MAX,
  questions,
  monstres,
  etatConfiguration,
  nomAffiche,
  trouverParRoleOuNom,
  lireProfil,
  lireCouleur,
  distanceCarree,
  compatibilite,
  candidatsLesPlusProches,
  trouverMonstre,
  monstreDuMembre,
  problemePermissionGerer,
  attribuerRole,
  erreursMonstresInitiaux,
  initialiser,
  ajouterMonstre,
  supprimerMonstre,
  effectif,
  profilsIdentiques,
  verifierConfiguration,
};
