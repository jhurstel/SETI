import React, { useId } from 'react';

// Dessins SVG des astres du plateau : planètes (relief, ombre, atmosphère, anneaux), comètes et champs d'astéroïdes.
// Les planètes sont dessinées dans un repère -50..50 (sphère de rayon 48), éclairées depuis le haut à gauche.

const R = 48;

interface PlanetLook {
  /** Dégradé de la sphère : reflet, teinte principale, bord sombre */
  light: string;
  base: string;
  dark: string;
  /** Halo d'atmosphère éventuel */
  atmosphere?: string;
  rings?: boolean;
}

const LOOKS: Record<string, PlanetLook> = {
  mercury: { light: '#c9bfb1', base: '#8f8579', dark: '#4a443d' },
  venus: { light: '#fff3cf', base: '#e3c27a', dark: '#8c6a2c', atmosphere: '#ffe9b0' },
  earth: { light: '#7cc8ff', base: '#1f70cf', dark: '#0a2b5e', atmosphere: '#8fd0ff' },
  mars: { light: '#f0a070', base: '#c1502b', dark: '#5e2312', atmosphere: '#ffb08a' },
  jupiter: { light: '#f6e7cf', base: '#d4b48c', dark: '#6e5536' },
  saturn: { light: '#fbefcf', base: '#e2c48d', dark: '#7a6238', rings: true },
  uranus: { light: '#d8fbff', base: '#86d8e6', dark: '#2f7f92', atmosphere: '#c4f6ff' },
  neptune: { light: '#9fd0ff', base: '#2f74e0', dark: '#0b2a6a', atmosphere: '#86b8ff' },
};

/** Dégradés des cratères (identiques partout : les doublons d'identifiant entre planètes sont sans effet) */
const CraterDefs = () => (
  <defs>
    {/* Fond : ombre en haut à gauche, paroi éclairée en bas à droite */}
    <linearGradient id="seti-crater-floor" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stopColor="#1e1914" stopOpacity={0.7} />
      <stop offset="55%" stopColor="#5a5046" stopOpacity={0.35} />
      <stop offset="100%" stopColor="#ece2d2" stopOpacity={0.55} />
    </linearGradient>
    {/* Rebord : éclairé en haut à gauche, dans l'ombre en bas à droite */}
    <linearGradient id="seti-crater-rim" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stopColor="#f2eadc" stopOpacity={0.7} />
      <stop offset="60%" stopColor="#f2eadc" stopOpacity={0} />
      <stop offset="100%" stopColor="#1e1914" stopOpacity={0.45} />
    </linearGradient>
  </defs>
);

/** Cratère éclairé depuis le haut à gauche, avec un pic central pour les plus grands */
const Crater: React.FC<{ x: number; y: number; r: number }> = ({ x, y, r }) => (
  <g>
    <circle cx={x} cy={y} r={r} fill="url(#seti-crater-floor)" />
    <circle cx={x} cy={y} r={r} fill="none" stroke="url(#seti-crater-rim)" strokeWidth={Math.max(0.6, r * 0.14)} />
    {r > 6 && <circle cx={x + r * 0.05} cy={y + r * 0.05} r={r * 0.14} fill="rgba(230, 220, 205, 0.5)" />}
  </g>
);

