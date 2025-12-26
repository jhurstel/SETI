/**
 * Action : Analyser des données
 */

import {
  Game,
  ActionType,
  ValidationResult
} from '../core/types';
import { BaseAction } from './Action';
import { DataSystem } from '../systems/DataSystem';

export class AnalyzeDataAction extends BaseAction {
  constructor(playerId: string) {
    super(ActionType.ANALYZE_DATA, playerId);
  }

  validate(game: Game): ValidationResult {
    const validation = DataSystem.canAnalyzeData(game, this.playerId);
    
    if (!validation.canAnalyze) {
      return this.createInvalidResult(validation.reason || 'Analyse impossible');
    }

    return this.createValidResult();
  }

  execute(game: Game): Game {
    const result = DataSystem.analyzeData(game, this.playerId);
    
    // Si une espèce est découverte, appliquer les effets
    if (result.speciesDiscovered) {
      // TODO: Gérer la découverte d'espèce
      // Cela peut déclencher d'autres effets
    }
    
    return result.updatedGame;
  }
}

