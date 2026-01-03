/**
 * Système de gestion des sondes
 * 
 * Gère :
 * - Lancement de sondes
 * - Déplacement des sondes
 * - Mise en orbite
 * - Atterrissage
 * - Limites (max 1 sonde dans le système solaire sans technologie)
 */

import {
  Game,
  Player,
  Probe,
  ProbeState,
  Position,
  SystemTile,
  TileType,
  Board,
  GAME_CONSTANTS,
  DiskName,
  SectorNumber
} from '../core/types';
import { BoardManager } from '../core/Board';
import { getObjectPosition, createRotationState } from '../core/SolarSystemPosition';

export class ProbeSystem {
  /**
   * Vérifie si un joueur peut lancer une sonde
   */
  static canLaunchProbe(game: Game, playerId: string): {
    canLaunch: boolean;
    reason?: string;
  } {
    const player = game.players.find(p => p.id === playerId);
    if (!player) {
      return { canLaunch: false, reason: 'Joueur introuvable' };
    }

    // Vérifier les crédits
    if (player.credits < GAME_CONSTANTS.PROBE_LAUNCH_COST) {
      return { 
        canLaunch: false, 
        reason: `Crédits insuffisants (nécessite ${GAME_CONSTANTS.PROBE_LAUNCH_COST})` 
      };
    }

    // Vérifier la limite de sondes dans le système solaire
    const probesInSystem = player.probes.filter(
      p => p.state === ProbeState.IN_SOLAR_SYSTEM
    );

    // TODO: Vérifier les technologies qui permettent plusieurs sondes
    const maxProbes = this.getMaxProbesInSystem(player);
    
    if (probesInSystem.length >= maxProbes) {
      return { 
        canLaunch: false, 
        reason: `Limite de sondes atteinte (max ${maxProbes} dans le système solaire)` 
      };
    }

    return { canLaunch: true };
  }

  /**
   * Obtient le nombre maximum de sondes dans le système solaire
   */
  private static getMaxProbesInSystem(player: Player): number {
    // Par défaut : 1 sonde
    let max = GAME_CONSTANTS.MAX_PROBES_PER_SYSTEM;

    // TODO: Vérifier les technologies qui augmentent cette limite
    // Exemple : technologie "Flotte de sondes" → max = 2

    return max;
  }

  /**
   * Lance une sonde (place sur Terre)
   */
  static launchProbe(
    game: Game, 
    playerId: string,
    earthPosition?: { disk: DiskName; sector: SectorNumber }
  ): {
    updatedGame: Game;
    probeId: string;
  } {
    const updatedGame = { ...game };
    const playerIndex = updatedGame.players.findIndex(p => p.id === playerId);
    const player = updatedGame.players[playerIndex];

    // Calculer la position réelle de la Terre
    // La Terre est sur le plateau niveau 3, en secteur 2 (A2) par rapport au plateau
    // Utiliser les angles de rotation actuels depuis le jeu
    let earthDisk: DiskName = 'A';
    let earthSector: SectorNumber = 2;
    
    if (!earthPosition) {
      // Obtenir les angles de rotation actuels depuis le jeu
      const rotationAngle1 = updatedGame.board.solarSystem.rotationAngleLevel1 || 0;
      const rotationAngle2 = updatedGame.board.solarSystem.rotationAngleLevel2 || 0;
      const rotationAngle3 = updatedGame.board.solarSystem.rotationAngleLevel3 || 0;
      
      // Utiliser getObjectPosition pour calculer la position absolue avec les angles réels
      const rotationState = createRotationState(rotationAngle1, rotationAngle2, rotationAngle3);
      const earthPos = getObjectPosition('earth', rotationState);
      
      if (earthPos) {
        earthDisk = earthPos.disk;
        earthSector = earthPos.absoluteSector;
      }
    } else {
      earthDisk = earthPosition.disk;
      earthSector = earthPosition.sector;
    }

    const probe: Probe = {
      id: `probe_${Date.now()}_${playerId}`,
      ownerId: playerId,
      position: { x: 0, y: 0 }, // Position générale (non utilisée pour le système solaire)
      solarPosition: {
        disk: earthDisk,
        sector: earthSector
      },
      state: ProbeState.IN_SOLAR_SYSTEM,
      isOrbiter: false,
      isLander: false
    };

    // Débiter les crédits
    const updatedPlayer = {
      ...player,
      credits: player.credits - GAME_CONSTANTS.PROBE_LAUNCH_COST,
      probes: [...player.probes, probe]
    };

    updatedGame.players[playerIndex] = updatedPlayer;

    // Ajouter la sonde au système solaire en préservant tous les champs (y compris les angles de rotation)
    updatedGame.board = {
      ...updatedGame.board,
      solarSystem: {
        ...updatedGame.board.solarSystem,
        probes: [...(updatedGame.board.solarSystem.probes || []), probe]
      }
    };

    return {
      updatedGame,
      probeId: probe.id
    };
  }