/** Détails de surface propres à chaque planète (dessinés dans le disque, avant l'ombrage) */
const surface = (id: string): React.ReactNode => {
  switch (id) {
    case 'mercury':
      return (
        <g>
          {/* Plaines plus sombres */}
          <path d="M-40 -8 C-30 -20 -12 -14 -6 -4 C0 6 -14 12 -26 10 C-36 8 -46 4 -40 -8 Z" fill="rgba(60, 54, 48, 0.25)" />
          <path d="M8 18 C18 12 34 16 36 28 C30 38 14 38 8 30 Z" fill="rgba(60, 54, 48, 0.2)" />
          <CraterDefs />
          {/* Rayons d'éjecta des grands cratères récents */}
          {[[20, 10, 11], [-18, -16, 9]].map(([x, y, r], i) => (
            <g key={`ray-${i}`} stroke="rgba(235, 228, 215, 0.12)" strokeWidth={0.8} strokeLinecap="round">
              {[0, 50, 105, 160, 215, 270, 320].map(a => {
                const rad = (a * Math.PI) / 180;
                return <line key={a} x1={x + Math.cos(rad) * r * 1.1} y1={y + Math.sin(rad) * r * 1.1} x2={x + Math.cos(rad) * r * 2.3} y2={y + Math.sin(rad) * r * 2.3} />;
              })}
            </g>
          ))}
          {[[-18, -16, 9], [14, -24, 6], [20, 10, 11], [-14, 22, 7], [-32, 4, 5], [4, 2, 4], [32, -8, 4.5], [-2, 34, 5], [-6, -34, 3.5], [34, 14, 3], [-26, -30, 3], [8, -8, 2.5]].map(([x, y, r], i) => (
            <Crater key={i} x={x} y={y} r={r} />
          ))}
          {/* Petits impacts */}
          {[[-8, 10], [26, -22], [-36, 18], [12, 26], [-20, 4], [28, 28], [0, -18], [-28, -14]].map(([x, y], i) => (
            <circle key={`p-${i}`} cx={x} cy={y} r={1.1} fill="rgba(40, 34, 28, 0.45)" />
          ))}
        </g>
      );
    case 'venus':
      // Voile nuageux en chevrons
      return [-26, -10, 6, 22].map((y, i) => (
        <path key={i} d={`M-50 ${y} Q-10 ${y - 14} 0 ${y + 2} Q12 ${y + 16} 50 ${y - 4}`} fill="none" stroke={i % 2 ? 'rgba(255, 250, 230, 0.45)' : 'rgba(170, 120, 50, 0.3)'} strokeWidth={9} strokeLinecap="round" />
      ));
    case 'earth':
      return (
        <g>
          {/* Continents */}
          <path d="M-34 -30 C-22 -38 -6 -34 -4 -24 C-2 -14 -14 -12 -12 -2 C-10 8 -22 10 -26 2 C-32 -8 -44 -12 -34 -30 Z" fill="#3a7d33" />
          <path d="M-14 8 C-6 6 0 14 -4 24 C-8 34 -16 42 -20 34 C-24 26 -22 12 -14 8 Z" fill="#44873a" />
          <path d="M6 -34 C18 -40 34 -30 36 -18 C38 -8 26 -6 22 2 C18 10 6 6 6 -4 C6 -14 -2 -26 6 -34 Z" fill="#6b8f42" />
          <path d="M18 14 C26 10 34 16 32 26 C30 34 20 32 18 24 Z" fill="#b8925a" />
          {/* Calotte polaire et nuages */}
          <ellipse cx={0} cy={-47} rx={26} ry={8} fill="#f4fbff" />
          <ellipse cx={0} cy={47} rx={22} ry={6} fill="#f4fbff" />
          <path d="M-40 -6 Q-20 -14 0 -8 Q16 -3 36 -12" fill="none" stroke="rgba(255, 255, 255, 0.75)" strokeWidth={4} strokeLinecap="round" />
          <path d="M-30 16 Q-10 10 10 18 Q24 24 40 16" fill="none" stroke="rgba(255, 255, 255, 0.6)" strokeWidth={3.5} strokeLinecap="round" />
        </g>
      );
    case 'mars':
      return (
        <g>
          <path d="M-36 -6 C-24 -16 -10 -10 -4 -2 C2 6 14 2 22 8 C30 14 26 26 14 24 C2 22 -8 14 -18 16 C-30 18 -42 8 -36 -6 Z" fill="rgba(90, 30, 15, 0.45)" />
          <path d="M8 -26 C16 -30 26 -24 24 -16 C22 -10 12 -12 8 -18 Z" fill="rgba(90, 30, 15, 0.35)" />
          <ellipse cx={-4} cy={-46} rx={20} ry={7} fill="#fff4ee" />
          <ellipse cx={2} cy={48} rx={14} ry={4} fill="rgba(255, 244, 238, 0.85)" />
        </g>
      );
    case 'jupiter':
      return (
        <g>
          {[
            [-40, 8, '#b98c5f'], [-28, 6, '#efe0c6'], [-18, 8, '#a8794b'], [-6, 7, '#f3e6cf'],
            [4, 9, '#c0875a'], [16, 6, '#efe2c8'], [26, 7, '#ae8358'], [38, 8, '#dcc6a2'],
          ].map(([y, h, c], i) => (
            <path key={i} d={`M-52 ${y} Q-20 ${(y as number) - 3} 0 ${y} Q24 ${(y as number) + 3} 52 ${y} V${(y as number) + (h as number)} Q24 ${(y as number) + (h as number) + 3} 0 ${(y as number) + (h as number)} Q-20 ${(y as number) + (h as number) - 3} -52 ${(y as number) + (h as number)} Z`} fill={c as string} opacity={0.85} />
          ))}
          {/* Grande Tache rouge */}
          <ellipse cx={16} cy={10} rx={11} ry={6} fill="#c2562e" stroke="#e8b48e" strokeWidth={1.5} />
        </g>
      );
    case 'saturn':
      return [-30, -16, -4, 8, 20, 32].map((y, i) => (
        <rect key={i} x={-52} y={y} width={104} height={i % 2 ? 6 : 8} fill={i % 2 ? '#f3e2b8' : '#c9a66c'} opacity={0.6} />
      ));
    case 'uranus':
      return <ellipse cx={0} cy={-30} rx={44} ry={14} fill="rgba(230, 255, 255, 0.3)" />;
    case 'neptune':
      return (
        <g>
          <rect x={-52} y={-8} width={104} height={14} fill="rgba(10, 45, 140, 0.35)" />
          <ellipse cx={-12} cy={10} rx={9} ry={5} fill="#0c2560" />
          <path d="M-6 6 Q4 2 14 6" fill="none" stroke="rgba(255, 255, 255, 0.85)" strokeWidth={2.5} strokeLinecap="round" />
          <path d="M8 -26 Q20 -30 32 -24" fill="none" stroke="rgba(255, 255, 255, 0.7)" strokeWidth={2} strokeLinecap="round" />
        </g>
      );
    default:
      return null;
  }
};

