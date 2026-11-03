import React, { useId } from 'react';
import { LIFE_TRACE_COLORS, LifeTraceColor } from '../styles/lifeTraceColors';

// Icônes du matériel redessinées d'après le livret de règles : actions principales (hexagones, p. 7),
// symbole « signal » (p. 12) et tuiles Technologie (p. 17).

const useUid = () => useId().replace(/[^a-zA-Z0-9_-]/g, '');

/* ------------------------------------------------------------------ */
/* Actions principales : hexagone coloré, intérieur sombre, pictogramme */
/* ------------------------------------------------------------------ */

export type ActionIconKind = 'launch' | 'orbit' | 'land' | 'scan' | 'analyze' | 'card' | 'research' | 'pass';

const HEX = 'M0 -46 L39.8 -23 L39.8 23 L0 46 L-39.8 23 L-39.8 -23 Z';
const HEX_INNER = 'M0 -38 L32.9 -19 L32.9 19 L0 38 L-32.9 19 L-32.9 -19 Z';

const ACTION_STYLES: Record<ActionIconKind, { frame: string; inner: string; glyph: string }> = {
  launch: { frame: '#f28c1e', inner: '#3d1a08', glyph: '#ff9a3c' },
  orbit: { frame: '#8ccf2e', inner: '#123d10', glyph: '#a6e64a' },
  land: { frame: '#f5c400', inner: '#3d2a05', glyph: '#ffcf3a' },
  scan: { frame: '#e5197e', inner: '#3a0b2a', glyph: '#f05aa6' },
  analyze: { frame: '#2f9be8', inner: '#0b2340', glyph: '#44b4ff' },
  card: { frame: '#c8cdd8', inner: '#2b3040', glyph: '#ffffff' },
  research: { frame: '#ffffff', inner: '#f2f2f2', glyph: '#e5197e' },
  pass: { frame: '#c8cdd8', inner: '#2b3040', glyph: '#ff2a2a' },
};

const actionGlyph = (kind: ActionIconKind, c: string): React.ReactNode => {
  switch (kind) {
    case 'launch':
      // Navette et ses fumées
      return (
        <g fill={c}>
          <path d="M0 -26 C6 -18 7 -8 7 4 L13 14 H-13 L-7 4 C-7 -8 -6 -18 0 -26 Z" />
          <path d="M-5 16 H5 L3 24 H-3 Z" />
          <circle cx={-16} cy={22} r={6} opacity={0.6} /><circle cx={16} cy={22} r={6} opacity={0.6} />
          <circle cx={-22} cy={-6} r={4} opacity={0.45} /><circle cx={22} cy={-10} r={5} opacity={0.45} />
        </g>
      );
    case 'orbit':
      // Satellite au-dessus de sa trajectoire
      return (
        <g>
          <path d="M-30 26 Q0 4 30 18" fill="none" stroke={c} strokeWidth={6} strokeLinecap="round" opacity={0.75} />
          <g transform="rotate(-35)" fill={c}>
            <rect x={-5} y={-7} width={10} height={14} rx={1.5} />
            <rect x={-27} y={-5} width={19} height={10} rx={1} />
            <rect x={8} y={-5} width={19} height={10} rx={1} />
          </g>
          <circle cx={-18} cy={-22} r={1.6} fill={c} /><circle cx={22} cy={-18} r={1.6} fill={c} />
        </g>
      );
    case 'land':
      // Atterrisseur : mât, plateforme, trois roues, poussière
      return (
        <g fill={c}>
          <rect x={-1.5} y={-28} width={3} height={18} />
          <rect x={-20} y={-12} width={40} height={4} rx={1} />
          <path d="M-14 -8 H14 L10 6 H-10 Z" />
          {[-14, 0, 14].map(x => <circle key={x} cx={x} cy={14} r={6} />)}
          <ellipse cx={0} cy={22} rx={28} ry={5} opacity={0.4} />
        </g>
      );
    case 'scan':
      // Radiotélescope
      return (
        <g fill={c}>
          <path d="M-22 -14 C-18 6 2 16 18 10 C6 2 -6 -6 -22 -14 Z" />
          <line x1={-2} y1={0} x2={14} y2={-16} stroke={c} strokeWidth={3} />
          <circle cx={15} cy={-17} r={3} />
          <path d="M-6 8 L-12 26 H10 L4 10 Z" />
        </g>
      );
    case 'analyze':
      // Ordinateur : trois baies de données sur un pied
      return (
        <g>
          <rect x={-20} y={-24} width={40} height={36} rx={2} fill="none" stroke={c} strokeWidth={2.5} />
          {[-19, -7, 5].map(y => (
            <g key={y}>
              <rect x={-16} y={y} width={32} height={8} rx={1} fill="none" stroke={c} strokeWidth={2} />
              <rect x={-13} y={y + 2.5} width={8} height={3} fill={c} />
            </g>
          ))}
          <line x1={0} y1={12} x2={0} y2={22} stroke={c} strokeWidth={2.5} />
          <line x1={-14} y1={22} x2={14} y2={22} stroke={c} strokeWidth={2.5} />
          <circle cx={0} cy={22} r={3} fill={c} />
        </g>
      );
    case 'card':
      // Carte jouée (flèche verte)
      return (
        <g>
          <rect x={-22} y={-20} width={24} height={34} rx={2.5} fill="#f4f4f4" transform="rotate(-8 -10 -3)" />
          <path d="M-2 -10 Q16 -14 18 4" fill="none" stroke="#1fb28a" strokeWidth={7} strokeLinecap="round" />
          <path d="M10 2 L18 14 L26 2 Z" fill="#1fb28a" />
        </g>
      );
    case 'research':
      // Puce de technologie aux trois couleurs
      return (
        <g>
          <clipPath id="seti-research-chip"><path d="M-14 -22 H14 L24 -12 V12 L14 22 H-14 L-24 12 V-12 Z" /></clipPath>
          <g clipPath="url(#seti-research-chip)">
            <rect x={-26} y={-26} width={52} height={52} fill="#e5197e" />
            <path d="M-26 -26 H8 L-26 8 Z" fill="#f28c1e" />
            <path d="M26 -6 V26 H-6 Z" fill="#2f9be8" />
          </g>
        </g>
      );
    case 'pass':
      return (
        <g stroke={c} strokeWidth={10} strokeLinecap="square">
          <line x1={-15} y1={-15} x2={15} y2={15} /><line x1={15} y1={-15} x2={-15} y2={15} />
        </g>
      );
  }
};

