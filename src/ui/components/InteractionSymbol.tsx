import React from 'react';
import { InteractionState, SectorType, TechnologyCategory } from '../../core/types';
import { BonusIcons } from './BonusIcons';
import { CentaurienMessageIcon, DiscardCardIcon, MascamiteIcon, MissionCompleteIcon, ResourceIcon, SignalGainIcon, TechTileIcon, VictoryPointsIcon } from './GameIcons';
import { OrbiterIcon, LanderIcon, ReservationIcon, TechCategoryIcon } from './ObjectiveSymbol';

const SIZE = 26;
/** Largeur d'une tuile Technologie à la hauteur des symboles (proportions 58 × 82) */
const TILE_WIDTH = Math.round((SIZE + 6) * 58 / 82);

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
    case 'CHOOSING_MEDIA_OR_MOVE': return <><ResourceIcon kind="media" size={SIZE - 4} /><ResourceIcon kind="movement" size={SIZE - 4} /></>;
    case 'COLLECTING_SPECIMEN':
    case 'CONSULTING_SPECIMEN': return <MascamiteIcon size={SIZE} />;
    case 'DISCARDING_TOKEN': return <ResourceIcon kind="token" size={SIZE - 4} />;
    case 'CHOOSING_CENTAURIEN_REWARD': return <CentaurienMessageIcon size={SIZE} />;
    case 'SELECTING_COMPUTER_SLOT': return <TechCategoryIcon category={TechnologyCategory.COMPUTING} size={SIZE} />;
    case 'PLACING_OBJECTIVE_MARKER': return <VictoryPointsIcon size={SIZE} />;
    case 'DISCARDING_CARD': return <DiscardCardIcon size={SIZE} />;
    case 'CLAIMING_MISSION_REQUIREMENT':
    case 'CHOOSING_MISSION_REQUIREMENT': return <MissionCompleteIcon size={SIZE} />;
    case 'CHOOSING_EXERTIEN_CARD': return <span className="seti-glossary-emoji">☣️</span>;
    case 'CHOOSING_OBS2_ACTION': return <TechTileIcon techId="observation-2" width={TILE_WIDTH} height={SIZE + 6} />;
    case 'CHOOSING_OBS3_ACTION': return <TechTileIcon techId="observation-3" width={TILE_WIDTH} height={SIZE + 6} />;
    case 'CHOOSING_OBS4_ACTION': return <TechTileIcon techId="observation-4" width={TILE_WIDTH} height={SIZE + 6} />;
    default: return null;
  }
};