/** Anneaux de Saturne : moitié arrière (derrière la planète) ou avant */
const Rings: React.FC<{ front: boolean; clipId: string }> = ({ front, clipId }) => (
  <g transform="rotate(-16) scale(0.8)">
    <defs>
      <clipPath id={clipId}>
        <rect x={-110} y={front ? 0 : -40} width={220} height={40} />
      </clipPath>
    </defs>
    <g clipPath={`url(#${clipId})`}>
      <ellipse rx={92} ry={24} fill="none" stroke="rgba(214, 190, 140, 0.55)" strokeWidth={8} />
      <ellipse rx={80} ry={20.5} fill="none" stroke="rgba(236, 214, 165, 0.9)" strokeWidth={10} />
      <ellipse rx={86.5} ry={22.3} fill="none" stroke="rgba(40, 30, 20, 0.6)" strokeWidth={1.4} />
      <ellipse rx={69} ry={17.5} fill="none" stroke="rgba(190, 165, 120, 0.5)" strokeWidth={6} />
    </g>
  </g>
);

/** Planète réaliste en SVG, à la taille donnée (les anneaux débordent du carré) */
const PlanetGlobeBase: React.FC<{ id: string; size: number }> = ({ id, size }) => {
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, '');
  const look = LOOKS[id] ?? { light: '#bbb', base: '#888', dark: '#333' };
  const clip = `clip-${uid}`;
  return (
    <svg width={size} height={size} viewBox="-50 -50 100 100" style={{ overflow: 'visible', display: 'block' }}>
      <defs>
        <radialGradient id={`body-${uid}`} cx="35%" cy="32%" r="75%">
          <stop offset="0%" stopColor={look.light} />
          <stop offset="45%" stopColor={look.base} />
          <stop offset="100%" stopColor={look.dark} />
        </radialGradient>
        {/* Ombre du côté nuit */}
        <radialGradient id={`shade-${uid}`} cx="30%" cy="28%" r="85%">
          <stop offset="55%" stopColor="#000" stopOpacity={0} />
          <stop offset="100%" stopColor="#000" stopOpacity={0.65} />
        </radialGradient>
        <radialGradient id={`glow-${uid}`} r="50%">
          <stop offset="88%" stopColor={look.atmosphere ?? '#fff'} stopOpacity={0.45} />
          <stop offset="100%" stopColor={look.atmosphere ?? '#fff'} stopOpacity={0} />
        </radialGradient>
        <clipPath id={clip}><circle r={R} /></clipPath>
      </defs>
      {look.rings && <Rings front={false} clipId={`rb-${uid}`} />}
      {look.atmosphere && <circle r={R + 6} fill={`url(#glow-${uid})`} />}
      <circle r={R} fill={`url(#body-${uid})`} />
      <g clipPath={`url(#${clip})`}>
        {surface(id)}
        <circle r={R} fill={`url(#shade-${uid})`} />
      </g>
      {/* Reflet */}
      <ellipse cx={-18} cy={-20} rx={14} ry={9} fill="#fff" opacity={0.12} transform="rotate(-35 -18 -20)" />
      {look.rings && <Rings front clipId={`rf-${uid}`} />}
    </svg>
  );
};