  /**
   * Vérifie si un déplacement est valide
   */
  static canMoveProbe(
    game: Game,
    playerId: string,
    probeId: string,
    targetPosition: Position
  ): {
    canMove: boolean;
    reason?: string;
    energyCost?: number;
  } {
    const player = game.players.find(p => p.id === playerId);
    if (!player) {
      return { canMove: false, reason: 'Joueur introuvable' };
    }

    const probe = player.probes.find(p => p.id === probeId);
    if (!probe) {
      return { canMove: false, reason: 'Sonde introuvable' };
    }

    if (probe.state !== ProbeState.IN_SOLAR_SYSTEM) {
      return { canMove: false, reason: 'La sonde doit être dans le système solaire' };
    }

    // Vérifier que la case cible est adjacente
    if (!this.isAdjacent(probe.position, targetPosition)) {
      return { canMove: false, reason: 'Case non adjacente' };
    }

    // Vérifier la case cible
    const targetTile = BoardManager.findTileByPosition(game.board, targetPosition);
    if (!targetTile) {
      return { canMove: false, reason: 'Case invalide' };
    }

    // Soleil : infranchissable
    if (targetTile.type === TileType.SUN) {
      return { canMove: false, reason: 'Le soleil est infranchissable' };
    }

    // Calculer le coût en énergie
    let energyCost = 1; // 1 énergie = 1 déplacement

    // Champ d'astéroïdes : coût +1 pour en sortir
    const currentTile = BoardManager.findTileByPosition(game.board, probe.position);
    if (currentTile?.type === TileType.ASTEROID) {
      energyCost += 1;
    }

    // Vérifier l'énergie disponible
    if (player.energy < energyCost) {
      return { 
        canMove: false, 
        reason: `Énergie insuffisante (nécessite ${energyCost})`,
        energyCost 
      };
    }

    return { canMove: true, energyCost };
  }

  /**
   * Vérifie si deux positions sont adjacentes (pas en diagonale)
   */
  private static isAdjacent(pos1: Position, pos2: Position): boolean {
    const dx = Math.abs(pos1.x - pos2.x);
    const dy = Math.abs(pos1.y - pos2.y);
    return (dx === 1 && dy === 0) || (dx === 0 && dy === 1);
  }

  /**
   * Déplace une sonde
   */
  static moveProbe(
    game: Game,
    playerId: string,
    probeId: string,
    targetPosition: Position
  ): Game {
    const validation = this.canMoveProbe(game, playerId, probeId, targetPosition);
    if (!validation.canMove) {
      throw new Error(validation.reason || 'Déplacement impossible');
    }

    const updatedGame = { ...game };
    const playerIndex = updatedGame.players.findIndex(p => p.id === playerId);
    const player = updatedGame.players[playerIndex];
    const probeIndex = player.probes.findIndex(p => p.id === probeId);

    // Débiter l'énergie
    const updatedPlayer = {
      ...player,
      energy: player.energy - (validation.energyCost || 1),
      probes: player.probes.map((p, idx) => {
        if (idx === probeIndex) {
          return {
            ...p,
            position: targetPosition
          };
        }
        return p;
      })
    };

    updatedGame.players[playerIndex] = updatedPlayer;

    // Mettre à jour la position dans le système solaire
    const systemProbe = updatedGame.board.solarSystem.probes.find(
      p => p.id === probeId
    );
    if (systemProbe) {
      systemProbe.position = targetPosition;
    }

    // Mettre à jour les cases
    const currentTile = BoardManager.findTileByPosition(
      updatedGame.board,
      player.probes[probeIndex].position
    );
    const targetTile = BoardManager.findTileByPosition(
      updatedGame.board,
      targetPosition
    );

    if (currentTile && targetTile) {
      // Retirer de l'ancienne case
      currentTile.probes = currentTile.probes.filter(p => p.id !== probeId);
      // Ajouter à la nouvelle case
      targetTile.probes.push(updatedPlayer.probes[probeIndex]);

      // Bonus de couverture médiatique si applicable
    if (targetTile.mediaBonus) {
      updatedPlayer.mediaCoverage = Math.min(
        updatedPlayer.mediaCoverage + targetTile.mediaBonus,
        GAME_CONSTANTS.MAX_MEDIA_COVERAGE
      );
    }
    }

    return updatedGame;
  }

