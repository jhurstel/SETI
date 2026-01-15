/**
 * Action : Rechercher une technologie
 */

import {
  Game,
  ActionType,
  ValidationResult
} from '../core/types';
import { BaseAction } from './Action';
import { TechnologySystem } from '../systems/TechnologySystem';

export class ResearchTechAction extends BaseAction {
  constructor(
    playerId: string,
    public technologyId: string
  ) {
    super(ActionType.RESEARCH_TECH, playerId);
  }

  validate(game: Game): ValidationResult {
    const validation = TechnologySystem.canResearchTechnology(
      game,
      this.playerId,
      this.technologyId
    );
    
    if (!validation.canResearch) {
      return this.createInvalidResult(validation.reason || 'Recherche impossible');
    }

    return this.createValidResult();
  }

  execute(game: Game): Game {
    const result = TechnologySystem.researchTechnology(
      game,
      this.playerId,
      this.technologyId
    );
    
    return result.updatedGame;
  }
}

