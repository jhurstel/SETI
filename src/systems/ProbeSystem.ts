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
  TileType,
  GAME_CONSTANTS,
  DiskName,
  SectorNumber,
  PlanetBonus
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

    // Vérifier les technologies qui permettent plusieurs sondes
    const maxProbes = player.technologies.some(t => t.id === 'exploration-1')
     ? GAME_CONSTANTS.MAX_PROBES_PER_SYSTEM_WITH_TECHNOLOGY
     : GAME_CONSTANTS.MAX_PROBES_PER_SYSTEM;
    
    if (probesInSystem.length >= maxProbes) {
      return { 
        canLaunch: false, 
        reason: `Limite de sondes atteinte (max ${maxProbes} dans le système solaire)` 
      };
    }

    return { canLaunch: true };
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
    let earthLevel: number = 3;
    
    if (!earthPosition) {
      // Obtenir les angles de rotation actuels depuis le jeu
      const rotationAngle1 = updatedGame.board.solarSystem.rotationAngleLevel1 || 0;
      const rotationAngle2 = updatedGame.board.solarSystem.rotationAngleLevel2 || 0;
      const rotationAngle3 = updatedGame.board.solarSystem.rotationAngleLevel3 || 0;
      
      // Utiliser getObjectPosition pour calculer la position absolue avec les angles réels
      const rotationState = createRotationState(-rotationAngle1, -rotationAngle2, -rotationAngle3);
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
      solarPosition: {
        disk: earthDisk,
        sector: earthSector,
        level: earthLevel,
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
    if (!this.isAdjacent(probe.position!, targetPosition)) {
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
    const currentTile = BoardManager.findTileByPosition(game.board, probe.position!);
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
      player.probes[probeIndex].position!
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
   * Vérifie si le joueur a une sonde sur une planète autre que la Terre et obtenir les infos de la planète
   */
  static probeOnPlanetInfo(
    game: Game,
    playerId: string
  ): {
    hasProbe: boolean;
    planetId?: string | null;
    hasOrbiter?: boolean;
    hasExploration3?: boolean;
    landCost?: number;
  } {
    const playerProbes = game.board.solarSystem.probes.filter(
      probe => probe.ownerId === playerId && probe.solarPosition
    );

    // Liste des planètes (sans la Terre)
    const planets = ['venus', 'mercury', 'mars', 'jupiter', 'saturn', 'uranus', 'neptune'];
    
    for (const probe of playerProbes) {
      if (!probe.solarPosition) continue;
      
      // Vérifier si la sonde est sur une planète
      for (const planetId of planets) {
        const rotationState = createRotationState(
          -game.board.solarSystem.rotationAngleLevel1! || 0,
          -game.board.solarSystem.rotationAngleLevel2! || 0,
          -game.board.solarSystem.rotationAngleLevel3! || 0
        );  
        const planetPos = getObjectPosition(planetId, rotationState);
        if (planetPos && 
            planetPos.disk === probe.solarPosition.disk && 
            planetPos.absoluteSector === probe.solarPosition.sector) {

          // Trouver la planète dans le jeu pour vérifier les orbiteurs et le cout (reduit ou non)
          const planet = game.board.planets.find(p => p.id === planetId);
          const hasOrbiter = planet && planet.orbiters.length > 0 ? true : false;
          const hasExploration3 = game.players.find(p => p.id === playerId)?.technologies.some(t => t.id === 'exploration-3') || false;
          const landCost = hasExploration3
            ? (hasOrbiter ? GAME_CONSTANTS.LAND_COST_ENERGY_WITH_TECHNOLOGY_AND_ORBITER : GAME_CONSTANTS.LAND_COST_ENERGY_WITH_TECHNOLOGY)
            : (hasOrbiter ? GAME_CONSTANTS.LAND_COST_ENERGY_WITH_ORBITER : GAME_CONSTANTS.LAND_COST_ENERGY);

          return { hasProbe: true, planetId, hasOrbiter, hasExploration3, landCost };
        }
      }
    }
    
    return { hasProbe: false };
  }
  
  static applyBonus(updatedPlayer: Player, bonus: PlanetBonus) {
    if (bonus.pv) {
      updatedPlayer.score += bonus.pv || 0;
    }
    if (bonus.credits) {
      updatedPlayer.credits += bonus.credits || 0;
    }
    if (bonus.energy) {
      updatedPlayer.energy += bonus.energy || 0;
    }
    if (bonus.media) {
      updatedPlayer.mediaCoverage = Math.min(
        updatedPlayer.mediaCoverage + (bonus.media || 0),
        GAME_CONSTANTS.MAX_MEDIA_COVERAGE
      );
    }
    if (bonus.data) {
      // TODO: Ajouter les données à l'ordinateur du joueur
      //updatedPlayer.dataComputer.topRow.push({ id: `data_${Date.now()}_${playerId}`, type: 'data' });
    }
    if (bonus.planetscan) {
      // TODO: Ajouter les scans rouges à la main du joueur
      //updatedPlayer.redscan += bonus.redscan;
    }
    if (bonus.redscan) {
      // TODO: Ajouter les scans rouges à la main du joueur
      //updatedPlayer.redscan += bonus.redscan;
    }
    if (bonus.bluescan) {
      // TODO: Ajouter les scans bleus à la main du joueur
      //updatedPlayer.bluescan += bonus.bluescan;
    }
    if (bonus.yellowscan) {
      // TODO: Ajouter les scans jaunes à la main du joueur
      //updatedPlayer.yellowscan += bonus.yellowscan;
    }
    if (bonus.card) {
      // TODO: Ajouter les cartes à la main du joueur
      //updatedPlayer.cards.push({ id: `card_${Date.now()}_${playerId}`, type: 'card' });
    }
    if (bonus.anycard) {
      // TODO: Ajouter les cartes à la main du joueur
      //updatedPlayer.cards.push({ id: `card_${Date.now()}_${playerId}`, type: 'card' });
    }
    if (bonus.yellowlifetrace) {
      // TODO: Ajouter les traces jaunes à la main du joueur
      //updatedPlayer.lifetrace += bonus.yellowlifetrace;
    }
    if (bonus.redlifetrace) {
      // TODO: Ajouter les traces rouges à la main du joueur
      //updatedPlayer.lifetrace += bonus.redlifetrace;
    }
    if (bonus.bluelifetrace) {
      // TODO: Ajouter les traces bleues à la main du joueur
      //updatedPlayer.lifetrace += bonus.bluelifetrace;
    }
    if (bonus.revenue) {
      // TODO: Ajouter les revenus au score du joueur
      //updatedPlayer.score += bonus.revenue;
    }
    if (bonus.anytechnology) {
      // TODO: Ajouter les technologies à la main du joueur
      //updatedPlayer.technologies.push({ id: `technology_${Date.now()}_${playerId}`, type: 'technology' });
    }
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
    const hasProbeOnPlanetInfo = this.probeOnPlanetInfo(game, playerId);
    if (!hasProbeOnPlanetInfo.hasProbe) {
      return { canOrbit: false, reason: 'La sonde doit être sur une planète autre que la Terre' };
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
    const planetId = probe.planetId!;

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

    // Mettre à jour le joueur
    const updatedPlayer = {
      ...player,
      credits: player.credits - GAME_CONSTANTS.ORBIT_COST_CREDITS,
      energy: player.energy - GAME_CONSTANTS.ORBIT_COST_ENERGY,
      probes: player.probes.map(p => p.id === probeId ? updatedProbe : p)
    };

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

    // Bonus planète
    if (isFirstOrbiter && planet?.orbitFirstBonus) {
      this.applyBonus(updatedPlayer, planet.orbitFirstBonus);
    }
    if (planet?.orbitNextBonuses) {
      planet.orbitNextBonuses.forEach(bonus => this.applyBonus(updatedPlayer, bonus));
    }

    updatedGame.players[playerIndex] = updatedPlayer;

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
    reason: string;
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

    if (probe.state !== ProbeState.IN_SOLAR_SYSTEM) {
      return { canLand: false, reason: 'La sonde doit dans le systeme solaire' };
    }

    // Vérifier que la sonde est sur une planète (pas Terre)
    const hasProbeOnPlanetInfo = this.probeOnPlanetInfo(game, playerId);
    if (!hasProbeOnPlanetInfo.hasProbe) {
      return { canLand: false, reason: 'La sonde doit être sur une planète autre que la Terre' };
    }

    // Vérifier l'énergie disponible
    if (player.energy < hasProbeOnPlanetInfo.landCost!) {
      return { 
        canLand: false, 
        reason: `Énergie insuffisante (nécessite ${hasProbeOnPlanetInfo.landCost})`,
      };
    }

    return { canLand: true, reason: 'Atterrissage possible', energyCost: hasProbeOnPlanetInfo.landCost! };
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
    isSecondLander: boolean;
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
    const isSecondLander = planet ? planet.landers.length === 1 : false;

    // Mettre à jour la sonde
    const updatedProbe = {
      ...probe,
      state: ProbeState.LANDED,
      planetId,
      isLander: true
    };

    // Mettre à jour le joueur
    const updatedPlayer = {
      ...player,
      energy: player.energy - (validation.energyCost || GAME_CONSTANTS.LAND_COST_ENERGY),
      probes: player.probes.map(p => p.id === probeId ? updatedProbe : p)
    };

    // Ajouter à la planete
    if (planet) {
      planet.landers.push(updatedProbe);
    }

    // Retirer du système solaire en préservant tous les champs (y compris les angles de rotation)
    updatedGame.board = {
      ...updatedGame.board,
      solarSystem: {
        ...updatedGame.board.solarSystem,
        probes: updatedGame.board.solarSystem.probes.filter(p => p.id !== probeId)
      }
    };

    // Bonus planète (atterrissage)
    if (isFirstLander && planet?.landFirstBonus) {
      this.applyBonus(updatedPlayer, planet.landFirstBonus);
    }
    if (isSecondLander && planet?.landSecondBonus) {
      this.applyBonus(updatedPlayer, planet.landSecondBonus);
    }
    if (planet?.landNextBonuses) {
      planet.landNextBonuses.forEach(bonus => this.applyBonus(updatedPlayer, bonus));
    }

    updatedGame.players[playerIndex] = updatedPlayer;

    return {
      updatedGame,
      isFirstLander,
      isSecondLander,
      planetId
    };
  }
}