  /**
   * Vérifie si une sonde peut être mise en orbite
   */
  static canOrbit(
    game: Game,
    playerId: string,
    probeId: string
  ): {
    canOrbit: boolean;
    reason?: string;
  } {
    const player = game.players.find(p => p.id === playerId);
    if (!player) {
      return { canOrbit: false, reason: 'Joueur introuvable' };
    }

    const probe = player.probes.find(p => p.id === probeId);
    if (!probe) {
      return { canOrbit: false, reason: 'Sonde introuvable' };
    }

    if (probe.state !== ProbeState.IN_SOLAR_SYSTEM) {
      return { canOrbit: false, reason: 'La sonde doit être dans le système solaire' };
    }

    // Vérifier que la sonde est sur une planète (pas Terre)
    const tile = BoardManager.findTileByPosition(game.board, probe.position);
    if (!tile || tile.type !== TileType.PLANET || !tile.planetId) {
      return { canOrbit: false, reason: 'La sonde doit être sur une planète' };
    }

    // Vérifier les ressources
    if (player.credits < GAME_CONSTANTS.ORBIT_COST_CREDITS) {
      return { 
        canOrbit: false, 
        reason: `Crédits insuffisants (nécessite ${GAME_CONSTANTS.ORBIT_COST_CREDITS})` 
      };
    }

    if (player.energy < GAME_CONSTANTS.ORBIT_COST_ENERGY) {
      return { 
        canOrbit: false, 
        reason: `Énergie insuffisante (nécessite ${GAME_CONSTANTS.ORBIT_COST_ENERGY})` 
      };
    }

    return { canOrbit: true };
  }

  /**
   * Met une sonde en orbite
   */
  static orbitProbe(
    game: Game,
    playerId: string,
    probeId: string
  ): {
    updatedGame: Game;
    isFirstOrbiter: boolean;
    planetId: string;
  } {
    const validation = this.canOrbit(game, playerId, probeId);
    if (!validation.canOrbit) {
      throw new Error(validation.reason || 'Mise en orbite impossible');
    }

    const updatedGame = { ...game };
    const playerIndex = updatedGame.players.findIndex(p => p.id === playerId);
    const player = updatedGame.players[playerIndex];
    const probe = player.probes.find(p => p.id === probeId)!;
    const tile = BoardManager.findTileByPosition(game.board, probe.position)!;
    const planetId = tile.planetId!;

    // Vérifier si c'est le premier orbiteur
    const planet = updatedGame.board.planets.find(p => p.id === planetId);
    const isFirstOrbiter = planet ? planet.orbiters.length === 0 : true;

    // Mettre à jour la sonde
    const updatedProbe = {
      ...probe,
      state: ProbeState.IN_ORBIT,
      planetId,
      isOrbiter: true
    };

    const updatedPlayer = {
      ...player,
      credits: player.credits - GAME_CONSTANTS.ORBIT_COST_CREDITS,
      energy: player.energy - GAME_CONSTANTS.ORBIT_COST_ENERGY,
      probes: player.probes.map(p => p.id === probeId ? updatedProbe : p)
    };

    updatedGame.players[playerIndex] = updatedPlayer;

    // Ajouter à la planète
    if (planet) {
      planet.orbiters.push(updatedProbe);
    }

    // Retirer du système solaire en préservant tous les champs (y compris les angles de rotation)
    updatedGame.board = {
      ...updatedGame.board,
      solarSystem: {
        ...updatedGame.board.solarSystem,
        probes: updatedGame.board.solarSystem.probes.filter(p => p.id !== probeId)
      }
    };

    // Retirer de la case
    tile.probes = tile.probes.filter(p => p.id !== probeId);

    // Bonus : 3 PV si premier orbiteur
    if (isFirstOrbiter) {
      updatedPlayer.score += 3;
    }

    // Bonus planète
    if (planet?.bonus) {
      if (planet.bonus.credits) {
        updatedPlayer.credits += planet.bonus.credits;
      }
      if (planet.bonus.energy) {
        updatedPlayer.energy += planet.bonus.energy;
      }
      if (planet.bonus.media) {
        updatedPlayer.mediaCoverage = Math.min(
          updatedPlayer.mediaCoverage + planet.bonus.media,
          GAME_CONSTANTS.MAX_MEDIA_COVERAGE
        );
      }
      if (planet.bonus.pv) {
        updatedPlayer.score += planet.bonus.pv;
      }
    }

    return {
      updatedGame,
      isFirstOrbiter,
      planetId
    };
  }

