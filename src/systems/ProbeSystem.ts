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
  Bonus
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
  static canLaunchProbe(game: Game, playerId: string, checkCost: boolean = true): {
    canLaunch: boolean;
    reason?: string;
  } {
    const player = game.players.find(p => p.id === playerId);
    if (!player) {
      return { canLaunch: false, reason: 'Joueur introuvable' };
    }

    // Vérifier les crédits
    if (checkCost && player.credits < GAME_CONSTANTS.PROBE_LAUNCH_COST) {
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
    const hasExploration1 = player.technologies.some(t => t.id.includes('exploration-1'));
    const maxProbes = hasExploration1
     ? (GAME_CONSTANTS.MAX_PROBES_PER_SYSTEM_WITH_TECHNOLOGY || 2)
     : (GAME_CONSTANTS.MAX_PROBES_PER_SYSTEM || 1);
    
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
    free: boolean = false,
    ignoreLimit: boolean = false
  ): {
    updatedGame: Game;
    probeId: string | null;
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

    // Vérifier la limite de sondes (même pour un lancement gratuit)
    if (!ignoreLimit) {
        const probesInSystem = player.probes.filter(p => p.state === ProbeState.IN_SOLAR_SYSTEM);
        const hasExploration1 = player.technologies.some(t => t.id.includes('exploration-1'));
        const maxProbes = hasExploration1 ? (GAME_CONSTANTS.MAX_PROBES_PER_SYSTEM_WITH_TECHNOLOGY || 2) : (GAME_CONSTANTS.MAX_PROBES_PER_SYSTEM || 1);

        if (probesInSystem.length >= maxProbes) {
            return { updatedGame: game, probeId: null };
        }
    }

    const probe: Probe = {
      id: `probe_${Date.now()}_${Math.floor(Math.random() * 10000)}_${playerId}`,
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
    const probe = player.probes[probeIndex];

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

    // Gestion des visites de planètes et bonus associés
    let scoreBonus = 0;
    let dataBonus = 0;
    let newVisitedPlanets = [...player.visitedPlanetsThisTurn];
    let newActiveBuffs = [...player.activeBuffs];

    if (targetCell && targetCell.hasPlanet && targetCell.planetId) {
        const planetId = targetCell.planetId;
        
        const isNewVisit = !newVisitedPlanets.includes(planetId);
        // Enregistrer la visite si pas déjà fait (pour les stats ou bonus "planètes uniques")
        if (isNewVisit) {
            newVisitedPlanets.push(planetId);
        }

        // Vérifier et appliquer les buffs actifs (ex: Survol de Mars)
        // On filtre pour ne garder que ceux qui n'ont pas encore été consommés pour cette planète
        const buffsToTrigger = newActiveBuffs.filter(buff => buff.type === 'VISIT_BONUS' && buff.target === planetId);
        
        buffsToTrigger.forEach(buff => {
            scoreBonus += buff.value;
        });

        // Retirer les buffs consommés (pour ne pas gagner 2x les points si on revient sur la planète)
        if (buffsToTrigger.length > 0) {
            newActiveBuffs = newActiveBuffs.filter(buff => !(buff.type === 'VISIT_BONUS' && buff.target === planetId));
        }

        // Appliquer les bonus de visite unique (ex: Voile Solaire)
        if (isNewVisit) {
            const uniqueBuffs = newActiveBuffs.filter(buff => buff.type === 'VISIT_UNIQUE');
            uniqueBuffs.forEach(buff => {
                scoreBonus += buff.value;
            });
        }
    }

    // Gestion des visites d'astéroïdes (ex: Survol d'Astéroïdes)
    if (targetCell && targetCell.hasAsteroid) {
        const asteroidBuffs = newActiveBuffs.filter(buff => buff.type === 'VISIT_ASTEROID');
        asteroidBuffs.forEach(buff => {
            dataBonus += buff.value;
        });
        if (asteroidBuffs.length > 0) {
            newActiveBuffs = newActiveBuffs.filter(buff => buff.type !== 'VISIT_ASTEROID');
        }
    }

    // Gestion des visites de comètes (ex: Rencontre avec une Comète)
    if (targetCell && targetCell.hasComet) {
        const cometBuffs = newActiveBuffs.filter(buff => buff.type === 'VISIT_COMET');
        cometBuffs.forEach(buff => {
            scoreBonus += buff.value;
        });
        if (cometBuffs.length > 0) {
            newActiveBuffs = newActiveBuffs.filter(buff => buff.type !== 'VISIT_COMET');
        }
    }

    // Gestion du déplacement sur le même disque (ex: Correction de Trajectoire)
    if (targetDisk === probe.solarPosition.disk) {
        const sameDiskBuffs = newActiveBuffs.filter(buff => buff.type === 'SAME_DISK_MOVE');
        sameDiskBuffs.forEach(buff => {
            if (buff.value.pv) scoreBonus += buff.value.pv;
            if (buff.value.media) mediaBonus += buff.value.media;
        });
        if (sameDiskBuffs.length > 0) {
            newActiveBuffs = newActiveBuffs.filter(buff => buff.type !== 'SAME_DISK_MOVE');
        }
    }
    
    // Débiter l'énergie et appliquer le bonus de média
    const updatedPlayer = {
      ...player,
      score: player.score + scoreBonus,
      data: Math.min(player.data + dataBonus, GAME_CONSTANTS.MAX_DATA),
      visitedPlanetsThisTurn: newVisitedPlanets, // Mettre à jour la liste
      activeBuffs: newActiveBuffs, // Mettre à jour la liste des buffs
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

    // Mettre à jour la position dans le système solaire (Immutabilité)
    const newSystemProbes = updatedGame.board.solarSystem.probes.map(p => {
      if (p.id === probeId) {
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
    });

    updatedGame.board = {
      ...updatedGame.board,
      solarSystem: {
        ...updatedGame.board.solarSystem,
        probes: newSystemProbes
      }
    };

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
  
  static applyBonus(updatedPlayer: Player, bonus: Bonus) {
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
      updatedPlayer.data = Math.min(
        updatedPlayer.data + (bonus.data || 0),
        GAME_CONSTANTS.MAX_DATA
      );
    }
    if (bonus.planetscan || bonus.redscan || bonus.bluescan || bonus.yellowscan || bonus.blackscan) {
      // Géré via intéraction utilisateur dans orbitProbe/landProbe côté UI
    }
    if (bonus.card || bonus.anycard) {
      // Géré via intéraction utilisateur dans orbitProbe/landProbe côté UI
    }
    if (bonus.yellowlifetrace || bonus.redlifetrace || bonus.bluelifetrace) {
      // Géré via intéraction utilisateur dans orbitProbe/landProbe côté UI
    }
    if (bonus.revenue) {
      // Géré via intéraction utilisateur dans orbitProbe/landProbe côté UI
    }
    if (bonus.anytechnology) {
      // Géré via intéraction utilisateur dans orbitProbe/landProbe côté UI
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
    probeId: string,
    planetId: string
  ): {
    updatedGame: Game;
    isFirstOrbiter: boolean;
    planetId: string;
    bonuses: Bonus;
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

    // Mettre à jour le plateau (Planètes et Système Solaire) de manière immuable
    updatedGame.board = {
      ...game.board,
      planets: game.board.planets.map(p => {
        if (p.id === planetId) {
          return {
            ...p,
            orbiters: [...p.orbiters, updatedProbe]
          };
        }
        return p;
      }),
      solarSystem: {
        ...game.board.solarSystem,
        probes: game.board.solarSystem.probes.filter(p => p.id !== probeId)
      }
    };

    // Récupérer la planète mise à jour pour les bonus
    const updatedPlanet = updatedGame.board.planets.find(p => p.id === planetId);

    const accumulatedBonuses: Bonus = {};
    const applyAndAccumulate = (bonus: Bonus) => {
        this.applyBonus(updatedPlayer, bonus);
        for (const key in bonus) {
            const k = key as keyof Bonus;
            if (typeof bonus[k] === 'number') {
                accumulatedBonuses[k] = (accumulatedBonuses[k] || 0) + (bonus[k] || 0);
            }
        }
    };

    // Bonus planète
    if (updatedPlanet && updatedPlanet.orbitSlots) {
      const index = updatedPlanet.orbiters.length - 1;
      const slotBonus = updatedPlanet.orbitSlots[index];
      if (slotBonus) applyAndAccumulate(slotBonus);
    }

    updatedGame.players[playerIndex] = updatedPlayer;

    return {
      updatedGame,
      isFirstOrbiter,
      planetId,
      bonuses: accumulatedBonuses
    };
  }

  /**
   * Vérifie si une sonde peut atterrir
   */
  static canLand(
    game: Game,
    playerId: string,
    probeId: string,
    checkCost: boolean = true
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
      return { canLand: false, reason: 'La sonde doit être dans le système solaire' };
    }

    // Vérifier que la sonde est sur une planète (pas Terre)
    const hasProbeOnPlanetInfo = this.probeOnPlanetInfo(game, playerId);
    if (!hasProbeOnPlanetInfo.hasProbe) {
      return { canLand: false, reason: 'La sonde doit être sur une planète autre que la Terre' };
    }

    // Vérifier l'énergie disponible
    if (checkCost && player.energy < hasProbeOnPlanetInfo.landCost!) {
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
    probeId: string,
    planetId: string,
    free: boolean = false,
    forcedSlotIndex?: number
  ): {
    updatedGame: Game;
    isFirstLander: boolean;
    isSecondLander: boolean;
    planetId: string;
    bonuses: Bonus;
  } {
    const validation = this.canLand(game, playerId, probeId, !free);
    if (!validation.canLand) {
      throw new Error(validation.reason || 'Atterrissage impossible');
    }

    const updatedGame = { ...game };
    updatedGame.players = [...game.players];
    const playerIndex = updatedGame.players.findIndex(p => p.id === playerId);
    const player = updatedGame.players[playerIndex];
    const probe = player.probes.find(p => p.id === probeId)!;

    // Identifier la cible (Planète ou Satellite)
    let targetBody: any = updatedGame.board.planets.find(p => p.id === planetId);
    if (!targetBody) {
        for (const p of updatedGame.board.planets) {
            if (p.satellites) {
                const sat = p.satellites.find(s => s.id === planetId);
                if (sat) {
                    targetBody = sat;
                    break;
                }
            }
        }
    }

    const isFirstLander = targetBody ? (targetBody.landers || []).length === 0 : true;
    const isSecondLander = targetBody ? (targetBody.landers || []).length === 1 : false;

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
      energy: player.energy - (free ? 0 : (validation.energyCost || GAME_CONSTANTS.LAND_COST_ENERGY)),
      probes: player.probes.map(p => p.id === probeId ? updatedProbe : p)
    };

    // Mettre à jour le plateau (Planètes et Système Solaire) de manière immuable
    updatedGame.board = {
      ...game.board,
      planets: game.board.planets.map(p => {
        if (p.id === planetId) {
          return {
            ...p,
            landers: [...p.landers, updatedProbe]
          };
        }
        if (p.satellites && p.satellites.some(s => s.id === planetId)) {
            return {
                ...p,
                satellites: p.satellites.map(s => {
                    if (s.id === planetId) {
                        return {
                            ...s,
                            landers: [...(s.landers || []), updatedProbe]
                        };
                    }
                    return s;
                })
            };
        }
        return p;
      }),
      solarSystem: {
        ...game.board.solarSystem,
        probes: game.board.solarSystem.probes.filter(p => p.id !== probeId)
      }
    };

    // Récupérer la planète mise à jour pour les bonus
    let updatedTargetBody: any = updatedGame.board.planets.find(p => p.id === planetId);
    if (!updatedTargetBody) {
         for (const p of updatedGame.board.planets) {
            if (p.satellites) {
                const sat = p.satellites.find(s => s.id === planetId);
                if (sat) {
                    updatedTargetBody = sat;
                    break;
                }
            }
        }
    }

    const accumulatedBonuses: Bonus = {};
    const applyAndAccumulate = (bonus: Bonus) => {
        this.applyBonus(updatedPlayer, bonus);
        for (const key in bonus) {
            const k = key as keyof Bonus;
            if (typeof bonus[k] === 'number') {
                accumulatedBonuses[k] = (accumulatedBonuses[k] || 0) + (bonus[k] || 0);
            }
        }
    };

    // Bonus planète (atterrissage)
    if (updatedTargetBody) {
        if (updatedTargetBody.landSlots) {
            const index = forcedSlotIndex !== undefined ? forcedSlotIndex : updatedTargetBody.landers.length - 1;
            const slotBonus = updatedTargetBody.landSlots[index];
            if (slotBonus) applyAndAccumulate(slotBonus);
        } else if (updatedTargetBody.landBonus) {
            applyAndAccumulate(updatedTargetBody.landBonus);
        }
    }

    updatedGame.players[playerIndex] = updatedPlayer;

    return {
      updatedGame,
      isFirstLander,
      isSecondLander,
      planetId,
      bonuses: accumulatedBonuses
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