/**
 * Comète vue de profil : noyau à droite (x = +length/2), queue de poussière courbe et queue d'ions droite vers la gauche.
 * À faire pivoter selon la direction de la queue.
 */
const CometSvgBase: React.FC<{ length: number }> = ({ length }) => {
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, '');
  const h = length / 2;
  const w = 8 + length * 0.12;
  // Placé de sorte que l'origine du repère (milieu de la queue) tombe sur le point d'ancrage du parent
  return (
    <svg width={length + 16} height={w * 2 + 8} viewBox={`${-h - 4} ${-w - 4} ${length + 16} ${w * 2 + 8}`} style={{ overflow: 'visible', display: 'block', position: 'absolute', left: -h - 4, top: -w - 4 }}>
      <defs>
        <linearGradient id={`dust-${uid}`} x1="1" x2="0" y1="0" y2="0">
          <stop offset="0%" stopColor="#fff6dc" stopOpacity={0.95} />
          <stop offset="40%" stopColor="#f3dca8" stopOpacity={0.45} />
          <stop offset="100%" stopColor="#e8c890" stopOpacity={0} />
        </linearGradient>
        <linearGradient id={`ion-${uid}`} x1="1" x2="0" y1="0" y2="0">
          <stop offset="0%" stopColor="#bfe6ff" stopOpacity={0.9} />
          <stop offset="100%" stopColor="#6fb6ff" stopOpacity={0} />
        </linearGradient>
        <filter id={`soft-${uid}`} x="-20%" y="-60%" width="140%" height="220%">
          <feGaussianBlur stdDeviation={1.1} />
        </filter>
        <radialGradient id={`coma-${uid}`}>
          <stop offset="0%" stopColor="#ffffff" stopOpacity={1} />
          <stop offset="35%" stopColor="#d8f1ff" stopOpacity={0.8} />
          <stop offset="100%" stopColor="#8fd2ff" stopOpacity={0} />
        </radialGradient>
      </defs>
      {/* Queue de poussière, élargie et légèrement courbée */}
      <path d={`M${h} -2.5 Q${h * 0.1} ${-w * 0.55} ${-h} ${-w} L${-h} ${w * 0.15} Q${h * 0.1} 1.5 ${h} 2.5 Z`} fill={`url(#dust-${uid})`} filter={`url(#soft-${uid})`} />
      {/* Queue d'ions, fine et rectiligne */}
      <path d={`M${h} -0.8 L${-h - 2} ${w * 0.45} L${-h - 2} ${w * 0.45 + 1.8} L${h} 0.8 Z`} fill={`url(#ion-${uid})`} filter={`url(#soft-${uid})`} />
      <circle cx={h} r={6.5} fill={`url(#coma-${uid})`} />
      <circle cx={h} r={2.2} fill="#fff" />
    </svg>
  );
};

const seeded = (seed: number) => {
  const x = Math.sin(seed) * 10000;
  return x - Math.floor(x);
};