  /**
   * Vérifie si une sonde peut atterrir
   */
  static canLand(
    game: Game,
    playerId: string,
    probeId: string
  ): {
    canLand: boolean;
    reason?: string;
    energyCost?: number;
  } {
    const player = game.players.find(p => p.id === playerId);
    if (!player) {
      return { canLand: false, reason: 'Joueur introuvable' };
    }

    const probe = player.probes.find(p => p.id === probeId);
    if (!probe) {
      return { canLand: false, reason: 'Sonde introuvable' };
    }

    if (probe.state !== ProbeState.IN_ORBIT) {
      return { canLand: false, reason: 'La sonde doit être en orbite' };
    }

    // Calculer le coût (réduit si orbiteur déjà présent)
    const planet = game.board.planets.find(p => p.id === probe.planetId);
    const hasOrbiter = planet ? planet.orbiters.length > 0 : false;
    const energyCost = hasOrbiter 
      ? GAME_CONSTANTS.LAND_COST_ENERGY_WITH_ORBITER
      : GAME_CONSTANTS.LAND_COST_ENERGY;

    if (player.energy < energyCost) {
      return { 
        canLand: false, 
        reason: `Énergie insuffisante (nécessite ${energyCost})`,
        energyCost 
      };
    }

    return { canLand: true, energyCost };
  }

  /**
   * Fait atterrir une sonde
   */
  static landProbe(
    game: Game,
    playerId: string,
    probeId: string
  ): {
    updatedGame: Game;
    isFirstLander: boolean;
    planetId: string;
  } {
    const validation = this.canLand(game, playerId, probeId);
    if (!validation.canLand) {
      throw new Error(validation.reason || 'Atterrissage impossible');
    }

    const updatedGame = { ...game };
    const playerIndex = updatedGame.players.findIndex(p => p.id === playerId);
    const player = updatedGame.players[playerIndex];
    const probe = player.probes.find(p => p.id === probeId)!;
    const planetId = probe.planetId!;

    const planet = updatedGame.board.planets.find(p => p.id === planetId);
    const isFirstLander = planet ? planet.landers.length === 0 : true;

    // Mettre à jour la sonde
    const updatedProbe = {
      ...probe,
      state: ProbeState.LANDED,
      isLander: true
    };

    const updatedPlayer = {
      ...player,
      energy: player.energy - (validation.energyCost || 3),
      probes: player.probes.map(p => p.id === probeId ? updatedProbe : p)
    };

    // Retirer de la liste des orbiteurs
    if (planet) {
      planet.orbiters = planet.orbiters.filter(p => p.id !== probeId);
      planet.landers.push(updatedProbe);
    }

    // Bonus : données supplémentaires si premier atterrisseur
    // TODO: Implémenter le gain de données selon les règles exactes

    // Bonus planète (atterrissage)
    if (planet?.bonus) {
      if (planet.bonus.data) {
        // TODO: Ajouter les données à l'ordinateur du joueur
      }
      if (planet.bonus.pv) {
        updatedPlayer.score += planet.bonus.pv;
      }
    }

    updatedGame.players[playerIndex] = updatedPlayer;

    return {
      updatedGame,
      isFirstLander,
      planetId
    };
  }
}

