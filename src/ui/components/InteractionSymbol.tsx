import React from 'react';
import { InteractionState, SectorType, TechnologyCategory } from '../../core/types';
import { BonusIcons } from './BonusIcons';
import { SignalGainIcon } from './GameIcons';
import { OrbiterIcon, LanderIcon, ReservationIcon } from './ObjectiveSymbol';

const SIZE = 26;

/**
 * Symboles d'une interaction proposée dans un menu de choix (récompenses à résoudre dans l'ordre voulu) :
 * signal du secteur visé, trace de vie, technologie, cartes, déplacements… ; null si l'interaction n'a pas de symbole
 * (l'option affiche alors son libellé).
 */
export const interactionSymbol = (state: InteractionState): React.ReactNode => {
  const icons = (bonus: Parameters<typeof BonusIcons>[0]['bonus']) => <BonusIcons bonus={bonus} size={SIZE} empty={null} />;
  switch (state.type) {
    case 'SELECTING_SCAN_SECTOR': {
      const scope = state.adjacents ? SectorType.EARTH : state.onlyProbes || state.anyProbe ? SectorType.PROBE : state.color;
      return icons({ signals: [{ amount: 1, scope }] });
    }
    case 'SELECTING_SCAN_CARD': return icons({ signals: [{ amount: 1, scope: SectorType.ROW }] });
    case 'DRAW_AND_SCAN': return icons({ signals: [{ amount: 1, scope: SectorType.DECK }] });
    case 'DISCARDING_FOR_SIGNAL': return <SignalGainIcon badge="discard" size={SIZE + 2} />;
    case 'PLACING_LIFE_TRACE': return icons({ lifetraces: [{ amount: 1, scope: state.color }] });
    case 'ACQUIRING_TECH': return state.categories && state.categories.length > 0
      ? icons({ technologies: state.categories.map(scope => ({ amount: 1, scope })) })
      : icons({ technologies: [{ amount: 1, scope: TechnologyCategory.ANY }] });
    case 'ACQUIRING_CARD': return icons({ card: state.count });
    case 'ACQUIRING_ALIEN_CARD': return icons({ speciesCard: state.count });
    case 'MOVING_PROBE': return icons({ movements: state.count });
    case 'ORBITING_PROBE': return <OrbiterIcon size={SIZE} />;
    case 'LANDING_PROBE': return <LanderIcon size={SIZE} />;
    case 'RESERVING_CARD': return <ReservationIcon size={SIZE} />;
    case 'REMOVING_ORBITER': return <OrbiterIcon size={SIZE} />;
    case 'REMOVING_LANDER': return <LanderIcon size={SIZE} />;
    default: return null;
  }
};