/** Contour irrégulier d'un rocher, centré sur 0 */
const rockPath = (r: number, seed: number, rotation: number) => {
  const n = 9;
  const pts = Array.from({ length: n }, (_, i) => {
    const a = (i / n) * Math.PI * 2 + rotation;
    const rr = r * (0.7 + seeded(seed + i * 7.3) * 0.45);
    return [Math.cos(a) * rr, Math.sin(a) * rr * 0.85];
  });
  return 'M' + pts.map(([x, y]) => `${x.toFixed(2)} ${y.toFixed(2)}`).join(' L') + ' Z';
};

/** Champ d'astéroïdes : rochers ombrés de tailles variées et poussière, disposés de façon stable selon la graine */
const AsteroidFieldSvgBase: React.FC<{ width: number; height: number; count: number; seed: number }> = ({ width, height, count, seed }) => {
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, '');
  const rocks = Array.from({ length: count }, (_, i) => {
    const a = (i / count) * Math.PI * 2 + seeded(seed + i) * 0.6;
    const d = 0.2 + seeded(seed + i + 10) * 0.7;
    return { x: Math.cos(a) * d * width * 0.42, y: Math.sin(a) * d * height * 0.4, r: 2.4 + seeded(seed + i + 100) * 3.2, rot: seeded(seed + i + 50) * Math.PI * 2 };
  });
  const dust = Array.from({ length: count * 3 }, (_, i) => ({
    x: (seeded(seed + i + 300) - 0.5) * width * 0.9,
    y: (seeded(seed + i + 400) - 0.5) * height * 0.85,
    r: 0.4 + seeded(seed + i + 500) * 0.8,
  }));
  return (
    <svg width={width} height={height} viewBox={`${-width / 2} ${-height / 2} ${width} ${height}`} style={{ overflow: 'visible', display: 'block' }}>
      <defs>
        <radialGradient id={`rock-${uid}`} cx="35%" cy="30%" r="80%">
          <stop offset="0%" stopColor="#b6a796" />
          <stop offset="55%" stopColor="#77695b" />
          <stop offset="100%" stopColor="#3a322b" />
        </radialGradient>
      </defs>
      {dust.map((p, i) => <circle key={`d${i}`} cx={p.x} cy={p.y} r={p.r} fill="#9c8f80" opacity={0.6} />)}
      {rocks.map((p, i) => (
        <g key={i} transform={`translate(${p.x} ${p.y})`}>
          <path d={rockPath(p.r, seed + i * 13, p.rot)} fill={`url(#rock-${uid})`} stroke="rgba(0, 0, 0, 0.5)" strokeWidth={0.4} />
          <circle cx={p.r * 0.2} cy={p.r * 0.15} r={p.r * 0.22} fill="rgba(30, 25, 20, 0.45)" />
        </g>
      ))}
    </svg>
  );
};

/** Soleil : photosphère granuleuse assombrie au bord, facules, protubérances et couronne diffuse */
const SunSvgBase: React.FC = () => {
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, '');
  // Granulation : petites cellules claires réparties de façon stable
  const grains = Array.from({ length: 70 }, (_, i) => {
    const a = seeded(i + 1) * Math.PI * 2;
    const d = Math.sqrt(seeded(i + 101)) * 44;
    return { x: Math.cos(a) * d, y: Math.sin(a) * d, r: 1.6 + seeded(i + 201) * 2.4 };
  });
  // Protubérances : arcs lumineux au bord du disque
  const prominences = [20, 140, 255];
  return (
    <svg width="100%" height="100%" viewBox="-50 -50 100 100" style={{ overflow: 'visible', display: 'block' }}>
      <defs>
        <radialGradient id={`sun-corona-${uid}`} r="50%">
          <stop offset="45%" stopColor="#ffcf5a" stopOpacity={0.55} />
          <stop offset="65%" stopColor="#ff9f2e" stopOpacity={0.18} />
          <stop offset="100%" stopColor="#ff7a1a" stopOpacity={0} />
        </radialGradient>
        {/* Assombrissement centre-bord */}
        <radialGradient id={`sun-disk-${uid}`} cx="48%" cy="46%" r="55%">
          <stop offset="0%" stopColor="#fff8d6" />
          <stop offset="45%" stopColor="#ffd75a" />
          <stop offset="80%" stopColor="#f5a623" />
          <stop offset="100%" stopColor="#d9661a" />
        </radialGradient>
        <filter id={`sun-blur-${uid}`} x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation={1.4} />
        </filter>
        <clipPath id={`sun-clip-${uid}`}><circle r={46} /></clipPath>
      </defs>
      {/* Couronne */}
      <circle r={96} fill={`url(#sun-corona-${uid})`} />
      {prominences.map(deg => (
        <g key={deg} transform={`rotate(${deg})`}>
          <path d="M-6 -45 Q0 -60 6 -45" fill="none" stroke="#ff8a3d" strokeWidth={2.5} opacity={0.75} filter={`url(#sun-blur-${uid})`} />
        </g>
      ))}
      <circle r={46} fill={`url(#sun-disk-${uid})`} />
      <g clipPath={`url(#sun-clip-${uid})`}>
        {grains.map((g, i) => <circle key={i} cx={g.x} cy={g.y} r={g.r} fill="#fff4c2" opacity={0.18} filter={`url(#sun-blur-${uid})`} />)}
        {/* Facules */}
        <ellipse cx={-16} cy={14} rx={9} ry={4} fill="#fff6d0" opacity={0.35} filter={`url(#sun-blur-${uid})`} />
        <ellipse cx={15} cy={-12} rx={7} ry={3} fill="#fff6d0" opacity={0.25} filter={`url(#sun-blur-${uid})`} />
      </g>
    </svg>
  );
};