/** Hexagone d'action principale (livret p. 7) */
export const ActionHexIcon: React.FC<{ kind: ActionIconKind; size?: number }> = ({ kind, size = 28 }) => {
  const uid = useUid();
  const st = ACTION_STYLES[kind];
  const isResearch = kind === 'research';
  return (
    <svg width={size} height={size} viewBox="-50 -50 100 100" style={{ display: 'block' }}>
      <defs>
        <radialGradient id={`hex-in-${uid}`} cx="50%" cy="40%" r="65%">
          <stop offset="0%" stopColor={st.inner} stopOpacity={isResearch ? 1 : 0.75} />
          <stop offset="100%" stopColor={isResearch ? '#dcdcdc' : '#05060a'} />
        </radialGradient>
        {isResearch && (
          <linearGradient id={`hex-tri-${uid}`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#f28c1e" /><stop offset="33%" stopColor="#f28c1e" />
            <stop offset="34%" stopColor="#e5197e" /><stop offset="66%" stopColor="#e5197e" />
            <stop offset="67%" stopColor="#2f9be8" /><stop offset="100%" stopColor="#2f9be8" />
          </linearGradient>
        )}
      </defs>
      <path d={HEX} fill={`url(#hex-in-${uid})`} stroke={isResearch ? `url(#hex-tri-${uid})` : st.frame} strokeWidth={7} strokeLinejoin="round" />
      <path d={HEX_INNER} fill="none" stroke="rgba(255, 255, 255, 0.55)" strokeWidth={1.5} strokeLinejoin="round" />
      {actionGlyph(kind, st.glyph)}
    </svg>
  );
};

/** Défausser une carte (pour son action gratuite) : carte blanche inclinée et flèche orange qui l'emmène vers le bas */
export const DiscardCardIcon: React.FC<{ size?: number }> = ({ size = 20 }) => (
  <svg width={size} height={size} viewBox="0 0 40 40" style={{ display: 'block' }}>
    <g transform="rotate(-14 16 18)">
      <rect x={7} y={5} width={18} height={25} rx={2.5} fill="#f4f4f4" stroke="#2a2a2a" strokeWidth={1.5} />
      <path d="M11 11 H21 M11 15 H19" stroke="#9aa0ad" strokeWidth={1.6} strokeLinecap="round" />
    </g>
    <path d="M22 17 Q33 18 32 29" fill="none" stroke="#f28c1e" strokeWidth={4} strokeLinecap="round" />
    <path d="M26.5 27 L32 36 L37.5 27 Z" fill="#f28c1e" />
  </svg>
);

/** Message des Centauriens (tuile Message, palier) : tuile violette, point d'émission et ondes radio */
export const CentaurienMessageIcon: React.FC<{ size?: number }> = ({ size = 20 }) => (
  <svg width={size} height={size} viewBox="0 0 40 40" style={{ display: 'block' }}>
    <rect x={3} y={3} width={34} height={34} rx={8} fill="#5b3fc4" stroke="#b9a8ff" strokeWidth={2} />
    <circle cx={12} cy={28} r={3.4} fill="#fff" />
    <g fill="none" stroke="#fff" strokeLinecap="round">
      <path d="M12 19.5 A8.5 8.5 0 0 1 20.5 28" strokeWidth={2.6} />
      <path d="M12 13 A15 15 0 0 1 27 28" strokeWidth={2.6} opacity={0.8} />
      <path d="M12 6.5 A21.5 21.5 0 0 1 33.5 28" strokeWidth={2.6} opacity={0.55} />
    </g>
  </svg>
);

/** Fin de tour (« Prochain joueur ») : hexagone vert, flèche circulaire qui passe la main au joueur suivant */
export const EndTurnIcon: React.FC<{ size?: number }> = ({ size = 28 }) => {
  const uid = useUid();
  return (
    <svg width={size} height={size} viewBox="-50 -50 100 100" style={{ display: 'block' }}>
      <defs>
        <radialGradient id={`hex-end-${uid}`} cx="50%" cy="40%" r="65%">
          <stop offset="0%" stopColor="#3ccf7a" stopOpacity={0.75} />
          <stop offset="100%" stopColor="#05060a" />
        </radialGradient>
      </defs>
      <path d={HEX} fill={`url(#hex-end-${uid})`} stroke="#2fb36a" strokeWidth={7} strokeLinejoin="round" />
      <path d={HEX_INNER} fill="none" stroke="rgba(255, 255, 255, 0.55)" strokeWidth={1.5} strokeLinejoin="round" />
      {/* Arc de 300° terminé par une pointe : le tour passe au suivant */}
      <path d="M17 -12 A21 21 0 1 0 19 9" fill="none" stroke="#fff" strokeWidth={8} strokeLinecap="round" />
      <path d="M8 -20 L24 -15 L19 1 Z" fill="#fff" stroke="#fff" strokeWidth={3} strokeLinejoin="round" />
    </svg>
  );
};

/* ---------------------------------------------------- */
/* Signal (livret p. 12) : disque gris à barres sonores */
/* ---------------------------------------------------- */

export type SignalBadge = 'earth' | 'card' | 'mercury' | 'discard' | 'deck' | 'probe' | 'venus' | 'mars' | 'jupiter' | 'saturn' | 'oumuamua';

/** Planète simple (badge de signal) : disque coloré, bandes pour Jupiter, anneau pour Saturne */
const PlanetBadge: React.FC<{ fill: string; bands?: boolean; ring?: boolean }> = ({ fill, bands, ring }) => (
  <g transform="translate(20 20)">
    {ring && <ellipse rx={19} ry={5} fill="none" stroke="#e8d6a0" strokeWidth={3} transform="rotate(-20)" />}
    <circle r={12} fill={fill} stroke="#0b0f1e" strokeWidth={1.5} />
    {bands && <g stroke="#a86a3a" strokeWidth={2}><line x1={-11} y1={-4} x2={11} y2={-4} /><line x1={-11} y1={3} x2={11} y2={3} /></g>}
  </g>
);

const SignalBars: React.FC<{ color?: string }> = ({ color = '#ffffff' }) => (
  <g fill={color}>
    <rect x={-13} y={-8} width={7} height={16} rx={3.5} />
    <rect x={-3.5} y={-14} width={7} height={28} rx={3.5} />
    <rect x={6} y={-6} width={7} height={12} rx={3.5} />
  </g>
);

const signalBadge = (badge: SignalBadge): React.ReactNode => {
  switch (badge) {
    case 'earth':
      return (
        <g transform="translate(20 20)">
          <circle r={15} fill="#1f2a44" stroke="#0b0f1e" strokeWidth={1.5} />
          <path d="M-9 -8 C-4 -12 2 -10 1 -5 C0 0 -6 0 -5 5 C-4 10 -9 9 -11 4 C-12 0 -12 -5 -9 -8 Z M4 2 C8 0 12 4 10 9 C7 12 3 9 4 2 Z M5 -11 C9 -10 11 -6 8 -5 Z" fill="#f2f2f2" />
        </g>
      );
    case 'card':
      // Carte de la rangée : carte blanche au coin sombre
      return (
        <g transform="translate(20 18)">
          <rect x={-10} y={-14} width={20} height={28} rx={2.5} fill="#f4f4f4" stroke="#2a2a2a" strokeWidth={2} />
          <path d="M-4 -14 H7.5 Q10 -14 10 -11.5 V2 Z" fill="#2a2a2a" />
        </g>
      );
    case 'mercury':
      return (
        <g transform="translate(20 20)">
          <circle r={14} fill="#c95aa8" stroke="#0b0f1e" strokeWidth={1.5} />
          <circle cx={-4} cy={-3} r={3} fill="#a8468a" /><circle cx={5} cy={4} r={2.2} fill="#a8468a" /><circle cx={2} cy={-7} r={1.5} fill="#a8468a" />
        </g>
      );
    case 'deck':
      // Carte de la pioche : dos de carte sombre marqué « ? »
      return (
        <g transform="translate(20 18)">
          <rect x={-10} y={-14} width={20} height={28} rx={2.5} fill="#2b2b2b" stroke="#e8e8e8" strokeWidth={2} />
          <text y={7} textAnchor="middle" fontSize={20} fontWeight={900} fill="#fff" fontFamily="Arial Black, Arial, sans-serif">?</text>
        </g>
      );
    case 'probe':
      // Sonde : pastille orange de lancement, fusée blanche
      return (
        <g transform="translate(20 20)">
          <circle r={14} fill="#f28c1e" stroke="#0b0f1e" strokeWidth={1.5} />
          <path d="M0 -10 C3 -7 4 -3 4 2 V6 L6.5 9 H-6.5 L-4 6 V2 C-4 -3 -3 -7 0 -10 Z" fill="#fff" />
        </g>
      );
    case 'venus':
      return <PlanetBadge fill="#e8c27a" />;
    case 'mars':
      return <PlanetBadge fill="#c8502c" />;
    case 'jupiter':
      return <PlanetBadge fill="#e0b080" bands />;
    case 'saturn':
      return <PlanetBadge fill="#e0c06a" ring />;
    case 'oumuamua':
      // Oumuamua : rocher brun allongé, en diagonale (comme sur le plateau)
      return (
        <g transform="translate(20 20) rotate(-35)">
          <ellipse rx={17} ry={6} fill="#6d4c41" stroke="#0b0f1e" strokeWidth={1.5} />
          <ellipse cx={-4} cy={-1.5} rx={6} ry={2} fill="#8d6e63" />
        </g>
      );
    case 'discard':
      // Carte défaussée : carte barrée d'une croix rouge
      return (
        <g transform="translate(20 18) rotate(-12)">
          <rect x={-10} y={-14} width={20} height={28} rx={2.5} fill="#f4f4f4" stroke="#2a2a2a" strokeWidth={2} />
          <g stroke="#ff2a2a" strokeWidth={3.5} strokeLinecap="round"><line x1={-5} y1={-6} x2={5} y2={4} /><line x1={5} y1={-6} x2={-5} y2={4} /></g>
        </g>
      );
  }
};

/** Carte de la rangée seule (carte blanche au coin haut droit noir), comme sur la piste d'observation */
export const RowCardIcon: React.FC<{ size?: number }> = ({ size = 22 }) => (
  <svg width={size} height={size} viewBox="4 2 32 32" style={{ display: 'block' }}>
    {signalBadge('card')}
  </svg>
);

/** Symbole « signal », avec un badge précisant le secteur (Terre, carte de la rangée, Mercure, carte défaussée) */
export const SignalIcon: React.FC<{ badge?: SignalBadge; size?: number }> = ({ badge, size = 28 }) => (
  <svg width={size} height={size} viewBox="-30 -30 60 60" style={{ display: 'block', overflow: 'visible' }}>
    <circle r={24} fill="#b8b8b8" />
    <SignalBars />
    {badge && <g transform="scale(0.8)">{signalBadge(badge)}</g>}
  </svg>
);

/** Signal gagné : disque à la couleur du secteur (gris pour un secteur quelconque) et badge éventuel, sans débordement */
export const SignalGainIcon: React.FC<{ color?: string; badge?: SignalBadge; size?: number }> = ({ color = '#b8b8b8', badge, size = 20 }) => (
  <svg width={size} height={size} viewBox={badge ? '-25 -25 58 58' : '-25 -25 50 50'} style={{ display: 'inline-block', verticalAlign: 'middle' }}>
    <circle r={24} fill={color} />
    <SignalBars />
    {badge && <g transform="scale(0.8)">{signalBadge(badge)}</g>}
  </svg>
);

/* --------------------------------------------- */
/* Tuiles Technologie (livret p. 17), sans texte */
/* --------------------------------------------- */

const TILE_COLORS = {
  exploration: { light: '#f47a2a', dark: '#c94a10', edge: '#6e2208' },
  observation: { light: '#c23aae', dark: '#8e1f80', edge: '#4a0c42' },
  computing: { light: '#2f86d8', dark: '#1a5aa6', edge: '#0c2c5c' },
};

/** Petit hexagone d'action dans une tuile */
const MiniHex: React.FC<{ kind: ActionIconKind; x: number; y: number; r?: number }> = ({ kind, x, y, r = 9 }) => {
  const st = ACTION_STYLES[kind];
  const s = r / 46;
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      <path d={HEX} fill={st.inner} stroke={st.frame} strokeWidth={7} strokeLinejoin="round" />
      {actionGlyph(kind, st.glyph)}
    </g>
  );
};

