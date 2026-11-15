// Rendu PNG du programme des Séances Ciné, identité « Chair » de Funny
// Games, via @napi-rs/canvas :
// - en-tête : mur de chair veinée, globes oculaires baveux, titre qui saigne ;
// - séances : fiches sérigraphiées (trame de points, affiche décalée comme
//   une impression mal calée, ticket de date incliné à liseré vert fluo).
// Pur dessin : reçoit une liste de séances déjà préparées (titre, type,
// année, synopsis ou épisodes, date, buffer d'affiche) et renvoie des
// Buffers PNG. Aucune dépendance à Discord ni au store. Les motifs
// aléatoires partent d'une graine fixe : une même séance donne toujours la
// même image.

const path = require('path');
const { createCanvas, loadImage, GlobalFonts } = require('@napi-rs/canvas');

const FONTS_DIR = path.join(__dirname, 'fonts');
GlobalFonts.registerFromPath(path.join(FONTS_DIR, 'Anton-Regular.ttf'), 'Anton');
GlobalFonts.registerFromPath(path.join(FONTS_DIR, 'Nosifer-Regular.ttf'), 'Nosifer');
GlobalFonts.registerFromPath(path.join(FONTS_DIR, 'SpaceMono-Bold.ttf'), 'Space Mono');
GlobalFonts.registerFromPath(path.join(FONTS_DIR, 'Outfit-Regular.ttf'), 'Outfit');

const LARGEUR = 1200;
const ENTETE_H = 352;
const FICHE_H = 390;
const PIED_H = 64; // phrase d'accroche sous la dernière séance
const VIDE_H = 150; // message "aucune séance" sous l'en-tête

const SEANCES_PREMIERE_IMAGE = 4;
const SEANCES_IMAGES_SUIVANTES = 5;

// Palette des fiches (sérigraphie rouge sur fond sang séché) + touche fluo.
const P = {
  fond: '#170707',
  trame: 'rgba(255,45,74,0.13)',
  accent: '#ff2d4a',
  second: '#f08a74',
  creme: '#f6e4cf',
  texte: '#dcc5b2',
  fluo: '#7dff2e',
};

// Couleurs d'iris : [clair, moyen, sombre]
const IRIS = {
  vert: ['#d6ff8a', '#4fae2a', '#123d0c'],
  violet: ['#e2b8ff', '#8a3fc4', '#2a0b45'],
  bleu: ['#bfe0ff', '#3a6fd8', '#0c1f52'],
  jaune: ['#fff3a0', '#e0a512', '#4a2a02'],
  cyan: ['#c8fbff', '#18b6d6', '#06384a'],
  brun: ['#e8b98a', '#7a4320', '#2a1205'],
  gris: ['#eef2f5', '#8d98a3', '#2c333a'],
  rouge: ['#ffb0a0', '#d0281e', '#4a0505'],
};
const IRIS_FICHES = ['vert', 'jaune', 'violet', 'cyan', 'rouge', 'bleu'];

const BAVE = { vert: '#6cc21c', sombre: '#2b5a08', clair: '#c4ff6a' };

// --- Outils -------------------------------------------------------------