/**
 * Sonde (type Voyager) vue de trois quarts : grande antenne parabolique, corps à la couleur du joueur
 * habillé de feuille d'or, bras des générateurs (RTG) et long bras du magnétomètre.
 */
const ProbeSvgBase: React.FC<{ color: string }> = ({ color }) => {
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, '');
  return (
    <svg width="100%" height="100%" viewBox="-12 -12 24 24" style={{ overflow: 'visible', display: 'block' }}>
      <defs>
        <radialGradient id={`dish-${uid}`} cx="40%" cy="35%" r="70%">
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="60%" stopColor="#d6dbe2" />
          <stop offset="100%" stopColor="#8a929c" />
        </radialGradient>
        <linearGradient id={`bus-${uid}`} x1="0" x2="1" y1="0" y2="1">
          <stop offset="0%" stopColor="#fff" stopOpacity={0.45} />
          <stop offset="45%" stopColor="#fff" stopOpacity={0} />
          <stop offset="100%" stopColor="#000" stopOpacity={0.35} />
        </linearGradient>
      </defs>
      {/* Bras du magnétomètre (long et fin) */}
      <line x1={3} y1={3} x2={11.5} y2={7} stroke="#b9c0c8" strokeWidth={0.45} />
      <circle cx={11.5} cy={7} r={0.6} fill="#d6dbe2" />
      {/* Bras des générateurs : trois cylindres */}
      <line x1={-3} y1={3} x2={-8.5} y2={6} stroke="#7d848c" strokeWidth={0.6} />
      {[0, 1, 2].map(i => (
        <rect key={i} x={-6.4 - i * 1.4} y={3.6 + i * 0.75} width={1.2} height={1.8} rx={0.3} fill="#4a4f55" stroke="#9aa1a8" strokeWidth={0.2} transform={`rotate(-28 ${-5.8 - i * 1.4} ${4.5 + i * 0.75})`} />
      ))}
      {/* Corps décagonal à la couleur du joueur, feuille d'or */}
      <path d="M-4.4 0.8 L-2.6 -0.6 H2.6 L4.4 0.8 V4.8 L2.6 6.2 H-2.6 L-4.4 4.8 Z" fill={color} stroke="rgba(0, 0, 0, 0.5)" strokeWidth={0.3} />
      <path d="M-4.4 0.8 L-2.6 -0.6 H2.6 L4.4 0.8 V4.8 L2.6 6.2 H-2.6 L-4.4 4.8 Z" fill={`url(#bus-${uid})`} />
      <rect x={-1.8} y={1.6} width={3.6} height={2.6} rx={0.3} fill="#e8b84a" opacity={0.85} stroke="#a77a1e" strokeWidth={0.2} />
      {/* Antenne parabolique (haut gain), vue légèrement de face */}
      {/* bordée de la couleur du joueur pour reconnaître la sonde même petite */}
      <ellipse cx={0} cy={-3.6} rx={7.2} ry={3.6} fill={`url(#dish-${uid})`} stroke={color} strokeWidth={0.8} />
      <ellipse cx={0} cy={-3.6} rx={4.6} ry={2.2} fill="none" stroke="rgba(90, 98, 108, 0.35)" strokeWidth={0.3} />
      {/* Support et sous-réflecteur */}
      <line x1={0} y1={-3.6} x2={0} y2={-7.6} stroke="#6b7279" strokeWidth={0.35} />
      <circle cx={0} cy={-7.8} r={0.7} fill="#c9ced4" stroke="#6b7279" strokeWidth={0.2} />
    </svg>
  );
};