/** Pastille Déplacement réduite pour une tuile, avec un nombre éventuel */
const MiniMovement: React.FC<{ x: number; y: number; label?: string }> = ({ x, y, label }) => (
  <g transform={`translate(${x} ${y}) scale(${label ? 0.42 : 0.36})`}>
    <Movement amount={label} />
  </g>
);

/** Pastille de ressource du matériel (flèche colorée, symbole et nombre), réduite pour une tuile */
const MiniResource: React.FC<{ kind: 'credit' | 'energy' | 'media'; x: number; y: number; label: string }> = ({ kind, x, y, label }) => {
  // Le signe (+ / −) se place devant la pastille, le chiffre dessus comme sur le matériel
  const sign = label[0] === '+' || label[0] === '-' ? label[0] : '';
  return (
    <g transform={`translate(${x} ${y}) scale(0.42)`}>
      {sign && <text x={-22} y={9} textAnchor="end" fontSize={30} fontWeight={900} fill="#fff" stroke="#2b2b2b" strokeWidth={3} paintOrder="stroke" fontFamily="Arial Black, Arial, sans-serif">{sign === '-' ? '−' : '+'}</text>}
      <ArrowResource kind={kind} amount={label.slice(sign.length)} />
    </g>
  );
};

const SmallSignal: React.FC<{ x: number; y: number; badge?: SignalBadge }> = ({ x, y, badge }) => (
  <g transform={`translate(${x} ${y}) scale(0.5)`}>
    <circle r={24} fill="#b8b8b8" />
    <SignalBars />
    {badge && <g transform="scale(0.8)">{signalBadge(badge)}</g>}
  </g>
);

