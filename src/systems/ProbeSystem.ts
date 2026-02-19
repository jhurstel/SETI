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

import { Game, Probe, ProbeState, Planet, Satellite, Bonus, GAME_CONSTANTS, DiskName, SectorNumber, HistoryEntry, AlienBoardType } from '../core/types';
import { getObjectPosition, createRotationState, getVisibleLevel, getCell, rotateSector, RotationState, getAbsoluteSectorForProbe } from '../core/SolarSystemPosition';
import { ResourceSystem } from './ResourceSystem';
import { CardSystem } from './CardSystem';

export class ProbeSystem {
  /**
   * Vérifie si un joueur peut lancer une sonde
   */
  static canLaunchProbe(game: Game, playerId: string, checkCost: boolean = true, ignoreLimit: boolean = false): {
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
    
    if (!ignoreLimit && probesInSystem.length >= maxProbes) {
      return { 
        canLaunch: false, 
        reason: `Limite de sondes atteinte (max ${maxProbes} dans le système solaire)` 
      };
    }

    return { canLaunch: true };
  }

  /**
   * Lance une sonde (place sur Terre) pour un joueur donné. Tient compte si action bonus (gratuit) et si limit ignorée.
   */
  static launchProbe(
    game: Game, 
    playerId: string,
    free: boolean = false,
    ignoreLimit: boolean = false
  ): {
    updatedGame: Game;
    probeId: string | null;
    historyEntries: HistoryEntry[];
  } {
    const updatedGame = structuredClone(game);
    const solarSystem = updatedGame.board.solarSystem;
    const player = updatedGame.players.find(p => p.id === playerId)!;
    let historyEntries = []
    let message = '';

    // Calculer la position réelle absolue de la Terre
    let earthDisk: DiskName;
    let earthSector: SectorNumber;
    const earthPos = getObjectPosition('earth', solarSystem.rotationAngleLevel1, solarSystem.rotationAngleLevel2, solarSystem.rotationAngleLevel3, solarSystem.extraCelestialObjects);
    if (earthPos) {
      earthDisk = earthPos.disk;
      earthSector = earthPos.sector;
    } else {
      historyEntries.push({ message: `Terre non trouvée dans le système solaire`, playerId: player.id, sequenceId: ''});
      return { updatedGame: game, probeId: null, historyEntries };
    }

    // Vérifier la limite de sondes (même pour un lancement gratuit)
    if (!ignoreLimit) {
        const probesInSystem = player.probes.filter(p => p.state === ProbeState.IN_SOLAR_SYSTEM);
        const hasExploration1 = player.technologies.some(t => t.id.includes('exploration-1'));
        const maxProbes = hasExploration1 ? (GAME_CONSTANTS.MAX_PROBES_PER_SYSTEM_WITH_TECHNOLOGY || 2) : (GAME_CONSTANTS.MAX_PROBES_PER_SYSTEM || 1);

        if (probesInSystem.length >= maxProbes) {
            const message = `Limite de sondes atteinte (max ${maxProbes}) dans le système solaire)`;
            historyEntries.push({ message, playerId: player.id, sequenceId: ''});
            return { updatedGame: game, probeId: null, historyEntries };
        }
    }

    // Instancier la nouvelle sonde
    const probe: Probe = {
      id: `probe_${Date.now()}_${Math.floor(Math.random() * 10000)}_${playerId}`,
      ownerId: playerId,
      position: { x: 0, y: 0 },
      solarPosition: { disk: earthDisk, sector: earthSector, level: 3 },
      state: ProbeState.IN_SOLAR_SYSTEM,
      isOrbiter: false,
      isLander: false
    };
    player.probes.push(probe);

    // Payer les crédits
    if (!free) {
      player.credits -= GAME_CONSTANTS.PROBE_LAUNCH_COST;
      message = `paye ${ResourceSystem.formatResource(GAME_CONSTANTS.PROBE_LAUNCH_COST, 'CREDIT')} pour <strong>Lancer une sonde</strong> depuis la Terre`;
    } else {
      message = `lance 1 sonde depuis la Terre`;
    }
    historyEntries.push({ message, playerId: player.id, sequenceId: ''});

    // Traitement des buffs permanents
    const processedSources = new Set<string>();
    player.permanentBuffs.forEach(buff => {
      if (buff.type === 'GAIN_ON_LAUNCH') {
           // Ignorer si le prérequis est déjà complété
           if (buff.id && buff.source) {
               const mission = player.missions.find(m => m.name === buff.source);
               if (mission && mission.completedRequirementIds.includes(buff.id)) return;
               if (mission && mission.fulfillableRequirementIds?.includes(buff.id)) return;
           }

           if (buff.source && processedSources.has(buff.source)) return;
           
           // Les bonus seront traités par processBonuses appelé par l'action ou l'UI
           if (buff.source) processedSources.add(buff.source);
           
           // Marquer comme remplie (en attente de clic)
           CardSystem.markMissionRequirementFulfillable(player, buff);
      }
    });

    // Ajouter la sonde au système solaire en préservant tous les champs (y compris les angles de rotation)
    updatedGame.board.solarSystem.probes.push(probe);

    return {
      updatedGame,
      probeId: probe.id,
      historyEntries
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
   * Calcule le coût du déplacement pour une sonde donnée (1 ou 2 si astéroïde)
   */
  static getMovementCost(game: Game, playerId: string, probeId: string): number {
    const player = game.players.find(p => p.id === playerId);
    const probe = player?.probes.find(p => p.id === probeId);
    
    if (!player || !probe || !probe.solarPosition) return 1;

    const rotationState = createRotationState(
      game.board.solarSystem.rotationAngleLevel1 || 0,
      game.board.solarSystem.rotationAngleLevel2 || 0,
      game.board.solarSystem.rotationAngleLevel3 || 0
    );

    const absoluteSector = getAbsoluteSectorForProbe(probe.solarPosition, rotationState); // getAbsoluteSectorForProbe doesn't use extraObjects
    const currentCell = getCell(probe.solarPosition.disk, absoluteSector, rotationState, game.board.solarSystem.extraCelestialObjects);
    
    let stepCost = 1;
    
    if (currentCell?.hasAsteroid) {
      const hasExploration2 = player.technologies.some(t => t.id.startsWith('exploration-2'));
      const hasAsteroidBuff = player.activeBuffs.some(b => b.type === 'ASTEROID_EXIT_COST');
      if (!hasExploration2 && !hasAsteroidBuff) {
        stepCost += 1;
      }
    }
    
    return stepCost;
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
  ): { updatedGame: Game, message: string } {
    const validation = this.canMoveProbe(game, playerId, probeId, energyCost);
    if (!validation.canMove) {
      throw new Error(validation.reason || 'Déplacement impossible');
    }

    let updatedGame = structuredClone(game);
    let player = updatedGame.players.find(p => p.id === playerId)!;
    const probe = player.probes.find(p => p.id === probeId)!;
    const energySpent = validation.energyCost || 0;

    // Débiter l'énergie
    player.energy = Math.max(0, player.energy - energySpent);

    // Calculer le niveau cible en fonction de la rotation actuelle
    const rotationState = createRotationState(
      game.board.solarSystem.rotationAngleLevel1 || 0,
      game.board.solarSystem.rotationAngleLevel2 || 0,
      game.board.solarSystem.rotationAngleLevel3 || 0
    );
    const targetLevel = getVisibleLevel(targetDisk, targetSector, rotationState, updatedGame.board.solarSystem.extraCelestialObjects);

    // Convertir le secteur absolu en secteur relatif pour le stockage
    let relativeSector = targetSector;
    if (targetLevel === 3) {
      relativeSector = rotateSector(targetSector, -rotationState.level3Angle);
    } else if (targetLevel === 2) {
      relativeSector = rotateSector(targetSector, -rotationState.level2Angle);
    } else if (targetLevel === 1) {
      relativeSector = rotateSector(targetSector, -rotationState.level1Angle);
    }
    const targetCell = getCell(targetDisk, targetSector, rotationState, updatedGame.board.solarSystem.extraCelestialObjects);

    // Mettre à jour la position de la sonde
    probe.solarPosition = { disk: targetDisk, sector: relativeSector, level: targetLevel };

    // Vérifier les bonus média
    const bonus: Bonus = { media: 0, data: 0, pv: 0, credits: 0, energy: 0 };
    if (targetCell) {
      if (targetCell.hasComet) bonus.media = (bonus.media || 0) + 1;
      // La Terre ne donne pas de bonus de média
      if (targetCell.hasPlanet && targetCell.planetId !== 'earth') bonus.media = (bonus.media || 0) + 1;
      if (targetCell.hasAsteroid && player.technologies.some(t => t.id.startsWith('exploration-2'))) bonus.media = (bonus.media || 0) + 1;
    }

    // Gestion Card 19 (Assistance Gravitationnelle)
    const hasChoiceBuff = player.activeBuffs.some(b => b.type === 'CHOICE_MEDIA_OR_MOVE');
    if (hasChoiceBuff && targetCell?.hasPlanet && targetCell.planetId !== 'earth') {
        // On retire le bonus de média lié à la planète pour laisser le choix au joueur via l'UI
        if (bonus.media && bonus.media > 0) {
          bonus.media = (bonus.media || 0) - 1;
        }
    }

    // Construction du message
    let message = "";
    const objectName = targetCell?.hasComet ? "Visite de Comète" : targetCell?.hasAsteroid ? "Visite d'Astéroïdes" : targetCell?.hasPlanet ? `Visite de ${targetCell?.planetName}` : "une case vide";
    
    if (energySpent > 0) {
        message = `paye ${energySpent} énergie pour déplacer une sonde`;
    } else {
        message = `déplace une sonde gratuitement`;
    }

    // Gestion des visites de planètes et bonus associés
    if (targetCell && targetCell.hasPlanet && targetCell.planetId) {
        const planetId = targetCell.planetId;
        
        const isNewVisit = !player.visitedPlanetsThisTurn.includes(planetId);
        // Enregistrer la visite si pas déjà fait (pour les stats ou bonus "planètes uniques")
        if (isNewVisit) {
          player.visitedPlanetsThisTurn.push(planetId);
        }

        // Vérifier et appliquer les buffs actifs (ex: Survol de Mars)
        // On filtre pour ne garder que ceux qui n'ont pas encore été consommés pour cette planète
        const buffsToTrigger = player.activeBuffs.filter(buff => buff.type === 'VISIT_BONUS' && buff.target === planetId);
        
        buffsToTrigger.forEach(buff => {
            bonus.pv += buff.value;
            message += ` et gagne ${ResourceSystem.formatResource(buff.value, 'PV')} ("${buff.source}")`;
        });

        // Retirer les buffs consommés (pour ne pas gagner 2x les points si on revient sur la planète)
        if (buffsToTrigger.length > 0) {
            player.activeBuffs = player.activeBuffs.filter(buff => !(buff.type === 'VISIT_BONUS' && buff.target === planetId));
        }

        // Appliquer les bonus de visite unique (ex: Voile Solaire)
        if (isNewVisit) {
            const uniqueBuffs = player.activeBuffs.filter(buff => buff.type === 'VISIT_UNIQUE');
            uniqueBuffs.forEach(buff => {
                bonus.pv += buff.value;
                message += ` et gagne ${ResourceSystem.formatResource(buff.value, 'PV')} ("${buff.source}")`;
            });
        }
    }

    // Gestion des visites d'astéroïdes (ex: Survol d'Astéroïdes)
    if (targetCell && targetCell.hasAsteroid) {
        const asteroidBuffs = player.activeBuffs.filter(buff => buff.type === 'VISIT_ASTEROID');
        asteroidBuffs.forEach(buff => {
            bonus.data += buff.value;
            message += ` et gagne ${ResourceSystem.formatResource(buff.value, 'DATA')} ("${buff.source}")`;
        });
        if (asteroidBuffs.length > 0) {
            player.activeBuffs = player.activeBuffs.filter(buff => buff.type !== 'VISIT_ASTEROID');
        }
    }

    // Gestion des visites de comètes (ex: Rencontre avec une Comète)
    if (targetCell && targetCell.hasComet) {
        const cometBuffs = player.activeBuffs.filter(buff => buff.type === 'VISIT_COMET');
        cometBuffs.forEach(buff => {
            bonus.pv += buff.value;
            message += ` et gagne ${ResourceSystem.formatResource(buff.value, 'PV')} ("${buff.source}")`;
        });
        if (cometBuffs.length > 0) {
            player.activeBuffs = player.activeBuffs.filter(buff => buff.type !== 'VISIT_COMET');
        }
    }

    // Gestion du déplacement sur le même disque (ex: Correction de Trajectoire)
    if (targetDisk === probe.solarPosition.disk) {
        const sameDiskBuffs = player.activeBuffs.filter(buff => buff.type === 'SAME_DISK_MOVE');
        sameDiskBuffs.forEach(buff => {
            if (buff.value.pv) bonus.pv += buff.value.pv;
            if (buff.value.media) bonus.media += buff.value.media; // Note: mediaBonus is applied to player.mediaCoverage later
            
            const gains: string[] = [];
            if (buff.value.pv) gains.push(ResourceSystem.formatResource(buff.value.pv, 'PV'));
            if (buff.value.media) gains.push(ResourceSystem.formatResource(buff.value.media, 'MEDIA'));
            message += ` et gagne ${gains.join(', ')} ("${buff.source}")`;
        });
        if (sameDiskBuffs.length > 0) {
            player.activeBuffs = player.activeBuffs.filter(buff => buff.type !== 'SAME_DISK_MOVE');
        }
    }

    if (bonus.media && bonus.media > 0) {
      message += ` et gagne ${bonus.media} média (${objectName})`;
    }
        
    // Traitement des missions conditionnelles (GAIN_ON_VISIT_xxx)
    if (targetCell) {
        const processedSources = new Set<string>();
        player.permanentBuffs.forEach(buff => {
            let shouldTrigger = false;
            
            // Planètes
            if (targetCell.hasPlanet && targetCell.planetId) {
                if (buff.type === `GAIN_ON_VISIT_${targetCell.planetId.toUpperCase()}`) {
                    shouldTrigger = true;
                }
                if (buff.type === 'GAIN_ON_VISIT_PLANET' && targetCell.planetId !== 'earth') {
                    shouldTrigger = true;
                }
            }
            
            // Astéroïdes
            if (targetCell.hasAsteroid && buff.type === 'GAIN_ON_VISIT_ASTEROID') {
                shouldTrigger = true;
            }

            if (shouldTrigger) {
                // Ignorer si le prérequis est déjà complété
                if (buff.id && buff.source) {
                    const mission = player.missions.find(m => m.name === buff.source);
                    if (mission && mission.completedRequirementIds.includes(buff.id)) return;
                    if (mission && mission.fulfillableRequirementIds?.includes(buff.id)) return;
                }

                if (buff.source && processedSources.has(buff.source)) return;

                if (buff.source) processedSources.add(buff.source);

                // Marquer comme remplie (en attente de clic)
                CardSystem.markMissionRequirementFulfillable(player, buff);
            }
        });
    }

    // Mettre à jour la position dans le système solaire (Immutabilité)
    const systemProbe = updatedGame.board.solarSystem.probes.find(p => p.id === probeId);
    if (systemProbe) {
        systemProbe.solarPosition = {
            disk: targetDisk,
            sector: relativeSector,
            level: targetLevel
        };
    }

    // Appliquer les bonus via ResourceSystem
    const res = ResourceSystem.processBonuses(bonus, updatedGame, playerId, 'move', '');
    updatedGame = res.updatedGame;

    return { updatedGame, message: message }; //+ (res.logs.length > 0 ? ` et ${res.logs.join(', ')}` : '') };
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
    const planets = ['venus', 'mercury', 'mars', 'jupiter', 'saturn', 'uranus', 'neptune', 'oumuamua'];
    
    // Créer l'état de rotation pour calculer les positions absolues
    const rotationState = createRotationState(
        game.board.solarSystem.rotationAngleLevel1 || 0,
        game.board.solarSystem.rotationAngleLevel2 || 0,
        game.board.solarSystem.rotationAngleLevel3 || 0
    );

    for (const probe of playerProbes) {
      if (!probe.solarPosition) continue;
      
      // Calculer le secteur absolu de la sonde
      const probeAbsoluteSector = getAbsoluteSectorForProbe(probe.solarPosition, rotationState);

      // Vérifier si la sonde est sur une planète
      for (const planetId of planets) {
        const planetPos = getObjectPosition(
          planetId,
          rotationState.level1Angle,
          rotationState.level2Angle,
          rotationState.level3Angle,
          game.board.solarSystem.extraCelestialObjects
        );
        
        // Comparer les positions absolues
        if (planetPos && 
            planetPos.disk === probe.solarPosition.disk && 
            planetPos.absoluteSector === probeAbsoluteSector) {

          // Trouver la planète dans le jeu pour vérifier les orbiteurs et le cout (reduit ou non)
          let planet = game.board.planets.find(p => p.id === planetId);
          if (!planet && planetId === 'oumuamua') {
              const species = game.species.find(s => s.name === AlienBoardType.OUMUAMUA);
              if (species) planet = species.planet;
          }
          const hasOrbiter = planet && planet.orbiters.length > 0 ? true : false;
          const hasExploration3 = game.players.find(p => p.id === playerId)?.technologies.some(t => t.id.startsWith('exploration-3')) || false;
          const landCost = hasExploration3
            ? (hasOrbiter ? GAME_CONSTANTS.LAND_COST_ENERGY_WITH_TECHNOLOGY_AND_ORBITER : GAME_CONSTANTS.LAND_COST_ENERGY_WITH_TECHNOLOGY)
            : (hasOrbiter ? GAME_CONSTANTS.LAND_COST_ENERGY_WITH_ORBITER : GAME_CONSTANTS.LAND_COST_ENERGY);

          return { hasProbe: true, planetId, hasOrbiter, hasExploration3, landCost };
        }
      }
    }
    return { hasProbe: false };
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
    completedMissions: string[];
  } {
    const validation = this.canOrbit(game, playerId, probeId);
    if (!validation.canOrbit) {
      throw new Error(validation.reason || 'Mise en orbite impossible');
    }

    const updatedGame = structuredClone(game);
    const player = updatedGame.players.find(p => p.id === playerId)!;
    const probe = player.probes.find(p => p.id === probeId)!;

    // Vérifier si c'est le premier orbiteur
    let planet = updatedGame.board.planets.find(p => p.id === planetId);
    if (!planet && planetId === 'oumuamua') {
        const species = updatedGame.species.find(s => s.name === AlienBoardType.OUMUAMUA);
        if (species) planet = species.planet;
    }
    const isFirstOrbiter = planet ? planet.orbiters.length === 0 : true;

    // Payer le coût
    player.credits -= GAME_CONSTANTS.ORBIT_COST_CREDITS;
    player.energy -= GAME_CONSTANTS.ORBIT_COST_ENERGY;

    // Mettre à jour la sonde
    probe.state = ProbeState.IN_ORBIT;
    probe.planetId = planetId;
    probe.isOrbiter = true;

    // Ajouter la sonde aux orbiteurs de la planète
    if (planet) {
      planet.orbiters.push(probe);
    }

    // Retirer la sonde de la liste globale du système solaire
    // La sonde reste dans la liste du joueur, mais avec un état différent.
    updatedGame.board.solarSystem.probes = updatedGame.board.solarSystem.probes.filter(p => p.id !== probeId);

    // Récupérer la planète mise à jour pour les bonus
    const updatedPlanet = planet;

    const accumulatedBonuses: Bonus = {};
    const completedMissions: string[] = [];
    // Bonus planète
    if (updatedPlanet && updatedPlanet.orbitSlots) {
      const index = updatedPlanet.orbiters.length - 1;
      const slotBonus = updatedPlanet.orbitSlots[index];
      if (slotBonus) ResourceSystem.accumulateBonus(slotBonus, accumulatedBonuses);
    }

    // Traitement des buffs permanents
    const processedSources = new Set<string>();
    player.permanentBuffs.forEach(buff => {
      if (buff.type === 'GAIN_ON_ORBIT' || buff.type === 'GAIN_ON_ORBIT_OR_LAND') {
            // Ignorer si le prérequis est déjà complété
            if (buff.id && buff.source) {
                const mission = player.missions.find(m => m.name === buff.source);
                if (mission && mission.completedRequirementIds.includes(buff.id)) return;
                if (mission && mission.fulfillableRequirementIds?.includes(buff.id)) return;
            }

            if (buff.source && processedSources.has(buff.source)) return;

            if (buff.source) processedSources.add(buff.source);

            // Marquer comme remplie (en attente de clic)
            CardSystem.markMissionRequirementFulfillable(player, buff);
      }
    });

    return {
      updatedGame,
      isFirstOrbiter,
      planetId,
      bonuses: accumulatedBonuses,
      completedMissions
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
    completedMissions: string[];
  } {
    const validation = this.canLand(game, playerId, probeId, !free);
    if (!validation.canLand) {
      throw new Error(validation.reason || 'Atterrissage impossible');
    }

    const updatedGame = structuredClone(game);
    const player = updatedGame.players.find(p => p.id === playerId)!;
    const probe = player.probes.find(p => p.id === probeId)!;

    // Payer le coût
    player.energy = Math.max(0, player.energy - (free ? 0 : (validation.energyCost || GAME_CONSTANTS.LAND_COST_ENERGY)));

    // Identifier la cible (Planète ou Satellite)
    let targetBody: any = updatedGame.board.planets.find(p => p.id === planetId);
    if (!targetBody && planetId === 'oumuamua') {
        const species = updatedGame.species.find(s => s.name === AlienBoardType.OUMUAMUA);
        if (species) targetBody = species.planet;
    }
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
    probe.state = ProbeState.LANDED;
    probe.planetId = planetId;
    probe.isLander = true;
    
    let slotIndex = forcedSlotIndex;
    if (slotIndex === undefined) {
        const occupiedIndices = new Set((targetBody.landers || []).map((p: Probe) => p.planetSlotIndex));
        let k = 0;
        while (occupiedIndices.has(k)) k++;
        slotIndex = k;
    }
    probe.planetSlotIndex = slotIndex;

    // Ajouter la sonde aux atterrisseurs de la cible
    if (targetBody) {
        if (!targetBody.landers) targetBody.landers = [];
        targetBody.landers.push(probe);
    }

    // Retirer la sonde de la liste globale du système solaire
    updatedGame.board.solarSystem.probes = updatedGame.board.solarSystem.probes.filter(p => p.id !== probeId);

    const accumulatedBonuses: Bonus = {};
    const completedMissions: string[] = [];
    // Bonus planète (atterrissage)
    if (targetBody) {
       if ((targetBody as Planet).landSlots) {
       const index = forcedSlotIndex !== undefined ? forcedSlotIndex : targetBody.landers.length - 1;
            const slotBonus = (targetBody as Planet).landSlots[index];
            if (slotBonus) ResourceSystem.accumulateBonus(slotBonus, accumulatedBonuses);
        } else if ((targetBody as Satellite).landBonus) {
            ResourceSystem.accumulateBonus((targetBody as Satellite).landBonus, accumulatedBonuses);
        }
    }

    // Traitement des buffs permanents
    const processedSources = new Set<string>();
    player.permanentBuffs.forEach(buff => {
      if (buff.type === 'GAIN_ON_LAND' || buff.type === 'GAIN_ON_ORBIT_OR_LAND') {
           // Ignorer si le prérequis est déjà complété
           if (buff.id && buff.source) {
               const mission = player.missions.find(m => m.name === buff.source);
               if (mission && mission.completedRequirementIds.includes(buff.id)) return;
               if (mission && mission.fulfillableRequirementIds?.includes(buff.id)) return;
           }

           if (buff.source && processedSources.has(buff.source)) return;

           if (buff.source) processedSources.add(buff.source);

           // Marquer comme remplie (en attente de clic)
           CardSystem.markMissionRequirementFulfillable(player, buff);
      }
    });

    return {
      updatedGame,
      isFirstLander,
      isSecondLander,
      planetId,
      bonuses: accumulatedBonuses,
      completedMissions
    };
  }

  /**
   * Met à jour les positions des sondes après une rotation du système solaire
   */
  static updateProbesAfterRotation(
    game: Game,
    oldRotationState: RotationState,
    newRotationState: RotationState,
    extraObjects: import('../core/types').CelestialObject[]
  ): { game: Game; logs: string[] } {
    const updatedGame = structuredClone(game);
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
    for (const player of updatedGame.players) {
      let playerMediaGain = 0;

      for (let i = 0; i < player.probes.length; i++) {
        const probe = player.probes[i];
        if (probe.state !== ProbeState.IN_SOLAR_SYSTEM || !probe.solarPosition) {
          continue;
        }
        
        const pos = probe.solarPosition;
        
        // Vérifier si la sonde tourne avec son plateau (riding)
        let isRiding = false;
        if (pos.level === 3 && oldRotationState.level3Angle !== newRotationState.level3Angle) isRiding = true;
        if (pos.level === 2 && oldRotationState.level2Angle !== newRotationState.level2Angle) isRiding = true;
        if (pos.level === 1 && oldRotationState.level1Angle !== newRotationState.level1Angle) isRiding = true;

        if (isRiding) {
          this.recalculateProbePosition(probe, oldRotationState, newRotationState, extraObjects);
        } else {
          // La sonde ne tourne pas (ex: sur L0). Vérifier si elle est recouverte.
          let absoluteSector = pos.sector;
          if (pos.level === 1) absoluteSector = rotateSector(pos.sector, oldRotationState.level1Angle);
          else if (pos.level === 2) absoluteSector = rotateSector(pos.sector, oldRotationState.level2Angle);
          else if (pos.level === 3) absoluteSector = rotateSector(pos.sector, oldRotationState.level3Angle);
          
          const newVisibleLevel = getVisibleLevel(pos.disk, absoluteSector, newRotationState, extraObjects);
          
          // Si recouverte par un niveau supérieur qui a bougé -> Poussée
          // Note: La hiérarchie visuelle est Level 3 (Haut) > Level 2 > Level 1 > Level 0 (Bas/Fixe)
          // On est recouvert si le nouveau niveau visible est > au nôtre (ex: 2 couvre 1)
          // Ou si on est sur le niveau 0 et qu'un niveau > 0 nous couvre
          const currentLevel = pos.level || 0;
          const isCovered = newVisibleLevel !== 0 && (currentLevel === 0 || newVisibleLevel > currentLevel);

          if (isCovered && pushDirection !== 0) {
            const sectorIndex = (absoluteSector - 1 + pushDirection + 8) % 8;
            const newAbsoluteSector = (sectorIndex + 1) as SectorNumber;
            
            const levelAtNewPos = getVisibleLevel(pos.disk, newAbsoluteSector, newRotationState, extraObjects);
            
            let newRelativeSector = newAbsoluteSector;
            if (levelAtNewPos === 3) newRelativeSector = rotateSector(newAbsoluteSector, -newRotationState.level3Angle);
            else if (levelAtNewPos === 2) newRelativeSector = rotateSector(newAbsoluteSector, -newRotationState.level2Angle);
            else if (levelAtNewPos === 1) newRelativeSector = rotateSector(newAbsoluteSector, -newRotationState.level1Angle);
            
            // Vérifier gains média
            const cell = getCell(pos.disk, newAbsoluteSector, newRotationState, extraObjects);
            let mediaGain = 0;
            let objectName = "";
            if (cell) {
              if (cell.hasComet) { mediaGain++; objectName = "Visite de Comète"; }
              if (cell.hasPlanet && cell.planetId !== 'earth') { mediaGain++; objectName = cell.planetName || "Visite de Planète"; }
              if (cell.hasAsteroid && player.technologies.some(t => t.id.startsWith('exploration-2'))) { mediaGain++; objectName = "Visite d'Astéroïdes"; }
            }

            if (mediaGain > 0) {
              playerMediaGain += mediaGain;
              logs.push(`Sonde de ${player.name} poussée vers ${pos.disk}${newAbsoluteSector} (${objectName}) et gagne ${mediaGain} Média`);
            } else {
              logs.push(`Sonde de ${player.name} poussée vers ${pos.disk}${newAbsoluteSector}`);
            }

            probe.solarPosition = {
                disk: pos.disk,
                sector: newRelativeSector,
                level: levelAtNewPos
            };
          } else {
            this.recalculateProbePosition(probe, oldRotationState, newRotationState, extraObjects);
          }
        }
      }

      if (playerMediaGain > 0) {
        player.mediaCoverage = Math.min(player.mediaCoverage + playerMediaGain, GAME_CONSTANTS.MAX_MEDIA_COVERAGE);
      }
    }

    // Mettre à jour les sondes du système solaire (copie de celles des joueurs)
    updatedGame.board.solarSystem.probes = updatedGame.players.flatMap(p => p.probes.filter(probe => probe.state === ProbeState.IN_SOLAR_SYSTEM));

    return { game: updatedGame, logs };
  }

  private static recalculateProbePosition(
    probe: Probe,
    oldRotationState: RotationState,
    newRotationState: RotationState,
    extraObjects: import('../core/types').CelestialObject[]
  ): void {
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
    const newLevel = getVisibleLevel(pos.disk, absoluteSector, newRotationState, extraObjects);

    // 3. Recalculer le secteur relatif pour ce nouveau niveau
    let newRelativeSector = absoluteSector;
    if (newLevel === 3) {
      newRelativeSector = rotateSector(absoluteSector, -newRotationState.level3Angle);
    } else if (newLevel === 2) {
      newRelativeSector = rotateSector(absoluteSector, -newRotationState.level2Angle);
    } else if (newLevel === 1) {
      newRelativeSector = rotateSector(absoluteSector, -newRotationState.level1Angle);
    }

    probe.solarPosition.sector = newRelativeSector;
    probe.solarPosition.level = newLevel;
  }

  /**
   * Vérifie si un joueur a une présence (orbiteur ou atterrisseur) sur une planète ou ses lunes
   */
  static hasPresenceOnPlanet(game: Game, playerId: string, planetId: string): boolean {
    let planet = game.board.planets.find(p => p.id === planetId);
    if (!planet && planetId === 'oumuamua') {
        const species = game.species.find(s => s.name === AlienBoardType.OUMUAMUA);
        if (species) planet = species.planet;
    }
    if (!planet) return false;

    // Vérifier orbiteurs sur la planète
    if (planet.orbiters.some(p => p.ownerId === playerId)) return true;
    
    // Vérifier atterrisseurs sur la planète
    if (planet.landers.some(p => p.ownerId === playerId)) return true;

    // Vérifier satellites
    if (planet.satellites) {
      for (const sat of planet.satellites) {
        if (sat.landers && sat.landers.some(p => p.ownerId === playerId)) return true;
      }
    }

    return false;
  }
}