/**
 * Capsule Mascamite : capsule de retour (bouclier thermique en bas), bande à la couleur du joueur,
 * hublot où brille le spécimen vert.
 */
const CapsuleSvgBase: React.FC<{ color: string }> = ({ color }) => {
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, '');
  return (
    <svg width="100%" height="100%" viewBox="-12 -12 24 24" style={{ overflow: 'visible', display: 'block' }}>
      <defs>
        <linearGradient id={`hull-${uid}`} x1="0" x2="1">
          <stop offset="0%" stopColor="#f1f3f5" />
          <stop offset="55%" stopColor="#c3c9cf" />
          <stop offset="100%" stopColor="#7c848c" />
        </linearGradient>
        <radialGradient id={`specimen-${uid}`}>
          <stop offset="0%" stopColor="#eaffd9" />
          <stop offset="45%" stopColor="#8dff6e" />
          <stop offset="100%" stopColor="#2e8f2a" />
        </radialGradient>
        <radialGradient id={`glow-${uid}`}>
          <stop offset="0%" stopColor="#8dff6e" stopOpacity={0.55} />
          <stop offset="100%" stopColor="#8dff6e" stopOpacity={0} />
        </radialGradient>
      </defs>
      <circle r={11} fill={`url(#glow-${uid})`} />
      {/* Coque conique */}
      <path d="M-3 -8 H3 L7.5 4 H-7.5 Z" fill={`url(#hull-${uid})`} stroke="#5e656d" strokeWidth={0.35} strokeLinejoin="round" />
      {/* Bande du joueur */}
      <path d="M-5.2 -2 H5.2 L6.1 0.4 H-6.1 Z" fill={color} stroke="rgba(0, 0, 0, 0.45)" strokeWidth={0.25} />
      {/* Hublot et spécimen */}
      <circle cx={0} cy={-4.6} r={1.9} fill={`url(#specimen-${uid})`} stroke="#4a5158" strokeWidth={0.45} />
      {/* Bouclier thermique */}
      <path d="M-8 4 Q0 8.2 8 4 Z" fill="#5a3a22" stroke="#2f1d10" strokeWidth={0.3} />
      <path d="M-7 4.6 Q0 7.4 7 4.6" fill="none" stroke="#8a5a32" strokeWidth={0.4} opacity={0.7} />
      {/* Nez */}
      <rect x={-1.4} y={-9.2} width={2.8} height={1.4} rx={0.4} fill="#9aa1a8" />
    </svg>
  );
};

/** Dessin coûteux, sans état : redessiné seulement si ses props changent */
export const PlanetGlobe = React.memo(PlanetGlobeBase);

/** Dessin coûteux, sans état : redessiné seulement si ses props changent */
export const CometSvg = React.memo(CometSvgBase);

/** Dessin coûteux, sans état : redessiné seulement si ses props changent */
export const AsteroidFieldSvg = React.memo(AsteroidFieldSvgBase);

/** Dessin coûteux, sans état : redessiné seulement si ses props changent */
export const SunSvg = React.memo(SunSvgBase);

/** Dessin coûteux, sans état : redessiné seulement si ses props changent */
export const ProbeSvg = React.memo(ProbeSvgBase);

/** Dessin coûteux, sans état : redessiné seulement si ses props changent */
export const CapsuleSvg = React.memo(CapsuleSvgBase);