const Satellite: React.FC<{ x: number; y: number }> = ({ x, y }) => (
  <g transform={`translate(${x} ${y}) rotate(-40)`} fill="#fff">
    <rect x={-3} y={-4} width={6} height={8} rx={1} />
    <rect x={-13} y={-3} width={9} height={6} rx={0.6} />
    <rect x={4} y={-3} width={9} height={6} rx={0.6} />
  </g>
);

const tileGlyph = (techId: string): React.ReactNode => {
  if (techId.startsWith('exploration-1')) return <><Satellite x={29} y={30} /><Satellite x={29} y={52} /></>;
  if (techId.startsWith('exploration-2')) {
    // Champ d'astéroïdes : +1 Média à la visite
    return (
      <>
        <path d="M14 46 L22 34 L36 33 L44 42 L40 54 L26 58 L16 54 Z" fill="#2b2b2b" stroke="#fff" strokeWidth={1} />
        <circle cx={26} cy={44} r={2} fill="#555" /><circle cx={36} cy={48} r={1.5} fill="#555" />
        <MiniResource kind="media" x={38} y={22} label="+1" />
        {/* Quitter le champ d'astéroïdes ne coûte plus de déplacement supplémentaire */}
        <MiniMovement x={38} y={68} label="1" />
      </>
    );
  }
  if (techId.startsWith('exploration-3')) {
    // Atterrissage : 1 Énergie de moins
    return <><MiniHex kind="land" x={29} y={32} r={12} /><MiniResource kind="energy" x={31} y={60} label="-1" /></>;
  }
  if (techId.startsWith('exploration-4')) {
    // Lunes
    return (
      <>
        <circle cx={26} cy={40} r={13} fill="#4a4036" stroke="#fff" strokeWidth={1} />
        <circle cx={22} cy={36} r={3} fill="#f2ead8" /><circle cx={30} cy={44} r={2} fill="#f2ead8" /><circle cx={28} cy={33} r={1.4} fill="#f2ead8" />
        <MiniHex kind="land" x={38} y={52} r={8} />
      </>
    );
  }
  if (techId.startsWith('observation-1')) {
    // Signal sur la Terre ou un secteur adjacent (arc)
    return (
      <>
        <path d="M14 36 A16 16 0 0 1 44 36" fill="none" stroke="#fff" strokeWidth={3} pathLength={30} strokeDasharray="8 3" />
        <SmallSignal x={29} y={46} badge="earth" />
      </>
    );
  }
  if (techId.startsWith('observation-2')) return <><MiniResource kind="media" x={27} y={24} label="1" /><SmallSignal x={29} y={52} badge="mercury" /></>;
  if (techId.startsWith('observation-3')) return <SmallSignal x={29} y={42} badge="discard" />;
  if (techId.startsWith('observation-4')) {
    // 1 Énergie : lancer une sonde ou se déplacer
    return <><MiniResource kind="energy" x={21} y={28} label="1" /><MiniHex kind="launch" x={22} y={52} r={10} /><line x1={36} y1={22} x2={36} y2={62} stroke="#2b2b2b" strokeWidth={2} /><MiniMovement x={47} y={42} /></>;
  }
  // Fond d'un emplacement de l'Informatique : tuile unie, les emplacements de la piste portent déjà les bonus
  if (techId === 'computing') return null;
  // Informatique : 2 PV et le bonus de la case recouverte
  return (
    <>
      <circle cx={29} cy={30} r={11} fill="#14724f" stroke="#fff" strokeWidth={1.5} />
      <text x={29} y={34.5} textAnchor="middle" fontSize={13} fontWeight="bold" fill="#fff" fontFamily="Arial, sans-serif">2</text>
      <circle cx={29} cy={56} r={10} fill="none" stroke="#fff" strokeWidth={1.4} strokeDasharray="3 2" />
    </>
  );
};

