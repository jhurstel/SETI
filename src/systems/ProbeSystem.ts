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
  GAME_CONSTANTS,
  DiskName,
  SectorNumber,
  PlanetBonus
} from '../core/types';
import { 
  getObjectPosition, 
  createRotationState, 
  getVisibleLevel, 
  getCell, 
  rotateSector,
  RotationState 
} from '../core/SolarSystemPosition';

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
    const maxProbes = player.technologies.some(t => t.id.startsWith('exploration-1'))
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
    free: boolean = false
  ): {
    updatedGame: Game;
    probeId: string;
  } {
    const updatedGame = { ...game };
    updatedGame.players = [...game.players];
    const playerIndex = updatedGame.players.findIndex(p => p.id === playerId);
    const player = updatedGame.players[playerIndex];

    // Calculer la position réelle de la Terre
    // La Terre est sur le plateau niveau 3, en secteur 2 (A2) par rapport au plateau
    // Utiliser les angles de rotation actuels depuis le jeu
    let earthDisk: DiskName = 'A';
    let earthSector: SectorNumber = 2;
    let earthLevel: number = 1; // Terre sur le plateau 1 (Bleu)
    
    // Obtenir les angles de rotation actuels depuis le jeu
    const rotationAngle1 = updatedGame.board.solarSystem.rotationAngleLevel1 || 0;
    const rotationAngle2 = updatedGame.board.solarSystem.rotationAngleLevel2 || 0;
    const rotationAngle3 = updatedGame.board.solarSystem.rotationAngleLevel3 || 0;
    
    // Utiliser getObjectPosition pour calculer la position absolue avec les angles réels
    const earthPos = getObjectPosition('earth', rotationAngle1, rotationAngle2, rotationAngle3);
    if (earthPos) {
      earthDisk = earthPos.disk;
      earthSector = earthPos.sector;
    }

    const probe: Probe = {
      id: `probe_${Date.now()}_${playerId}`,
      ownerId: playerId,
      position: {
        x: 0,
        y: 0
      },
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
      credits: player.credits - (free ? 0 : GAME_CONSTANTS.PROBE_LAUNCH_COST),
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
    energyCost: number
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
   * Déplace une sonde
   */
  static moveProbe(
    game: Game,
    playerId: string,
    probeId: string,
    energyCost: number,
    targetDisk: DiskName,
    targetSector: SectorNumber
  ): Game {
    const validation = this.canMoveProbe(game, playerId, probeId, energyCost);
    if (!validation.canMove) {
      throw new Error(validation.reason || 'Déplacement impossible');
    }

    const updatedGame = { ...game };
    updatedGame.players = [...game.players];
    const playerIndex = updatedGame.players.findIndex(p => p.id === playerId);
    const player = updatedGame.players[playerIndex];
    const probeIndex = player.probes.findIndex(p => p.id === probeId);

    // Calculer le niveau cible en fonction de la rotation actuelle
    const rotationState = createRotationState(
      game.board.solarSystem.rotationAngleLevel1 || 0,
      game.board.solarSystem.rotationAngleLevel2 || 0,
      game.board.solarSystem.rotationAngleLevel3 || 0
    );
    const targetLevel = getVisibleLevel(targetDisk, targetSector, rotationState);

    // Convertir le secteur absolu en secteur relatif pour le stockage
    let relativeSector = targetSector;
    if (targetLevel === 3) {
      relativeSector = rotateSector(targetSector, -rotationState.level3Angle);
    } else if (targetLevel === 2) {
      relativeSector = rotateSector(targetSector, -rotationState.level2Angle);
    } else if (targetLevel === 1) {
      relativeSector = rotateSector(targetSector, -rotationState.level1Angle);
    }

    // Vérifier les bonus média
    const targetCell = getCell(targetDisk, targetSector, rotationState);
    let mediaBonus = 0;
    if (targetCell) {
      if (targetCell.hasComet) mediaBonus += 1;
      // La Terre ne donne pas de bonus de média
      if (targetCell.hasPlanet && targetCell.planetId !== 'earth') mediaBonus += 1;
      if (targetCell.hasAsteroid && player.technologies.some(t => t.id.startsWith('exploration-2'))) mediaBonus += 1;
    }
    
    // Débiter l'énergie et appliquer le bonus de média
    const updatedPlayer = {
      ...player,
      energy: player.energy - (validation.energyCost || 0),
      mediaCoverage: Math.min(player.mediaCoverage + mediaBonus, GAME_CONSTANTS.MAX_MEDIA_COVERAGE),
      probes: player.probes.map((p, idx) => {
        if (idx === probeIndex) {
          return {
            ...p,
            solarPosition: {
              disk: targetDisk,
              sector: relativeSector,
              level: targetLevel
            }
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
      systemProbe.solarPosition = {
        disk: targetDisk,
        sector: relativeSector,
        level: targetLevel
      };
    }
    // Note: La mise à jour des tiles (currentTile/targetTile) est omise car le système utilise maintenant solarPosition

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
        const planetPos = getObjectPosition(
          planetId,
          game.board.solarSystem.rotationAngleLevel1! || 0,
          game.board.solarSystem.rotationAngleLevel2! || 0,
          game.board.solarSystem.rotationAngleLevel3! || 0
        );
        if (planetPos && 
            planetPos.disk === probe.solarPosition.disk && 
            planetPos.sector === probe.solarPosition.sector) {

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
    updatedGame.players = [...game.players];
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
    updatedGame.players = [...game.players];
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

  /**
   * Met à jour les positions des sondes après une rotation du système solaire
   */
  static updateProbesAfterRotation(
    game: Game,
    oldRotationState: RotationState,
    newRotationState: RotationState
  ): { game: Game; logs: string[] } {
    const updatedGame = { ...game };
    const logs: string[] = [];

    // Déterminer la direction de la poussée
    // Si l'angle diminue (rotation anti-horaire), les secteurs avancent (1->2->3)
    let pushDirection = 0;
    if (newRotationState.level1Angle < oldRotationState.level1Angle ||
        newRotationState.level2Angle < oldRotationState.level2Angle ||
        newRotationState.level3Angle < oldRotationState.level3Angle) {
      pushDirection = 1;
    } else if (newRotationState.level1Angle > oldRotationState.level1Angle ||
               newRotationState.level2Angle > oldRotationState.level2Angle ||
               newRotationState.level3Angle > oldRotationState.level3Angle) {
      pushDirection = -1;
    }
    
    // Mettre à jour les sondes des joueurs
    updatedGame.players = updatedGame.players.map(player => {
      let playerMediaGain = 0;

      const updatedProbes = player.probes.map(probe => {
        if (probe.state !== ProbeState.IN_SOLAR_SYSTEM || !probe.solarPosition) {
          return probe;
        }
        
        const pos = probe.solarPosition;
        
        // Vérifier si la sonde tourne avec son plateau (riding)
        let isRiding = false;
        if (pos.level === 3 && oldRotationState.level3Angle !== newRotationState.level3Angle) isRiding = true;
        if (pos.level === 2 && oldRotationState.level2Angle !== newRotationState.level2Angle) isRiding = true;
        if (pos.level === 1 && oldRotationState.level1Angle !== newRotationState.level1Angle) isRiding = true;

        if (isRiding) {
          return this.recalculateProbePosition(probe, oldRotationState, newRotationState);
        } else {
          // La sonde ne tourne pas (ex: sur L0). Vérifier si elle est recouverte.
          let absoluteSector = pos.sector;
          if (pos.level === 1) absoluteSector = rotateSector(pos.sector, oldRotationState.level1Angle);
          else if (pos.level === 2) absoluteSector = rotateSector(pos.sector, oldRotationState.level2Angle);
          else if (pos.level === 3) absoluteSector = rotateSector(pos.sector, oldRotationState.level3Angle);
          
          const newVisibleLevel = getVisibleLevel(pos.disk, absoluteSector, newRotationState);
          
          // Si recouverte par un niveau supérieur qui a bougé -> Poussée
          // Note: La hiérarchie visuelle est Level 1 (Haut) > Level 2 > Level 3 > Level 0 (Bas/Fixe)
          // On est recouvert si le nouveau niveau visible est < au nôtre (ex: 1 couvre 2)
          // Ou si on est sur le niveau 0 et qu'un niveau > 0 nous couvre
          const currentLevel = pos.level || 0;
          const isCovered = newVisibleLevel !== 0 && (currentLevel === 0 || newVisibleLevel < currentLevel);

          if (isCovered && pushDirection !== 0) {
            const sectorIndex = (absoluteSector - 1 + pushDirection + 8) % 8;
            const newAbsoluteSector = (sectorIndex + 1) as SectorNumber;
            
            const levelAtNewPos = getVisibleLevel(pos.disk, newAbsoluteSector, newRotationState);
            
            let newRelativeSector = newAbsoluteSector;
            if (levelAtNewPos === 3) newRelativeSector = rotateSector(newAbsoluteSector, -newRotationState.level3Angle);
            else if (levelAtNewPos === 2) newRelativeSector = rotateSector(newAbsoluteSector, -newRotationState.level2Angle);
            else if (levelAtNewPos === 1) newRelativeSector = rotateSector(newAbsoluteSector, -newRotationState.level1Angle);
            
            // Vérifier gains média
            const cell = getCell(pos.disk, newAbsoluteSector, newRotationState);
            let mediaGain = 0;
            let objectName = "";
            if (cell) {
              if (cell.hasComet) { mediaGain++; objectName = "Comète"; }
              if (cell.hasPlanet && cell.planetId !== 'earth') { mediaGain++; objectName = cell.planetName || "Planète"; }
              if (cell.hasAsteroid && player.technologies.some(t => t.id.startsWith('exploration-2'))) { mediaGain++; objectName = "Astéroïdes"; }
            }

            if (mediaGain > 0) {
              playerMediaGain += mediaGain;
              logs.push(`Sonde de ${player.name} poussée vers ${pos.disk}${newAbsoluteSector} (${objectName}) : +${mediaGain} Média`);
            } else {
              logs.push(`Sonde de ${player.name} poussée vers ${pos.disk}${newAbsoluteSector}`);
            }

            return {
              ...probe,
              solarPosition: {
                disk: pos.disk,
                sector: newRelativeSector,
                level: levelAtNewPos
              }
            };
          }
          
          return this.recalculateProbePosition(probe, oldRotationState, newRotationState);
        }
      });

      if (playerMediaGain > 0) {
        return {
          ...player,
          mediaCoverage: Math.min(player.mediaCoverage + playerMediaGain, GAME_CONSTANTS.MAX_MEDIA_COVERAGE),
          probes: updatedProbes
        };
      }

      return { ...player, probes: updatedProbes };
    });

    // Mettre à jour les sondes du système solaire (copie de celles des joueurs)
    updatedGame.board = {
      ...updatedGame.board,
      solarSystem: {
        ...updatedGame.board.solarSystem,
        probes: updatedGame.players.flatMap(p => p.probes.filter(probe => probe.state === ProbeState.IN_SOLAR_SYSTEM))
      }
    };

    return { game: updatedGame, logs };
  }

  private static recalculateProbePosition(
    probe: Probe,
    oldRotationState: RotationState,
    newRotationState: RotationState
  ): Probe {
    const pos = probe.solarPosition!;
    let absoluteSector = pos.sector;

    // 1. Calculer la position absolue "attendue" après rotation
    // Si la sonde est sur un plateau qui tourne, elle bouge avec lui (isRiding = true)
    // Si elle est sur un plateau fixe (par rapport à la rotation), elle reste sur place (isRiding = false)
    
    let isRiding = false;
    if (pos.level === 3 && oldRotationState.level3Angle !== newRotationState.level3Angle) isRiding = true;
    if (pos.level === 2 && oldRotationState.level2Angle !== newRotationState.level2Angle) isRiding = true;
    if (pos.level === 1 && oldRotationState.level1Angle !== newRotationState.level1Angle) isRiding = true;

    if (isRiding) {
      // La sonde tourne avec le plateau : son secteur relatif reste le même, mais l'absolu change
      let angle = 0;
      if (pos.level === 3) angle = newRotationState.level3Angle;
      if (pos.level === 2) angle = newRotationState.level2Angle;
      if (pos.level === 1) angle = newRotationState.level1Angle;
      absoluteSector = rotateSector(pos.sector, angle);
    } else {
      // La sonde ne tourne pas avec le plateau : elle garde sa position absolue
      let angle = 0;
      if (pos.level === 1) angle = oldRotationState.level1Angle;
      if (pos.level === 2) angle = oldRotationState.level2Angle;
      if (pos.level === 3) angle = oldRotationState.level3Angle;
      
      if (pos.level !== 0) {
        absoluteSector = rotateSector(pos.sector, angle);
      } else {
        absoluteSector = pos.sector;
      }
    }

    // 2. Recalculer le niveau visible à cette position absolue (elle a peut-être été recouverte ou découverte)
    const newLevel = getVisibleLevel(pos.disk, absoluteSector, newRotationState);

    // 3. Recalculer le secteur relatif pour ce nouveau niveau
    let newRelativeSector = absoluteSector;
    if (newLevel === 3) {
      newRelativeSector = rotateSector(absoluteSector, -newRotationState.level3Angle);
    } else if (newLevel === 2) {
      newRelativeSector = rotateSector(absoluteSector, -newRotationState.level2Angle);
    } else if (newLevel === 1) {
      newRelativeSector = rotateSector(absoluteSector, -newRotationState.level1Angle);
    }

    return {
      ...probe,
      solarPosition: {
        ...pos,
        sector: newRelativeSector,
        level: newLevel
      }
    };
  }
}