/** Générateur pseudo-aléatoire déterministe (mulberry32). */
function rng(graine) {
  let seed = graine;
  return function () {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Graine stable tirée d'un texte (titre de la séance). */
function graineDe(texte) {
  let h = 2166136261;
  for (const c of texte) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  return h >>> 0;
}

/**
 * Dessine un texte avec un espacement entre lettres, caractère par
 * caractère. `align` : 'left' | 'center'. Renvoie la largeur totale.
 */
function texteEspace(ctx, texte, x, y, espacement, align = 'left') {
  const chars = [...texte];
  const largeurs = chars.map((c) => ctx.measureText(c).width);
  const total = largeurs.reduce((a, b) => a + b, 0) + espacement * (chars.length - 1);
  let cx = align === 'center' ? x - total / 2 : x;
  const alignAvant = ctx.textAlign;
  ctx.textAlign = 'left';
  chars.forEach((c, i) => {
    ctx.fillText(c, cx, y);
    cx += largeurs[i] + espacement;
  });
  ctx.textAlign = alignAvant;
  return total;
}

/**
 * Découpe un texte en lignes tenant dans `maxLargeur`, au plus `maxLignes`
 * — la dernière ligne est tronquée avec "…" si le texte déborde.
 */
function decouperLignes(ctx, texte, maxLargeur, maxLignes) {
  // Espace insécable devant la ponctuation haute française, pour ne jamais
  // commencer une ligne par ":" ou "?".
  const mots = texte.replace(/\s+/g, ' ').trim().replace(/ ([:;!?»])/g, ' $1').split(' ');
  const lignes = [];
  let courante = '';

  for (let i = 0; i < mots.length; i++) {
    const essai = courante ? `${courante} ${mots[i]}` : mots[i];
    if (ctx.measureText(essai).width <= maxLargeur) {
      courante = essai;
      continue;
    }
    if (courante) lignes.push(courante);
    courante = mots[i];
    if (lignes.length === maxLignes) {
      courante = null;
      break;
    }
  }
  if (courante) lignes.push(courante);

  const deborde = lignes.length > maxLignes || courante === null;
  const resultat = lignes.slice(0, maxLignes);
  if (deborde) {
    let derniere = resultat[maxLignes - 1];
    while (derniere.length && ctx.measureText(`${derniere}…`).width > maxLargeur) {
      derniere = derniere.replace(/\s*\S+$/, '');
    }
    resultat[maxLignes - 1] = `${derniere.replace(/[\s.,;:!?…-]+$/, '')}…`;
  }
  return resultat;
}

/** Plus grande taille de police (≤ depart) pour que `texte` tienne dans maxW. */
function ajusterPolice(ctx, texte, famille, maxW, depart) {
  let taille = depart;
  for (; taille > 20; taille -= 2) {
    ctx.font = `${taille}px ${famille}`;
    if (ctx.measureText(texte).width <= maxW) break;
  }
  return taille;
}

function grain(ctx, x0, y0, w, h, r, nb, couleur, alpha) {
  ctx.save();
  ctx.fillStyle = couleur;
  for (let i = 0; i < nb; i++) {
    ctx.globalAlpha = alpha * r();
    ctx.fillRect(x0 + r() * w, y0 + r() * h, 1 + r() * 1.5, 1 + r() * 1.5);
  }
  ctx.restore();
}

/** Trame de points façon sérigraphie ; `rayon(x, y)` donne la taille du point. */
function trame(ctx, x0, y0, w, h, pas, couleur, rayon) {
  ctx.save();
  ctx.fillStyle = couleur;
  for (let y = y0; y < y0 + h; y += pas) {
    const decale = Math.round((y - y0) / pas) % 2 ? pas / 2 : 0;
    for (let x = x0 + decale; x < x0 + w; x += pas) {
      const rr = rayon(x, y);
      if (rr <= 0.1) continue;
      ctx.beginPath();
      ctx.arc(x, y, rr, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.restore();
}

/** Veine ramifiée (récursive). */
function veine(ctx, r, x, y, angle, long, larg, prof, couleur) {
  if (prof <= 0 || larg < 0.4) return;
  const x2 = x + Math.cos(angle) * long;
  const y2 = y + Math.sin(angle) * long;
  const cx = (x + x2) / 2 + (r() - 0.5) * long * 0.6;
  const cy = (y + y2) / 2 + (r() - 0.5) * long * 0.6;
  ctx.strokeStyle = couleur;
  ctx.lineWidth = larg;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.quadraticCurveTo(cx, cy, x2, y2);
  ctx.stroke();
  const nb = r() < 0.6 ? 2 : 1;
  for (let i = 0; i < nb; i++) {
    veine(ctx, r, x2, y2, angle + (r() - 0.5) * 1.3, long * (0.6 + r() * 0.25), larg * 0.68, prof - 1, couleur);
  }
}

// --- Globes oculaires -----------------------------------------------------

// Coulures de bave dessinées AVANT le globe : elles partent du centre, la
// sphère cache leur départ et seules les gouttes sous l'œil restent visibles.
function coulures(ctx, r, x, y, R) {
  const nb = 1 + Math.floor(r() * 2);
  ctx.save();
  ctx.lineWidth = Math.max(1.2, R / 20);
  for (let k = 0; k < nb; k++) {
    const px = x + (r() < 0.5 ? -1 : 1) * R * (0.25 + r() * 0.45);
    const l = R * (1.15 + r() * 0.9);
    const w = R * (0.1 + r() * 0.06);
    ctx.beginPath();
    ctx.moveTo(px - w, y);
    ctx.lineTo(px - w * 0.75, y + l);
    ctx.arc(px, y + l, w * 0.75, Math.PI, 0, true);
    ctx.lineTo(px + w, y);
    ctx.closePath();
    ctx.fillStyle = BAVE.vert;
    ctx.fill();
    ctx.strokeStyle = BAVE.sombre;
    ctx.stroke();
    ctx.fillStyle = BAVE.clair;
    ctx.beginPath();
    ctx.ellipse(px - w * 0.35, y + l * 0.85, w * 0.16, w * 0.6, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

// Calotte de bave sur le haut du globe, bord inférieur ondulé, sans toucher l'iris.
function calotteBave(ctx, r, x, y, R) {
  const a0 = Math.PI * (1.08 + r() * 0.12);
  const a1 = Math.PI * (1.8 + r() * 0.12);
  ctx.save();
  ctx.beginPath();
  for (let i = 0; i <= 16; i++) {
    const a = a0 + (a1 - a0) * (i / 16);
    const px = x + Math.cos(a) * R * 1.05;
    const py = y + Math.sin(a) * R * 1.05;
    if (i) ctx.lineTo(px, py);
    else ctx.moveTo(px, py);
  }
  for (let i = 16; i >= 0; i--) {
    const a = a0 + (a1 - a0) * (i / 16);
    const p = 0.8 + r() * 0.08 - (i % 5 === 2 ? 0.1 : 0);
    ctx.lineTo(x + Math.cos(a) * R * p, y + Math.sin(a) * R * p);
  }
  ctx.closePath();
  ctx.fillStyle = BAVE.vert;
  ctx.fill();
  ctx.strokeStyle = BAVE.sombre;
  ctx.lineWidth = Math.max(1.2, R / 20);
  ctx.lineJoin = 'round';
  ctx.stroke();
  ctx.strokeStyle = BAVE.clair;
  ctx.lineWidth = Math.max(1, R / 16);
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.arc(x, y, R * 0.95, a0 + 0.2, a0 + (a1 - a0) * 0.4);
  ctx.stroke();
  ctx.restore();
}

/**
 * Globe oculaire injecté de sang : sphère ombrée, veines, iris strié
 * (aplati dans la direction du regard), pupille ronde ou fendue, reflets,
 * bave verte facultative.
 */
function globe(ctx, r, x, y, R, { iris = 'vert', regard = [0, 0], fente = false, bave = false } = {}) {
  const [clair, moyen, sombre] = IRIS[iris];
  const [dx, dy] = regard;
  ctx.save();
  if (bave) coulures(ctx, r, x, y, R);

  // Ombre portée dans la chair
  const ombre = ctx.createRadialGradient(x + R * 0.12, y + R * 0.22, R * 0.7, x + R * 0.12, y + R * 0.22, R * 1.4);
  ombre.addColorStop(0, 'rgba(20,0,2,0.75)');
  ombre.addColorStop(1, 'rgba(20,0,2,0)');
  ctx.fillStyle = ombre;
  ctx.beginPath();
  ctx.arc(x + R * 0.12, y + R * 0.22, R * 1.4, 0, Math.PI * 2);
  ctx.fill();

  // Sphère
  ctx.beginPath();
  ctx.arc(x, y, R, 0, Math.PI * 2);
  const sphere = ctx.createRadialGradient(x - R * 0.35, y - R * 0.4, R * 0.1, x, y, R);
  sphere.addColorStop(0, '#fffdf4');
  sphere.addColorStop(0.55, '#f3ead6');
  sphere.addColorStop(0.88, '#d8c7aa');
  sphere.addColorStop(1, '#a8927a');
  ctx.fillStyle = sphere;
  ctx.fill();

  ctx.save();
  ctx.clip();
  for (let i = 0; i < 11; i++) {
    const a = r() * Math.PI * 2;
    veine(
      ctx, r,
      x + Math.cos(a) * R * 1.02, y + Math.sin(a) * R * 1.02,
      a + Math.PI + (r() - 0.5) * 0.5, R * (0.22 + r() * 0.12),
      Math.max(0.7, R / 30), 3, 'rgba(196,34,40,0.85)'
    );
  }

  // Iris
  const ix = x + dx * R * 0.36;
  const iy = y + dy * R * 0.36;
  const ir = R * 0.56;
  ctx.save();
  ctx.translate(ix, iy);
  ctx.scale(1 - Math.abs(dx) * 0.22, 1 - Math.abs(dy) * 0.22);
  const gi = ctx.createRadialGradient(-ir * 0.15, -ir * 0.2, ir * 0.05, 0, 0, ir);
  gi.addColorStop(0, clair);
  gi.addColorStop(0.55, moyen);
  gi.addColorStop(0.9, sombre);
  gi.addColorStop(1, '#050505');
  ctx.fillStyle = gi;
  ctx.beginPath();
  ctx.arc(0, 0, ir, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,0.18)';
  ctx.lineWidth = Math.max(0.6, R / 45);
  for (let i = 0; i < 34; i++) {
    const a = (i / 34) * Math.PI * 2;
    ctx.beginPath();
    ctx.moveTo(Math.cos(a) * ir * 0.42, Math.sin(a) * ir * 0.42);
    ctx.lineTo(Math.cos(a) * ir * 0.92, Math.sin(a) * ir * 0.92);
    ctx.stroke();
  }
  ctx.fillStyle = '#050303';
  ctx.beginPath();
  if (fente) ctx.ellipse(0, 0, ir * 0.17, ir * 0.78, 0, 0, Math.PI * 2);
  else ctx.arc(0, 0, ir * 0.4, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#0a0606';
  ctx.lineWidth = Math.max(1, R / 28);
  ctx.beginPath();
  ctx.arc(0, 0, ir, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();

  // Ombrage de la sphère (bas-droite) puis reflets
  const ombrage = ctx.createRadialGradient(x - R * 0.3, y - R * 0.35, R * 0.55, x, y, R * 1.05);
  ombrage.addColorStop(0, 'rgba(60,30,20,0)');
  ombrage.addColorStop(1, 'rgba(60,30,20,0.45)');
  ctx.fillStyle = ombrage;
  ctx.fillRect(x - R, y - R, 2 * R, 2 * R);
  ctx.fillStyle = 'rgba(255,255,255,0.95)';
  ctx.beginPath();
  ctx.ellipse(ix - ir * 0.38, iy - ir * 0.42, ir * 0.26, ir * 0.17, -0.6, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(ix + ir * 0.3, iy + ir * 0.32, ir * 0.08, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  ctx.strokeStyle = '#2a120c';
  ctx.lineWidth = Math.max(1.4, R / 16);
  ctx.beginPath();
  ctx.arc(x, y, R, 0, Math.PI * 2);
  ctx.stroke();
  if (bave) calotteBave(ctx, r, x, y, R);
  ctx.restore();
}

// --- En-tête « Chair » ------------------------------------------------------

// [x, y, rayon, iris, regard, pupille fendue, bave]
const YEUX_ENTETE = [
  [78, 92, 54, 'vert', [0.7, 0.35], false, true],
  [168, 268, 36, 'jaune', [0.9, -0.3], true, false],
  [42, 214, 20, 'bleu', [1, 0], false, false],
  [1118, 104, 58, 'violet', [-0.75, 0.35], true, true],
  [1036, 282, 32, 'cyan', [-0.9, -0.25], false, true],
  [1168, 248, 20, 'rouge', [-1, 0], false, false],
  [272, 58, 17, 'brun', [0.4, 0.8], false, false],
  [930, 52, 21, 'vert', [-0.4, 0.9], true, false],
  [252, 322, 15, 'gris', [0.5, -1], false, false],
  [978, 330, 13, 'jaune', [-0.3, -1], false, false],
];

function dessinerEntete(ctx, hauteur) {
  const r = rng(13);

  // Chair : dégradé, marbrures claires/sombres, veines, grain
  ctx.fillStyle = '#1e0507';
  ctx.fillRect(0, 0, LARGEUR, hauteur);
  const fond = ctx.createRadialGradient(LARGEUR / 2, ENTETE_H * 0.55, 40, LARGEUR / 2, ENTETE_H * 0.55, 720);
  fond.addColorStop(0, '#9c3a35');
  fond.addColorStop(0.5, '#5e1719');
  fond.addColorStop(1, '#1e0507');
  ctx.fillStyle = fond;
  ctx.fillRect(0, 0, LARGEUR, hauteur);
  for (let i = 0; i < 260; i++) {
    const x = r() * LARGEUR;
    const y = r() * hauteur;
    const rr = 20 + r() * 70;
    const g = ctx.createRadialGradient(x, y, 0, x, y, rr);
    g.addColorStop(0, r() < 0.5 ? 'rgba(232,140,120,0.16)' : 'rgba(40,0,5,0.2)');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.fillRect(x - rr, y - rr, rr * 2, rr * 2);
  }
  for (let i = 0; i < 22; i++) {
    veine(ctx, r, r() * LARGEUR, r() * hauteur, r() * Math.PI * 2, 40 + r() * 60, 2.5 + r() * 2.5, 5, 'rgba(60,8,40,0.55)');
  }
  grain(ctx, 0, 0, LARGEUR, hauteur, r, 9000, '#2a0004', 0.5);

  for (const [x, y, R, iris, regard, fente, bave] of YEUX_ENTETE) {
    globe(ctx, r, x, y, R, { iris, regard, fente, bave });
  }

  ctx.textBaseline = 'alphabetic';
  ctx.font = '20px "Space Mono"';
  ctx.fillStyle = '#f0d9b5';
  texteEspace(ctx, 'FUNNY GAMES PRÉSENTE', LARGEUR / 2, 62, 7, 'center');

  // Titre qui saigne + ombre portée
  const taille = ajusterPolice(ctx, 'SÉANCES CINÉ', 'Nosifer', 820, 96);
  ctx.font = `${taille}px Nosifer`;
  ctx.textAlign = 'center';
  ctx.fillStyle = '#2a0306';
  ctx.fillText('SÉANCES CINÉ', LARGEUR / 2 + 5, 211);
  ctx.fillStyle = '#f2e3c6';
  ctx.fillText('SÉANCES CINÉ', LARGEUR / 2, 205);
  ctx.textAlign = 'left';

  // "AU PROGRAMME" encadré de deux filets
  ctx.font = '30px Anton';
  ctx.fillStyle = '#f0d9b5';
  const l = texteEspace(ctx, 'AU PROGRAMME', LARGEUR / 2, 300, 9, 'center');
  ctx.fillRect(LARGEUR / 2 - l / 2 - 140, 288, 110, 3);
  ctx.fillRect(LARGEUR / 2 + l / 2 + 30, 288, 110, 3);
}

// --- Fiche séance ---------------------------------------------------------

const AFFICHE = { x: 64, y: 52, w: 180, h: 270 };
const COL_TEXTE_X = 290;
const COL_TEXTE_W = 560;
const TICKET = { cx: 1032, cy: 190, w: 196, h: 244 };

function dessinerFondFiche(ctx, y0, hauteur, r) {
  ctx.fillStyle = P.fond;
  ctx.fillRect(0, y0, LARGEUR, hauteur);
  trame(ctx, 0, y0, LARGEUR, hauteur, 14, P.trame, (x) => 1.6 + 1.1 * (x / LARGEUR));
  grain(ctx, 0, y0, LARGEUR, hauteur, r, 5000, '#000', 0.5);
}

/** Affiche TMDB en "cover", décalée sur un aplat rouge (repérage raté). */
function dessinerAffiche(ctx, image, y0) {
  const { x, w, h } = AFFICHE;
  const y = y0 + AFFICHE.y;
  ctx.fillStyle = P.accent;
  ctx.fillRect(x + 10, y + 8, w, h);

  if (image) {
    const ratio = Math.max(w / image.width, h / image.height);
    const sw = w / ratio;
    const sh = h / ratio;
    ctx.drawImage(image, (image.width - sw) / 2, (image.height - sh) / 2, sw, sh, x, y, w, h);
  } else {
    const g = ctx.createLinearGradient(x, y, x, y + h);
    g.addColorStop(0, P.second);
    g.addColorStop(1, '#4a0a10');
    ctx.fillStyle = g;
    ctx.fillRect(x, y, w, h);
    trame(ctx, x, y, w, h, 9, P.fond, (px, py) => 3.6 * ((py - y) / h) + 0.4 * Math.sin(px * 0.05));
    ctx.font = '24px Anton';
    ctx.fillStyle = P.creme;
    ctx.textAlign = 'center';
    ctx.fillText('PAS D’AFFICHE', x + w / 2, y + h / 2);
    ctx.textAlign = 'left';
  }
}

function dessinerTexte(ctx, seance, y0) {
  const x = COL_TEXTE_X;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';

  // Étiquette Film / Série / Jeu vidéo + année
  ctx.font = '18px Anton';
  const libelle = seance.type.toUpperCase();
  const largeurLibelle =
    [...libelle].reduce((a, c) => a + ctx.measureText(c).width, 0) + 3 * (libelle.length - 1) + 24;
  ctx.fillStyle = P.accent;
  ctx.fillRect(x, y0 + 60, largeurLibelle, 32);
  ctx.fillStyle = P.fond;
  texteEspace(ctx, libelle, x + 12, y0 + 84, 3);
  if (seance.annee) {
    ctx.font = '17px "Space Mono"';
    ctx.fillStyle = P.second;
    ctx.fillText(seance.annee, x + largeurLibelle + 14, y0 + 83);
  }

  // Titre : 2 lignes max, réduit tant qu'il est tronqué
  let taille = 58;
  let lignesTitre;
  for (; taille >= 36; taille -= 4) {
    ctx.font = `${taille}px Anton`;
    lignesTitre = decouperLignes(ctx, seance.titre.toUpperCase(), COL_TEXTE_W, 2);
    if (!lignesTitre[lignesTitre.length - 1].endsWith('…')) break;
  }
  let y = y0 + 108 + taille;
  for (const ligne of lignesTitre) {
    ctx.fillStyle = P.accent;
    ctx.fillText(ligne, x + 5, y + 5);
    ctx.fillStyle = P.creme;
    ctx.fillText(ligne, x, y);
    y += Math.round(taille * 1.02);
  }
  const yFin = y0 + AFFICHE.y + AFFICHE.h + 8;

  if (seance.episodes) {
    ctx.font = '22px Anton';
    ctx.fillStyle = P.accent;
    texteEspace(ctx, seance.episodes.entete, x, y + 12, 2);
    ctx.font = '19px Outfit';
    ctx.fillStyle = P.texte;
    let sy = y + 44;
    const maxLignes = Math.max(1, Math.floor((yFin - sy + 20) / 27));
    let lignes = seance.episodes.lignes;
    if (lignes.length > maxLignes) {
      const reste = lignes.length - (maxLignes - 1);
      lignes = [...lignes.slice(0, maxLignes - 1), `+ ${reste} autre${reste > 1 ? 's' : ''} épisode${reste > 1 ? 's' : ''}`];
    }
    for (const ligne of lignes) {
      ctx.fillText(decouperLignes(ctx, ligne, COL_TEXTE_W, 1)[0], x, sy);
      sy += 27;
    }
    return;
  }

  // Synopsis : autant de lignes que la place restante le permet (4 max)
  ctx.font = '19px Outfit';
  ctx.fillStyle = P.texte;
  const debut = y + 10;
  const maxLignes = Math.max(1, Math.min(4, Math.floor((yFin - debut) / 28)));
  decouperLignes(ctx, seance.synopsis || '', COL_TEXTE_W, maxLignes).forEach((ligne, i) => {
    ctx.fillText(ligne, x, debut + 8 + i * 28);
  });
}

/** Ticket de date incliné, liseré vert fluo lumineux. */
function dessinerTicket(ctx, seance, y0) {
  const { w, h } = TICKET;
  ctx.save();
  ctx.translate(TICKET.cx, y0 + TICKET.cy);
  ctx.rotate(-0.04);

  ctx.fillStyle = P.accent;
  ctx.fillRect(-w / 2 + 9, -h / 2 + 9, w, h);
  ctx.fillStyle = P.creme;
  ctx.fillRect(-w / 2, -h / 2, w, h);

  ctx.save();
  ctx.shadowColor = P.fluo;
  ctx.shadowBlur = 14;
  ctx.strokeStyle = P.fluo;
  ctx.lineWidth = 3;
  ctx.strokeRect(-w / 2 - 7, -h / 2 - 7, w + 14, h + 14);
  ctx.restore();

  ctx.strokeStyle = P.fond;
  ctx.lineWidth = 2;
  ctx.setLineDash([8, 6]);
  ctx.strokeRect(-w / 2 + 9, -h / 2 + 9, w - 18, h - 18);
  ctx.setLineDash([]);

  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = P.fond;
  ctx.font = '22px Anton';
  texteEspace(ctx, seance.jour.toUpperCase(), 0, -h / 2 + 48, 4, 'center');
  ctx.font = '78px Anton';
  ctx.textAlign = 'center';
  ctx.fillText(seance.numero, 0, -h / 2 + 130);
  ctx.font = '17px "Space Mono"';
  texteEspace(ctx, seance.mois.toUpperCase(), 0, -h / 2 + 158, 3, 'center');

  const heure = seance.heure.toUpperCase();
  ctx.font = '34px Anton';
  const lh = ctx.measureText(heure).width + 30;
  ctx.fillStyle = P.accent;
  ctx.fillRect(-lh / 2, -h / 2 + 172, lh, 48);
  ctx.fillStyle = P.fond;
  ctx.fillText(heure, 0, -h / 2 + 209);
  ctx.textAlign = 'left';
  ctx.restore();
}

/** Fiche d'une séance dans la bande [y0, y0 + FICHE_H). */
function dessinerFiche(ctx, seance, image, y0, index) {
  const r = rng(graineDe(`${seance.titre}|${index}`));
  dessinerFondFiche(ctx, y0, FICHE_H, r);
  globe(ctx, r, 1162, y0 + 338, 30, { iris: IRIS_FICHES[index % IRIS_FICHES.length], regard: [-0.8, -0.6], bave: true });
  dessinerAffiche(ctx, image, y0);
  dessinerTexte(ctx, seance, y0);
  dessinerTicket(ctx, seance, y0);
}

function dessinerPied(ctx, y0) {
  const r = rng(99);
  dessinerFondFiche(ctx, y0, PIED_H, r);
  ctx.font = '18px "Space Mono"';
  ctx.fillStyle = P.second;
  ctx.textBaseline = 'alphabetic';
  texteEspace(ctx, "ENTRÉE LIBRE — SI VOUS L'OSEZ", LARGEUR / 2, y0 + 34, 5, 'center');
}

function dessinerMessageVide(ctx, y0) {
  dessinerFondFiche(ctx, y0, VIDE_H, rng(7));
  ctx.font = '26px Outfit';
  ctx.fillStyle = P.creme;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('Aucune séance au programme… pour l’instant.', LARGEUR / 2, y0 + VIDE_H / 2);
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
}

async function chargerImage(buffer) {
  if (!buffer) return null;
  try {
    return await loadImage(buffer);
  } catch {
    return null;
  }
}

// --- Images complètes -------------------------------------------------------

/**
 * Découpe la liste en pages : 4 séances sur la première image (sous
 * l'en-tête), 5 sur chaque image suivante (sans en-tête).
 */
function paginer(seances) {
  const pages = [seances.slice(0, SEANCES_PREMIERE_IMAGE)];
  for (let i = SEANCES_PREMIERE_IMAGE; i < seances.length; i += SEANCES_IMAGES_SUIVANTES) {
    pages.push(seances.slice(i, i + SEANCES_IMAGES_SUIVANTES));
  }
  return pages;
}

async function rendrePage(seances, { premiere, derniere, indexDepart }) {
  const hautContenu = premiere ? ENTETE_H : 0;
  const hautSeances = seances.length ? seances.length * FICHE_H : VIDE_H;
  const hauteur = hautContenu + hautSeances + (derniere ? PIED_H : 0);

  const canvas = createCanvas(LARGEUR, hauteur);
  const ctx = canvas.getContext('2d');
  if (premiere) dessinerEntete(ctx, ENTETE_H);

  if (seances.length === 0) dessinerMessageVide(ctx, hautContenu);
  const images = await Promise.all(seances.map((s) => chargerImage(s.afficheBuffer)));
  seances.forEach((seance, i) => dessinerFiche(ctx, seance, images[i], hautContenu + i * FICHE_H, indexDepart + i));
  if (derniere) dessinerPied(ctx, hauteur - PIED_H);

  return canvas.encode('png');
}

/**
 * Rend le programme complet en pages (rappel hebdomadaire) : un Buffer PNG
 * par image. Toujours au moins une image (en-tête + message "aucune
 * séance" si la liste est vide).
 *
 * Chaque séance : { titre, type, annee, synopsis, episodes, jour, numero,
 * mois, heure, afficheBuffer } — `episodes` ({ entete, lignes }, séances
 * séries) remplace le synopsis s'il est présent.
 */
async function rendreProgramme(seances) {
  const pages = paginer(seances);
  let indexDepart = 0;
  return Promise.all(
    pages.map((page, i) => {
      const rendu = rendrePage(page, { premiere: i === 0, derniere: i === pages.length - 1, indexDepart });
      indexDepart += page.length;
      return rendu;
    })
  );
}

// --- Une image par séance -------------------------------------------------
//
// Discord affiche une image seule dans une boîte bornée en largeur ET en
// hauteur : en découpant en bandes de même largeur, toutes plus larges que
// hautes, chaque image est réduite par la largeur, donc à la même échelle.

function rendreEntete(vide) {
  const hauteur = vide ? ENTETE_H + VIDE_H + PIED_H : ENTETE_H;
  const canvas = createCanvas(LARGEUR, hauteur);
  const ctx = canvas.getContext('2d');
  dessinerEntete(ctx, ENTETE_H);
  if (vide) {
    dessinerMessageVide(ctx, ENTETE_H);
    dessinerPied(ctx, ENTETE_H + VIDE_H);
  }
  return canvas.encode('png');
}

// Une séance ; la dernière porte le pied ("Entrée libre...").
async function rendreSeance(seance, index, derniere) {
  const hauteur = FICHE_H + (derniere ? PIED_H : 0);
  const canvas = createCanvas(LARGEUR, hauteur);
  const ctx = canvas.getContext('2d');
  dessinerFiche(ctx, seance, await chargerImage(seance.afficheBuffer), 0, index);
  if (derniere) dessinerPied(ctx, FICHE_H);
  return canvas.encode('png');
}

/**
 * Rend le programme en bandes : l'en-tête, puis une image par séance (même
 * format de séance que rendreProgramme). Toutes s'affichent à la même
 * échelle dans Discord.
 */
async function rendreProgrammeParSeance(seances) {
  return Promise.all([
    rendreEntete(seances.length === 0),
    ...seances.map((seance, i) => rendreSeance(seance, i, i === seances.length - 1)),
  ]);
}

module.exports = { rendreProgramme, rendreProgrammeParSeance };