/** Tuile Technologie (forme du matériel : coin coupé, tranche sombre), à la couleur de sa catégorie */
export const TechTileIcon: React.FC<{ techId: string; width?: number; height?: number }> = ({ techId, width = 58, height = 82 }) => {
  const uid = useUid();
  const category = techId.startsWith('exploration') ? 'exploration' : techId.startsWith('observation') ? 'observation' : 'computing';
  const col = TILE_COLORS[category];
  return (
    <svg width={width} height={height} viewBox="0 0 58 82" style={{ display: 'block' }}>
      <defs>
        <linearGradient id={`tile-${uid}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor={col.light} />
          <stop offset="100%" stopColor={col.dark} />
        </linearGradient>
      </defs>
      <path d="M4 1 H44 L57 14 V77 Q57 81 53 81 H5 Q1 81 1 77 V5 Q1 1 4 1 Z" fill={`url(#tile-${uid})`} stroke={col.edge} strokeWidth={1.5} />
      <path d="M1 5 Q1 1 4 1 H7 V81 H5 Q1 81 1 77 Z" fill={col.edge} opacity={0.7} />
      {tileGlyph(techId)}
    </svg>
  );
};

/* ------------------------------------------------------------- */
/* Ressources (livret p. 6, 14, 23, 28) : pastilles du matériel   */
/* ------------------------------------------------------------- */

export type ResourceIconKind = 'credit' | 'energy' | 'media' | 'card' | 'alienCard' | 'data' | 'token' | 'movement' | 'revenue';
/** Pastilles fléchées du matériel */
type ArrowKind = 'credit' | 'energy' | 'media' | 'card' | 'alienCard';

const RESOURCE_COLORS: Record<ArrowKind, string> = {
  credit: '#b8901c',
  energy: '#3daa3a',
  media: '#e8452a',
  card: '#2b2b2b',
  alienCard: '#6b3fa0',
};

/** Pictogramme blanc d'une pastille fléchée, centré sur (0, 0) */
const resourceGlyph = (kind: ArrowKind): React.ReactNode => {
  switch (kind) {
    case 'credit':
      // « C » anguleux traversé de deux barres
      return (
        <g fill="none" stroke="#fff">
          <path d="M6 -7 H0 L-6 0 L0 7 H6" strokeWidth={3.6} />
          <path d="M-0.5 -11 V-6 M3.5 -11 V-6 M-0.5 6 V11 M3.5 6 V11" strokeWidth={2} />
        </g>
      );
    case 'energy':
      return <path d="M2 -12 L-6 2 H0 L-3 12 L6 -3 H0 Z" fill="#fff" />;
    case 'alienCard':
      // Carte Alien : carte blanche inclinée marquée d'une tête d'extraterrestre (pas de symbole dans le livret)
      return (
        <g transform="rotate(8)">
          <rect x={-7} y={-11} width={14} height={21} rx={2} fill="#fff" />
          <path d="M0 -7 C5 -7 6 -3 5 0 C4 3 2 6 0 6 C-2 6 -4 3 -5 0 C-6 -3 -5 -7 0 -7 Z" fill="#4fbf5a" />
          <ellipse cx={-2.3} cy={-1} rx={1.9} ry={1.1} transform="rotate(25 -2.3 -1)" fill="#1d1d1d" />
          <ellipse cx={2.3} cy={-1} rx={1.9} ry={1.1} transform="rotate(-25 2.3 -1)" fill="#1d1d1d" />
        </g>
      );
    case 'card':
      // Carte blanche inclinée marquée « ? » (livret p. 11) : carte tirée au hasard
      return (
        <g transform="rotate(8)">
          <rect x={-7} y={-11} width={14} height={21} rx={2} fill="#fff" />
          <text y={6} textAnchor="middle" fontSize={16} fontWeight={900} fill="#2b2b2b" fontFamily="Arial Black, Arial, sans-serif">?</text>
        </g>
      );
    case 'media':
      // Micro sur son pied
      return (
        <g fill="none" stroke="#fff" strokeWidth={2.2} strokeLinecap="round">
          <rect x={-3.5} y={-12} width={7} height={13} rx={3.5} fill="#fff" />
          <path d="M-7 -2 Q-7 6 0 6 Q7 6 7 -2" />
          <line x1={0} y1={6} x2={0} y2={11} />
          <line x1={-4} y1={11} x2={4} y2={11} />
        </g>
      );
  }
};

/** Pastille fléchée (crédit, énergie, média), avec le nombre en blanc détouré à gauche */
const ArrowResource: React.FC<{ kind: ArrowKind; amount?: number | string }> = ({ kind, amount }) => {
  const color = RESOURCE_COLORS[kind];
  return (
    <>
      <path d="M-10 -16 H12 L24 0 L12 16 H-10 Q-14 16 -14 12 V-12 Q-14 -16 -10 -16 Z" fill={color}
        stroke={kind === 'card' ? '#e8e8e8' : undefined} strokeWidth={kind === 'card' ? 2.5 : undefined} strokeLinejoin="round" />
      <g transform={amount !== undefined ? 'translate(6 0)' : 'translate(2 0)'}>{resourceGlyph(kind)}</g>
      {amount !== undefined && (
        <text x={-12} y={10} textAnchor="middle" fontSize={30} fontWeight={900} fill="#fff" stroke={color} strokeWidth={3} paintOrder="stroke" fontFamily="Arial Black, Arial, sans-serif">{amount}</text>
      )}
    </>
  );
};

/** Token d'Oumuamua (exofossile) : jeton rond sarcelle et fossile spiralé (pas de symbole dans le livret) */
const OumuamuaToken: React.FC<{ amount?: number | string }> = ({ amount }) => (
  <g>
    <g transform={amount !== undefined ? 'translate(8 0)' : undefined}>
      <circle r={18} fill="#1f7f7a" stroke="#bff3ee" strokeWidth={2} />
      <path d="M0 0 C2 -1 2 -4 0 -4 C-4 -4 -5 1 -2 3.5 C2 6.5 8 3 8 -2 C8 -8 1 -11 -4 -9.5 C-10 -7.5 -12 0 -9 6 C-6 11 2 12.5 7 9.5"
        fill="none" stroke="#fff" strokeWidth={2.6} strokeLinecap="round" />
    </g>
    {amount !== undefined && (
      <text x={-14} y={10} textAnchor="middle" fontSize={30} fontWeight={900} fill="#fff" stroke="#1f7f7a" strokeWidth={3} paintOrder="stroke" fontFamily="Arial Black, Arial, sans-serif">{amount}</text>
    )}
  </g>
);

/** Jeton Donnée : losange bleu, disque de chiffres binaires */
const DataToken: React.FC<{ amount?: number | string }> = ({ amount }) => (
  <g>
    <g transform={amount !== undefined ? 'translate(8 0)' : undefined}>
      <rect x={-17} y={-17} width={34} height={34} rx={5} transform="rotate(45)" fill="#4a7fd0" />
      <circle r={13} fill="none" stroke="#dce8ff" strokeWidth={1.6} />
      <g fill="#dce8ff" fontSize={6.5} fontWeight="bold" fontFamily="Consolas, monospace" textAnchor="middle">
        <text y={-3}>0100</text><text y={3.5}>0011</text><text y={10}>0100</text>
      </g>
    </g>
    {/* Nombre blanc détouré de bleu, devant le losange (livret p. 10) */}
    {amount !== undefined && (
      <text x={-14} y={10} textAnchor="middle" fontSize={30} fontWeight={900} fill="#fff" stroke="#2c5aa8" strokeWidth={3} paintOrder="stroke" fontFamily="Arial Black, Arial, sans-serif">{amount}</text>
    )}
  </g>
);

/** Déplacement (livret p. 9) : disque bleu nuit cerclé de blanc, sonde blanche et flèche lavande vers la droite */
const Movement: React.FC<{ amount?: number | string }> = ({ amount }) => (
  <g>
    <g transform={amount !== undefined ? 'translate(6 0)' : undefined}>
      <circle r={17} fill="#1d2133" stroke="#e6e8f2" strokeWidth={1.8} />
      {/* Flèche */}
      <path d="M-1 -11 H8 L18 0 L8 11 H-1 L4 0 Z" fill="#c9cbe6" />
      {/* Sonde : antenne et corps */}
      <g fill="#fff" transform="rotate(-25)">
        <rect x={-9} y={-15} width={6} height={10} rx={1} />
        <path d="M-12 -3 L-2 -6 L1 3 L-9 6 Z" />
        <path d="M-14 3 L-11 9 M-4 5 L-3 11" stroke="#fff" strokeWidth={1.6} />
      </g>
    </g>
    {amount !== undefined && (
      <text x={-12} y={10} textAnchor="middle" fontSize={30} fontWeight={900} fill="#fff" stroke="#1d2133" strokeWidth={3} paintOrder="stroke" fontFamily="Arial Black, Arial, sans-serif">{amount}</text>
    )}
  </g>
);

/** Revenu : rosette blanche, barres et flèche montante en zigzag */
const Revenue = () => {
  const bumps = Array.from({ length: 10 }, (_, i) => (i * Math.PI) / 5);
  return (
    <g>
      <g fill="#fff" stroke="rgba(60, 60, 80, 0.5)" strokeWidth={1}>
        <circle r={16} />
        {bumps.map(a => <circle key={a} cx={15.5 * Math.cos(a)} cy={15.5 * Math.sin(a)} r={4} />)}
      </g>
      <circle r={16.5} fill="#fff" />
      <rect x={-7} y={5} width={5} height={5} fill="#3daa3a" />
      <rect x={3} y={-2} width={5} height={12} rx={1} fill="#c9a23a" />
      <path d="M-12 4 L-5 -3 L-2 1 L8 -9" fill="none" stroke="#222" strokeWidth={3} strokeLinejoin="round" />
      <path d="M3 -12 L11 -12 L10 -4 Z" fill="#222" />
    </g>
  );
};

/** Action gratuite « Transférer une donnée » : pastille fléchée bleutée (comme les échanges) et petit jeton Donnée */
export const TransferDataIcon: React.FC<{ size?: number }> = ({ size = 24 }) => (
  <svg width={size} height={size} viewBox="-24 -24 48 48" style={{ display: 'inline-block', verticalAlign: 'middle' }}>
    <path d="M-10 -16 H12 L24 0 L12 16 H-10 Q-14 16 -14 12 V-12 Q-14 -16 -10 -16 Z" fill="#2c5aa8" />
    <g transform="translate(2 0)">
      <rect x={-8} y={-8} width={16} height={16} rx={2.5} transform="rotate(45)" fill="#dce8ff" />
      <g fill="#2c5aa8" fontSize={5.5} fontWeight="bold" fontFamily="Consolas, monospace" textAnchor="middle">
        <text y={-0.5}>01</text><text y={5.5}>10</text>
      </g>
    </g>
  </svg>
);

/** Icône de ressource du matériel ; `amount` affiche le nombre comme sur les cartes */
export const ResourceIcon: React.FC<{ kind: ResourceIconKind; amount?: number; size?: number }> = ({ kind, amount, size = 24 }) => {
  const wide = kind !== 'revenue' && amount !== undefined;
  return (
    <svg width={wide ? size * 1.5 : size} height={size} viewBox={wide ? '-36 -24 72 48' : '-24 -24 48 48'} style={{ display: 'inline-block', verticalAlign: 'middle' }}>
      {kind === 'data' ? <DataToken amount={amount} /> : kind === 'token' ? <OumuamuaToken amount={amount} /> : kind === 'movement' ? <Movement amount={amount} /> : kind === 'revenue' ? <Revenue /> : <ArrowResource kind={kind} amount={amount} />}
    </svg>
  );
};

/* ------------------------------------------------------- */
/* Points de victoire (livret p. 10) et traces de vie (p. 11) */
/* ------------------------------------------------------- */


/** Trace de vie dans une case de 40 × 40 : triangle arrondi pointe en bas et pictogramme blanc */
/** Triangle d'une trace de vie (livret p. 11) : haut large aux coins arrondis, pointe arrondie ; cadre 1 1 38 36 */
export const LIFE_TRACE_PATH = 'M7.5 3 H32.5 Q38.6 3 36.6 8.6 L24.8 31.2 Q20 37.2 15.2 31.2 L3.4 8.6 Q1.4 3 7.5 3 Z';
/** Cadre (viewBox) qui contient tout le triangle */
export const LIFE_TRACE_VIEWBOX = '1 1 38 36';

export const LifeTraceShape: React.FC<{ color: LifeTraceColor }> = ({ color }) => {
  const fill = LIFE_TRACE_COLORS[color];
  return (
    <g>
      <path d={LIFE_TRACE_PATH} fill={fill} />
      {color === 'red' && (
        // Molécule : grosse sphère reliée à deux petites en haut et à une moyenne en bas
        <g fill="#fff">
          <path d="M10.6 8.6 L20 14.6 L29.4 8.6 M20 14.6 V25" fill="none" stroke="#fff" strokeWidth={2.4} strokeLinecap="round" />
          <circle cx={20} cy={14.6} r={6.2} />
          <circle cx={10.6} cy={8.6} r={3.1} />
          <circle cx={29.4} cy={8.6} r={3.1} />
          <circle cx={20} cy={25.2} r={3.7} />
        </g>
      )}
      {color === 'yellow' && (
        // Roche fendue, éclats orange
        <g>
          <path d="M12.2 10.4 L16.4 6.4 L23.4 6.8 L28 11 L27.4 17.8 L21.6 24.6 L15.4 22.6 L11.8 16.4 Z" fill="#fff" />
          <path d="M16.4 6.4 L15.2 12.6 L18.6 11.6 L17.6 19.4 M23.4 6.8 L21.8 12.2 L25.6 13.8" fill="none" stroke={fill} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
        </g>
      )}
      {color === 'blue' && (
        // Micro-organismes : deux bactéries épaisses aux cils courts, quelques points
        <g fill="#fff" stroke="#fff" strokeLinecap="round">
          <path d="M22.4 7.4 Q27.6 7.8 27.4 11.6 Q27.2 14.6 24.6 16" fill="none" strokeWidth={4.2} />
          <path d="M11.6 13.6 Q14.8 12.6 15.8 16 Q16.8 19.6 20.6 21.4" fill="none" strokeWidth={4.2} />
          <path d="M29.6 9.6 L31 9 M28.2 15.6 L29.4 16.6 M10 12.8 L8.8 11.8 M22.4 22.6 L23.2 24 M20.6 6.2 L20 5" fill="none" strokeWidth={0.9} />
          <g stroke="none">
            <circle cx={31.4} cy={10.6} r={0.9} /><circle cx={8.6} cy={9.4} r={0.9} /><circle cx={25.2} cy={25.4} r={0.9} />
            <circle cx={16.4} cy={26.2} r={0.8} /><circle cx={30} cy={17.6} r={0.8} />
          </g>
        </g>
      )}
    </g>
  );
};

/** Trace de vie de couleur quelconque : triangle en trois bandes diagonales (livret p. 20) */
export const AnyLifeTraceIcon: React.FC<{ size?: number }> = ({ size = 20 }) => {
  const uid = useUid();
  const shape = LIFE_TRACE_PATH;
  return (
    <svg width={size} height={size} viewBox={LIFE_TRACE_VIEWBOX} style={{ display: 'inline-block', verticalAlign: 'middle' }}>
      <defs><clipPath id={`anytrace-${uid}`}><path d={shape} /></clipPath></defs>
      <g clipPath={`url(#anytrace-${uid})`}>
        <rect x={0} y={0} width={40} height={40} fill={LIFE_TRACE_COLORS.yellow} />
        <path d="M0 0 H17 L5 40 H0 Z" fill={LIFE_TRACE_COLORS.red} />
        <path d="M29 0 H40 V40 H17 Z" fill={LIFE_TRACE_COLORS.blue} />
        <path d="M17 0 L5 40 M29 0 L17 40" stroke="#fff" strokeWidth={1.4} />
      </g>
    </svg>
  );
};

/** Trace de vie seule, à la taille voulue */
export const LifeTraceIcon: React.FC<{ color: LifeTraceColor; size?: number }> = ({ color, size = 20 }) => (
  <svg width={size} height={size} viewBox={LIFE_TRACE_VIEWBOX} style={{ display: 'inline-block', verticalAlign: 'middle' }}>
    <LifeTraceShape color={color} />
  </svg>
);

/** Points de victoire : écusson vert, couronne de laurier claire et nombre blanc */
export const VictoryPointsIcon: React.FC<{ amount?: number; size?: number }> = ({ amount, size = 20 }) => {
  const leaves = [0, 1, 2, 3, 4];
  const text = amount === undefined ? 'PV' : String(amount);
  return (
    <svg width={size} height={size} viewBox="-20 -20 40 40" style={{ display: 'inline-block', verticalAlign: 'middle' }}>
      <path d="M0 -19 C11 -19 19 -12 19 -1 C19 10 10 17 0 19.5 C-10 17 -19 10 -19 -1 C-19 -12 -11 -19 0 -19 Z" fill="#14705c" />
      {/* Laurier : feuilles le long de deux arcs, de la base vers le haut */}
      {[-1, 1].map(side => (
        <g key={side} fill="#6fd8bf" transform={`scale(${side} 1)`}>
          <path d="M3 16 Q-12 12 -13 -8" fill="none" stroke="#6fd8bf" strokeWidth={1.4} />
          {leaves.map(i => {
            const t = (i + 0.5) / leaves.length;
            const x = -3 - 11 * Math.sin(t * Math.PI * 0.62) - 1;
            const y = 15 - 25 * t;
            return <ellipse key={i} cx={x - 2.2} cy={y} rx={3.4} ry={1.6} transform={`rotate(${-35 - 40 * t} ${x - 2.2} ${y})`} />;
          })}
        </g>
      ))}
      <text y={text.length > 2 ? 4 : text.length > 1 ? 5.5 : 7} textAnchor="middle" fontSize={text.length > 2 ? 11 : text.length > 1 ? 15 : 20} fontWeight={900} fill="#fff" fontFamily="Arial Black, Arial, sans-serif">{text}</text>
    </svg>
  );
};

/** Couleurs des chevrons de rotation (anneau qui tourne : bleu, rouge, jaune), comme sur le plateau */
export const ROTATION_CHEVRON_COLORS: Record<string, string> = { Bleu: '#4a9eff', Rouge: '#ff4747', Jaune: '#ffd700' };

/** Chevron de rotation du Système Solaire, à la couleur de l'anneau qui tourne */
export const RotationChevronIcon: React.FC<{ color: string; size?: number }> = ({ color, size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 20 20" style={{ display: 'inline-block', verticalAlign: 'middle' }}>
    <path d="M6 3 L14 10 L6 17" fill="none" stroke="black" strokeWidth={6} strokeLinecap="round" strokeLinejoin="round" />
    <path d="M6 3 L14 10 L6 17" fill="none" stroke={color} strokeWidth={3.5} strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);
