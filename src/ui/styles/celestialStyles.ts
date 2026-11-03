import type { CSSProperties } from 'react';
import { FreeActionType, SectorType, RevenueType, TechnologyCategory } from '../../core/types';

export const FREE_ACTION_STYLES: Record<string, { color: string, borderColor: string, bgColor: string }> = {
  [FreeActionType.DATA]: {
    color: '#2196f3',
    borderColor: '#2196f3',
    bgColor: 'rgba(33, 150, 243, 0.15)'
  },
  [FreeActionType.MEDIA]: {
    color: '#e53935',
    borderColor: '#e53935',
    bgColor: 'rgba(229, 57, 53, 0.15)'
  },
  [FreeActionType.MOVEMENT]: {
    color: '#fff',
    borderColor: '#ddd',
    bgColor: 'rgba(40,40,40,0.95)'
  },
  [FreeActionType.PV_MOVEMENT]: {
    color: '#fff',
    borderColor: '#ddd',
    bgColor: 'rgba(40,40,40,0.95)'
  },
  [FreeActionType.PV_DATA]: {
    color: '#2196f3',
    borderColor: '#2196f3',
    bgColor: 'rgba(33, 150, 243, 0.15)'
  },
  [FreeActionType.TWO_MEDIA]: {
    color: '#e53935',
    borderColor: '#e53935',
    bgColor: 'rgba(229, 57, 53, 0.15)'
  }
};

export const SECTOR_STYLES: Record<string, { color: string, borderColor: string, bgColor: string }> = {
  [SectorType.BLUE]: {
    color: '#4a9eff',
    borderColor: '#4a9eff',
    bgColor: '#4a9eff26'
  },
  [SectorType.RED]: {
    color: '#ff6b6b',
    borderColor: '#ff6b6b',
    bgColor: '#ff6b6b26'
  },
  [SectorType.YELLOW]: {
    color: '#ffd700',
    borderColor: '#ffd700',
    bgColor: '#ffd70026'
  },
  [SectorType.BLACK]: {
    color: '#aaaaaa',
    borderColor: '#aaaaaa',
    bgColor: '#aaaaaa26'
  },
};

export const REVENUE_STYLES: Record<string, { color: string, borderColor: string, bgColor: string }> = {
  [RevenueType.ENERGY]: {
    color: '#4caf50', // Vert
    borderColor: '#4caf50',
    bgColor: 'rgba(76, 175, 80, 0.15)'
  },
  [RevenueType.CREDIT]: {
    color: '#ffd700', // Or
    borderColor: '#ffd700',
    bgColor: 'rgba(255, 215, 0, 0.15)'
  },
  [RevenueType.CARD]: {
    color: '#000', // Noir
    borderColor: '#000',
    bgColor: '#e0e0e0' // Fond clair
  },
  [RevenueType.MEDIA]: {
    color: '#e53935', // Rouge
    borderColor: '#e53935',
    bgColor: 'rgba(229, 57, 53, 0.15)'
  },
  [RevenueType.DATA]: {
    color: '#2196f3', // Bleu
    borderColor: '#2196f3',
    bgColor: 'rgba(33, 150, 243, 0.15)'
  }
};

export const TECHNOLOGY_STYLES: Record<string, { color: string, borderColor: string, border: string }> = {
  [TechnologyCategory.EXPLORATION]: {
    color: '#ffeb3b',
    borderColor: '#ffeb3b',
    border: '1px solid #ffeb3b'
  },
  [TechnologyCategory.OBSERVATION]: {
    color: '#ff6b6b',
    borderColor: '#ff6b6b',
    border: '1px solid #ff6b6b'
  },
  [TechnologyCategory.COMPUTING]: {
    color: '#4a9eff',
    borderColor: '#4a9eff',
    border: '1px solid #4a9eff'
  },
  DEFAULT: {
    color: '#fff',
    borderColor: '#fff',
    border: '1px solid #fff'
  }
};

/** Apparence simplifiée d'une planète (Oumuamua, valeurs de repli) ; les planètes sont dessinées par PlanetGlobe */
export type PlanetStyle = CSSProperties;

