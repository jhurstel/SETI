import React from 'react';
import { Sector } from '../../core/types';
import { polarToCartesian } from '../../core/SolarSystemPosition';

// Étoile qui donne son nom à chaque secteur, dessinée discrètement au-delà de l'anneau extérieur,
// avec un halo qui s'estompe radialement. Repère du plateau : 0..200, centre (100, 100).

interface StarLook {
  /** Couleur de l'étoile (type spectral) */
  color: string;
  /** Rayon du cœur lumineux */
  core: number;
  /** Rayon du halo */
  halo: number;
  /** Détail propre à l'étoile, dessiné autour de (0, 0) */
  extra?: (color: string) => React.ReactNode;
}

const STAR_LOOKS: Record<string, StarLook> = {
  // Étoile de type solaire avec sa planète en zone habitable
  'kepler 22': { color: '#ffe3a0', core: 1.6, halo: 20, extra: () => <circle cx={5} cy={-2} r={0.6} fill="#8fb4d9" opacity={0.8} /> },
  // Naine rouge, petite et faible
  'proxima centauri': { color: '#ff7a59', core: 1.1, halo: 14 },
  // Étoile la plus brillante du ciel, blanc bleuté, avec sa naine blanche compagne
  'sirius a': {
    color: '#d4e6ff', core: 2.2, halo: 26,
    extra: c => (
      <g>
        <path d="M-7 0 H7 M0 -7 V7" stroke={c} strokeWidth={0.35} opacity={0.6} />
        <circle cx={3.8} cy={2.6} r={0.45} fill="#fff" opacity={0.85} />
      </g>
    ),
  },
  // Naine rouge proche, à fort mouvement propre (petite traînée)
  "barnard's star": { color: '#ff8a62', core: 1.1, halo: 14, extra: c => <path d="M-4 1.5 L-1.2 0.4" stroke={c} strokeWidth={0.5} strokeLinecap="round" opacity={0.35} /> },
  // Blanc-jaune, avec une naine blanche compagne
  'procyon': { color: '#fff1cf', core: 1.8, halo: 22, extra: () => <circle cx={-3.4} cy={-2.4} r={0.4} fill="#fff" opacity={0.8} /> },
  // Blanc bleuté entourée d'un disque de poussières vu de face
  'véga': {
    color: '#dbe8ff', core: 1.9, halo: 22,
    extra: c => <ellipse rx={5.5} ry={4.6} fill="none" stroke={c} strokeWidth={1.2} opacity={0.18} />,
  },
  // Étoile de type solaire
  '61 virginis': { color: '#ffe6a8', core: 1.5, halo: 18 },
  // Étoile jeune entourée d'un disque de débris vu par la tranche
  'beta pictoris': {
    color: '#eef3ff', core: 1.6, halo: 20,
    extra: c => <ellipse rx={9} ry={0.7} fill={c} opacity={0.3} transform="rotate(-25)" />,
  },
};

/** Rayon (repère 0..200) des étoiles : juste derrière le bord extérieur de la piste de slots (rayon 83),
 *  d'où elles dépassent assez pour être reconnues */
const STAR_RADIUS = 89;
/** Agrandissement de l'étoile et de ses détails */
const STAR_SCALE = 1.6;

const SectorStarsBase: React.FC<{ sectors: Sector[] }> = ({ sectors }) => (
  <svg className="seti-sector-stars-svg" viewBox="0 0 200 200">
    <defs>
      {sectors.map((sector, i) => {
        const look = STAR_LOOKS[sector.name.toLowerCase()];
        if (!look) return null;
        return (
          <radialGradient key={sector.id} id={`sector-star-halo-${i}`}>
            <stop offset="0%" stopColor={look.color} stopOpacity={0.35} />
            <stop offset="18%" stopColor={look.color} stopOpacity={0.12} />
            <stop offset="55%" stopColor={look.color} stopOpacity={0.03} />
            <stop offset="100%" stopColor={look.color} stopOpacity={0} />
          </radialGradient>
        );
      })}
    </defs>
    {sectors.map((sector, i) => {
      const look = STAR_LOOKS[sector.name.toLowerCase()];
      if (!look) return null;
      // Même découpage que les noms de secteur (SectorDetails) : milieu du secteur i
      const midAngle = -(360 / 8) * i - 90 - (360 / 16);
      const { x, y } = polarToCartesian(100, 100, STAR_RADIUS, midAngle);
      return (
        // Discrète pour laisser les slots bien nets ; le halo garde sa taille d'origine malgré l'agrandissement
        <g key={sector.id} transform={`translate(${x} ${y}) scale(${STAR_SCALE})`} opacity={0.5}>
          <circle r={look.halo / STAR_SCALE} fill={`url(#sector-star-halo-${i})`} />
          {look.extra?.(look.color)}
          <circle r={look.core * 1.8} fill={look.color} opacity={0.25} />
          <circle r={look.core} fill={look.color} />
          <circle r={look.core * 0.45} fill="#fff" />
        </g>
      );
    })}
  </svg>
);

/** Les étoiles ne dépendent que des noms des secteurs : pas de nouveau dessin à chaque copie de la partie */
export const SectorStars = React.memo(SectorStarsBase, (prev, next) =>
  prev.sectors.length === next.sectors.length && prev.sectors.every((s, i) => s.name === next.sectors[i].name));
