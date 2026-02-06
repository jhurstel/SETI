import { Game, Player, ActionType, GAME_CONSTANTS, ProbeState } from '../core/types';
import { ProbeSystem } from '../systems/ProbeSystem';
import { ScanSystem } from '../systems/ScanSystem';
import { ComputerSystem } from '../systems/ComputerSystem';
import { CardSystem } from '../systems/CardSystem';
import { FIXED_OBJECTS, INITIAL_ROTATING_LEVEL1_OBJECTS, INITIAL_ROTATING_LEVEL2_OBJECTS, INITIAL_ROTATING_LEVEL3_OBJECTS } from '../core/SolarSystemPosition';
import { TechnologySystem } from '../systems/TechnologySystem';

export interface AIDecision {
  action: ActionType;
  data?: any;
}

export type AIDifficulty = 'PASS' | 'EASY' | 'MEDIUM' | 'EXPERT';

export class AIBehavior {

  /**
   * Décide de la prochaine action à effectuer selon la difficulté
   */
  static decideAction(game: Game, player: Player, difficulty: AIDifficulty = 'EASY'): AIDecision {
      switch (difficulty) {
          case 'PASS':
            return this.createPassDecision(game, player);  
          case 'EASY':
              return this.decideRandomAction(game, player);
          case 'MEDIUM':
          case 'EXPERT':
              // Pour l'instant, repli sur le comportement aléatoire pour les autres niveaux
              return this.decideRandomAction(game, player);
          default:
              return this.decideRandomAction(game, player);
      }
  }

  /**
   * Stratégie Facile : Choix purement aléatoire parmi les actions valides
   */
  private static decideRandomAction(game: Game, player: Player): AIDecision {
      console.log(`[AI] ${player.name} is deciding a random action...`);
      const possibleActions: AIDecision[] = [];

      // 1. LAUNCH_PROBE
      if (ProbeSystem.canLaunchProbe(game, player.id).canLaunch) {
          possibleActions.push({ action: ActionType.LAUNCH_PROBE });
      }

      // 2. SCAN_SECTOR
      if (ScanSystem.canScanSector(game, player.id).canScan) {
          possibleActions.push({ action: ActionType.SCAN_SECTOR });
      }

      // 3. ANALYZE_DATA
      if (ComputerSystem.canAnalyzeData(game, player.id).canAnalyze) {
          possibleActions.push({ action: ActionType.ANALYZE_DATA });
      }

      // 4. RESEARCH_TECH
      if (TechnologySystem.canResearchTech(game, player.id).canResearch) {
          const availableTechs = TechnologySystem.getAvailableTechs(game);
          if (availableTechs.length > 0) {
              const randomTech = availableTechs[Math.floor(Math.random() * availableTechs.length)];
              possibleActions.push({ action: ActionType.RESEARCH_TECH, data: { tech: randomTech } });
          }
      }

      // 5. PLAY_CARD
      const playableCards = player.cards.filter(c => CardSystem.canPlayCard(game, player.id, c).canPlay);
      if (playableCards.length > 0) {
          const randomCard = playableCards[Math.floor(Math.random() * playableCards.length)];
          possibleActions.push({ action: ActionType.PLAY_CARD, data: { cardId: randomCard.id } });
      }

      // 6. ORBIT & LAND
      // Trouver les sondes dans le système solaire et les planètes correspondantes
      const probesInSystem = player.probes.filter(p => p.state === ProbeState.IN_SOLAR_SYSTEM);
      const allPlanets = [
          ...FIXED_OBJECTS, 
          ...INITIAL_ROTATING_LEVEL1_OBJECTS, 
          ...INITIAL_ROTATING_LEVEL2_OBJECTS, 
          ...INITIAL_ROTATING_LEVEL3_OBJECTS
      ].filter(o => o.type === 'planet');

      probesInSystem.forEach(probe => {
          if (!probe.solarPosition) return;
          
          // Trouver la planète sur laquelle se trouve la sonde (approximation basée sur disque/secteur/niveau)
          const potentialPlanets = allPlanets.filter(planet => 
              planet.position.disk === probe.solarPosition!.disk && 
              planet.position.sector === probe.solarPosition!.sector &&
              (planet.level || 0) === (probe.solarPosition!.level || 0)
          );

          potentialPlanets.forEach(planetObj => {
              // Vérifier Orbite
              if (ProbeSystem.canOrbit(game, player.id, probe.id).canOrbit) {
                   possibleActions.push({
                      action: ActionType.ORBIT,
                      data: { probeId: probe.id, planetId: planetObj.id }
                   });
              }
              // Vérifier Atterrissage
              if (ProbeSystem.canLand(game, player.id, probe.id).canLand) {
                   possibleActions.push({
                      action: ActionType.LAND,
                      data: { probeId: probe.id, planetId: planetObj.id }
                   });
              }
          });
      });

      console.log(`[AI] ${player.name} found ${possibleActions.length} possible actions:`, possibleActions.map(a => a.action));

      // Si aucune action n'est possible, on passe
      if (possibleActions.length === 0) {
          console.log(`[AI] ${player.name} has no possible actions, passing.`);
          return this.createPassDecision(game, player);
      }

      // Choix aléatoire parmi les actions possibles
      const decision = possibleActions[Math.floor(Math.random() * possibleActions.length)];
      console.log(`[AI] ${player.name} chose:`, decision.action, decision.data);
      return decision;
  }

  /**
   * Crée une décision de passer avec choix aléatoire des cartes à garder
   */
  private static createPassDecision(game: Game, player: Player): AIDecision {
      const hand = player.cards;
      const keepCount = Math.min(hand.length, GAME_CONSTANTS.HAND_SIZE_AFTER_PASS);
      const shuffled = [...hand].sort(() => 0.5 - Math.random());
      const cardsToKeep = shuffled.slice(0, keepCount).map(c => c.id);
      game;
      return {
          action: ActionType.PASS,
          data: { cardsToKeep }
      };
  }

  /**
   * Décide quelle carte réserver (Setup)
   */
  static decideReservation(game: Game, player: Player): string | null {
      if (player.cards.length === 0) return null;
      game;
      const randomIndex = Math.floor(Math.random() * player.cards.length);
      return player.cards[randomIndex].id;
  }

  /**
   * Vérifie si le robot doit réclamer un palier d'objectif.
   * Retourne le palier et l'ID de la tuile objectif choisie.
   */
  static checkAndClaimMilestone(game: Game, player: Player): { milestone: number, tileId: string } | null {
    const milestones = [25, 50, 70];
    
    for (const m of milestones) {
      if (player.score >= m && !player.claimedGoldenMilestones.includes(m)) {
        // Trouver les tuiles où le joueur n'a pas encore de marqueur
        const availableTiles = (game.board.objectiveTiles || []).filter(t => !t.markers.includes(player.id));
        
        if (availableTiles.length > 0) {
          // Mock: Choisir une tuile au hasard parmi celles disponibles
          const randomTile = availableTiles[Math.floor(Math.random() * availableTiles.length)];
          return { milestone: m, tileId: randomTile.id };
        }
      }
    }
    return null;
  }
}