/**
 * Action : Passer son tour
 * 
 * Effets :
 * - Le joueur ne joue plus cette manche
 * - Défausse à 4 cartes
 * - Choix d'une carte Fin de manche
 * - Peut déclencher rotation du système (premier Pass)
 */

import {
  Game,
  ActionType,
  ValidationResult
} from '../core/types';
import { BaseAction } from './Action';
import { TurnManager } from '../core/TurnManager';
import { CardSystem } from '../systems/CardSystem';
import { ProbeSystem } from '../systems/ProbeSystem';
import { createRotationState } from '../core/SolarSystemPosition';

export class PassAction extends BaseAction {
  constructor(
    playerId: string,
    public cardIdsToKeep: string[], // Cartes à garder (max 4)
    public endOfRoundCardId?: string // Carte Fin de manche choisie
  ) {
    super(ActionType.PASS, playerId);
  }

  validate(game: Game): ValidationResult {
    const player = game.players.find(p => p.id === this.playerId);
    if (!player) {
      return this.createInvalidResult('Joueur introuvable');
    }

    // Vérifier le nombre de cartes à garder
    if (this.cardIdsToKeep.length > 4) {
      return this.createInvalidResult('Maximum 4 cartes à garder');
    }

    // Vérifier que les cartes existent
    const invalidCards = this.cardIdsToKeep.filter(
      cardId => !player.cards.some(c => c.id === cardId)
    );
    if (invalidCards.length > 0) {
      return this.createInvalidResult('Certaines cartes sont invalides');
    }

    return this.createValidResult();
  }

  execute(game: Game): Game {
    let updatedGame = { ...game };
    updatedGame.isFirstToPass = false;
    // Copie profonde des joueurs et du board pour éviter les mutations
    updatedGame.players = updatedGame.players.map(p => ({ ...p }));
    updatedGame.board = { ...updatedGame.board };
    const playerIndex = updatedGame.players.findIndex(p => p.id === this.playerId);
    const player = updatedGame.players[playerIndex];

    // Défausser à 4 cartes
    const updatedPlayer = CardSystem.discardToHandSize(player, this.cardIdsToKeep);

    // TODO: Permettre le choix d'une carte Fin de manche
    // Si endOfRoundCardId est fourni, l'ajouter

    // Marquer le joueur comme ayant passé
    updatedPlayer.hasPassed = true;
    updatedGame.players[playerIndex] = updatedPlayer;

    // Vérifier si c'est le premier Pass de la manche
    // (déclenche la rotation du système solaire)
    if (TurnManager.isFirstPassOfRound(updatedGame)) {
      //const techBoard = { ...updatedGame.board.technologyBoard };
      //updatedGame.board.technologyBoard = techBoard;
      
      const currentLevel = updatedGame.board.solarSystem.nextRingLevel || 1;
      
      // Sauvegarder l'ancien état de rotation
      const oldRotationState = createRotationState(
        updatedGame.board.solarSystem.rotationAngleLevel1 || 0,
        updatedGame.board.solarSystem.rotationAngleLevel2 || 0,
        updatedGame.board.solarSystem.rotationAngleLevel3 || 0
      );

      // Copie du système solaire
      updatedGame.board.solarSystem = { ...updatedGame.board.solarSystem };

      // Pivoter le plateau courant (-45 degrés = sens anti-horaire)
      if (currentLevel === 1) {
        updatedGame.board.solarSystem.rotationAngleLevel1 = (updatedGame.board.solarSystem.rotationAngleLevel1 || 0) - 45;
        updatedGame.board.solarSystem.rotationAngleLevel2 = (updatedGame.board.solarSystem.rotationAngleLevel2 || 0) - 45;
        updatedGame.board.solarSystem.rotationAngleLevel3 = (updatedGame.board.solarSystem.rotationAngleLevel3 || 0) - 45;
      } else if (currentLevel === 2) {
        updatedGame.board.solarSystem.rotationAngleLevel2 = (updatedGame.board.solarSystem.rotationAngleLevel2 || 0) - 45;
        updatedGame.board.solarSystem.rotationAngleLevel3 = (updatedGame.board.solarSystem.rotationAngleLevel3 || 0) - 45;
      } else if (currentLevel === 3) {
        updatedGame.board.solarSystem.rotationAngleLevel3 = (updatedGame.board.solarSystem.rotationAngleLevel3 || 0) - 45;
      }

      // Incrémenter le plateau modulo 3
      updatedGame.board.solarSystem.nextRingLevel = (currentLevel % 3) + 1;
      updatedGame.isFirstToPass = true;

      // Nouvel état de rotation
      const newRotationState = createRotationState(
        updatedGame.board.solarSystem.rotationAngleLevel1 || 0,
        updatedGame.board.solarSystem.rotationAngleLevel2 || 0,
        updatedGame.board.solarSystem.rotationAngleLevel3 || 0
      );

      // Mettre à jour les positions des sondes
      updatedGame = ProbeSystem.updateProbesAfterRotation(updatedGame, oldRotationState, newRotationState);
    }

    // Passer au joueur suivant ou terminer la manche
    updatedGame = TurnManager.nextPlayer(updatedGame);

    return updatedGame;
  }
}