export const PLANET_STYLES: Record<string, PlanetStyle> = {
    'neptune': {
      background: 'radial-gradient(circle, #4166f5, #1e3a8a)',
      border: '2px solid #60a5fa',
      boxShadow: '0 0 3px rgba(65, 102, 245, 0.8)',
    },
    'uranus': {
      background: 'radial-gradient(circle, #4fd0e7, #1e88a8)',
      border: '2px solid #7dd3fc',
      boxShadow: '0 0 3px rgba(79, 208, 231, 0.8)',
    },
    'saturn': {
      background: 'radial-gradient(circle, #fad5a5, #d4a574)',
      border: '2px solid #e8c99a',
      boxShadow: '0 0 3px rgba(250, 213, 165, 0.8)',
    },
    'jupiter': {
      background: 'radial-gradient(circle, #d8ca9d, #b89d6a)',
      border: '2px solid #c4b082',
      boxShadow: '0 0 3px rgba(216, 202, 157, 0.8)',
    },
    'mars': {
      background: 'radial-gradient(circle, #cd5c5c, #8b3a3a)',
      border: '2px solid #dc7878',
      boxShadow: '0 0 3px rgba(205, 92, 92, 0.8)',
    },
    'earth': {
      background: 'radial-gradient(circle, #4a90e2, #2c5282)',
      border: '2px solid #63b3ed',
      boxShadow: '0 0 3px rgba(74, 144, 226, 0.8)',
    },
    'venus': {
      background: 'radial-gradient(circle, #ffd700, #b8860b)',
      border: '2px solid #ffed4e',
      boxShadow: '0 0 3px rgba(255, 215, 0, 0.8)',
    },
    'mercury': {
      background: 'radial-gradient(circle, #8c7853, #5a4a35)',
      border: '2px solid #a08d6b',
      boxShadow: '0 0 3px rgba(140, 120, 83, 0.8)',
    },
    'oumuamua': {
      background: 'radial-gradient(circle at 40% 40%, #8d6e63, #5d4037, #3e2723)',
      border: '1px solid #5d4037',
      boxShadow: '0 0 2px rgba(0,0,0,0.8)',
      borderRadius: '60% 40% 70% 30% / 50% 60% 40% 50%',
      transform: 'translate(-20px, -50px) rotate(45deg) scale(2.8, 0.6)',
    },
  };
  
  export const PLANET_SIZES: { [key: string]: number } = {
    'neptune': 32,
    'uranus': 32,
    'saturn': 28,
    'jupiter': 36,
    'mars': 24,
    'earth': 26,
    'venus': 24,
    'mercury': 20,
    'oumuamua': 20,
  };
  
  /** Lunes : reflet en haut à gauche, quelques taches de relief, teinte, bord assombri (l'ombrage s'ajoute dans PlanetIcon) */
  const moon = (light: string, base: string, dark: string, spots = 'rgba(0, 0, 0, 0.18)') => [
    'radial-gradient(circle at 32% 28%, rgba(255, 255, 255, 0.35), rgba(255, 255, 255, 0) 30%)',
    `radial-gradient(circle at 62% 58%, ${spots} 0, ${spots} 9%, transparent 14%)`,
    `radial-gradient(circle at 40% 70%, ${spots} 0, ${spots} 6%, transparent 10%)`,
    `radial-gradient(circle at 70% 30%, ${spots} 0, ${spots} 5%, transparent 9%)`,
    `radial-gradient(circle at 35% 32%, ${light}, ${base} 55%, ${dark} 100%)`,
  ].join(', ');

  export const SATELLITE_STYLES: { [key: string]: string } = {
    'phobosdeimos': moon('#a89070', '#6e5a45', '#2e241b'),
    'io': moon('#fffad0', '#f2c94c', '#9a5a10', 'rgba(170, 60, 20, 0.35)'),
    'europa': moon('#ffffff', '#cbd8e6', '#6d7f96', 'rgba(150, 90, 60, 0.25)'),
    'ganymede': moon('#e2ddd4', '#9a948a', '#45413b'),
    'callisto': moon('#8e8a84', '#55534f', '#1f1e1c', 'rgba(220, 220, 210, 0.18)'),
    'titan': moon('#ffd09a', '#d4904a', '#6e3e14', 'rgba(255, 220, 160, 0.15)'),
    'enceladus': moon('#ffffff', '#e6f6ff', '#93aebd', 'rgba(120, 170, 210, 0.15)'),
    'titania': moon('#e8e8e8', '#9aa3ad', '#434a52'),
    'triton': moon('#fff0ec', '#d1a9a2', '#6d4a45', 'rgba(140, 90, 85, 0.25)'),
  };
  