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

export const PLANET_STYLES: { [key: string]: any } = {
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
      hasRings: true,
    },
    'jupiter': {
      background: 'radial-gradient(circle, #d8ca9d, #b89d6a)',
      border: '2px solid #c4b082',
      boxShadow: '0 0 3px rgba(216, 202, 157, 0.8)',
      hasBands: true,
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
      hasContinents: true,
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
  
  export const SATELLITE_STYLES: { [key: string]: string } = {
    'phobosdeimos': 'radial-gradient(circle at 30% 30%, #8b7355, #4a3c31)',
    'io': 'radial-gradient(circle at 30% 30%, #fffacd, #ffd700, #ff8c00)',
    'europa': 'radial-gradient(circle at 30% 30%, #f0f8ff, #b0c4de)',
    'ganymede': 'radial-gradient(circle at 30% 30%, #d3d3d3, #8b8b83)',
    'callisto': 'radial-gradient(circle at 30% 30%, #696969, #2f4f4f)',
    'titan': 'radial-gradient(circle at 30% 30%, #f4a460, #cd853f)',
    'enceladus': 'radial-gradient(circle at 30% 30%, #ffffff, #e0ffff)',
    'titania': 'radial-gradient(circle at 30% 30%, #dcdcdc, #708090)',
    'triton': 'radial-gradient(circle at 30% 30%, #ffe4e1, #bc8f8f)',
  };
  