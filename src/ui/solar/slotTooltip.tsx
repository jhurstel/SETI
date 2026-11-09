import React from 'react';
import { Bonus, Game, InteractionState, LifeTraceType, Player, Probe, ProbeState, Satellite } from '../../core/types';
import { FIXED_OBJECTS, INITIAL_ROTATING_LEVEL1_OBJECTS, INITIAL_ROTATING_LEVEL2_OBJECTS, INITIAL_ROTATING_LEVEL3_OBJECTS } from '../../core/SolarSystemPosition';
import { ProbeSystem } from '../../systems/ProbeSystem';
import { BonusIcons } from '../components/BonusIcons';
import { SlotTooltip } from '../components/SlotTooltip';
import { SLOT_COLORS } from '../styles/slotColors';
import { findPlanet } from './planets';

/** Emplacement survolé : orbite ou atterrissage, planète (ou lune) et numéro de case */
export interface HoveredSlot {
  type: 'orbiter' | 'lander';
  planetId: string;
  index: number;
}


/**
 * Infobulle d'un emplacement d'orbite ou d'atterrissage (planète ou lune) : état, bonus, puis l'action possible ou
 * la raison de son impossibilité. `actions` : le plateau propose-t-il de mettre en orbite / de poser une sonde.
 */
export const SlotTooltipContent: React.FC<{ game: Game; interactionState: InteractionState; slot: HoveredSlot; actions: { orbit: boolean; land: boolean } }> = ({ game, interactionState, slot, actions }) => {
  const { type, planetId, index } = slot;

  let planetData = findPlanet(game, planetId);
  let satelliteData: Satellite | null = null;

  if (!planetData) {
    for (const p of game.board.planets) {
      if (p.satellites) {
        const sat = p.satellites.find(s => s.id === planetId);
        if (sat) {
          satelliteData = sat;
          planetData = p;
          break;
        }
      }
    }
  }

  if (!planetData && !satelliteData) return null;

  const currentPlayer = game.players[game.currentPlayerIndex];
  const isRobot = currentPlayer.type === 'robot';

  // Trouver l'objet céleste pour vérifier la position de la sonde du joueur
  const targetObjId = satelliteData ? planetData!.id : planetId;
  const targetObj = [...FIXED_OBJECTS, ...INITIAL_ROTATING_LEVEL1_OBJECTS, ...INITIAL_ROTATING_LEVEL2_OBJECTS, ...INITIAL_ROTATING_LEVEL3_OBJECTS, ...(game.board.solarSystem.extraCelestialObjects || [])].find(o => o.id === targetObjId);
  const playerProbe = targetObj && game.board.solarSystem.probes.find(p =>
    p.ownerId === currentPlayer.id &&
    p.state === ProbeState.IN_SOLAR_SYSTEM &&
    p.solarPosition.disk === targetObj.position.disk &&
    p.solarPosition.sector === targetObj.position.sector &&
    p.solarPosition.level === targetObj.level
  );

  if (type === 'orbiter') {
    if (satelliteData) return null;
    const orbitSlots = planetData!.orbitSlots || [];
    if (index >= orbitSlots.length) return null;
    const bonus = orbitSlots[index];
    const probe = planetData!.orbiters[index];
    const player = probe ? game.players.find(p => p.id === probe.ownerId) : null;
    const bonusText = <BonusIcons bonus={bonus} />;

    const isOccupied = !!player;
    // Pas de limite d'orbiteurs : quand toutes les cases sont prises, la dernière reste ouverte (bonus des suivants)
    const isNextAvailable = index === Math.min(planetData!.orbiters.length, orbitSlots.length - 1);

    let canOrbit = false;
    let orbitReason = "";
    if (playerProbe) {
      if (currentPlayer.hasPerformedMainAction || isRobot) {
        orbitReason = isRobot ? "Tour du robot" : "Action principale déjà effectuée";
      } else {
        const check = ProbeSystem.canOrbit(game, currentPlayer.id, playerProbe.id);
        canOrbit = check.canOrbit;
        orbitReason = check.reason || "Impossible";
      }
    } else {
      orbitReason = "Nécessite une sonde sur la planète";
    }

    let isClickable = false;
    if (interactionState.type === 'REMOVING_ORBITER') {
      isClickable = isOccupied && !!player && player.id === currentPlayer.id && actions.orbit;
    } else {
      isClickable = isNextAvailable && canOrbit && actions.orbit;
    }

    return renderTooltipContent(isOccupied, isClickable, player!, bonusText, orbitReason, "Cliquez pour mettre en orbite (Coût: 1 Crédit, 1 Énergie)", interactionState.type === 'REMOVING_ORBITER', 'orbiter');
  }

  if (type === 'lander') {
    let landSlots: Bonus[] = [];
    let landers: Probe[] = [];

    if (satelliteData) {
      landSlots = [satelliteData.landBonus];
      landers = satelliteData.landers || [];
    } else {
      landSlots = planetData!.landSlots || [];
      landers = planetData!.landers || [];
    }

    if (index >= landSlots.length) return null;
    const bonus = landSlots[index];

    const probesOnSlot = landers.filter(p => p.planetSlotIndex === index);
    const probe = probesOnSlot.length > 0 ? probesOnSlot[probesOnSlot.length - 1] : undefined;
    const player = probe ? game.players.find(p => p.id === probe.ownerId) : null;
    const bonusText = <BonusIcons bonus={bonus} />;

    const isOccupied = !!player;
    // Emplacement ouvert selon le moteur : lune libre, case suivante (au-delà des cases imprimées : la dernière), Dragonfly
    const allowOccupiedLanding = ProbeSystem.allowsOccupiedLanding(interactionState);
    const slotOpen = satelliteData
      ? ProbeSystem.canLandOnSlot(game, satelliteData.id, 0, allowOccupiedLanding).canLand
      : ProbeSystem.landingSlotForClick(game, planetData!.id, index, allowOccupiedLanding) !== null;

    let canLand = false;
    let landReason = "";
    let landEnergyCost = 0;

    if (playerProbe) {
      if ((currentPlayer.hasPerformedMainAction && !(interactionState.type === 'LANDING_PROBE')) || isRobot) {
        landReason = isRobot ? "Tour du robot" : "Action principale déjà effectuée";
      } else {
        const check = ProbeSystem.canLand(game, currentPlayer.id, playerProbe.id, !(interactionState.type === 'LANDING_PROBE'));
        canLand = check.canLand;
        landEnergyCost = check.energyCost || 0;
        landReason = check.reason || "Impossible";
      }
    } else {
      landReason = "Nécessite une sonde sur la planète";
    }

    if (satelliteData) {
      const satellite = ProbeSystem.canLandOnSatellite(game, currentPlayer.id, satelliteData.id, interactionState.type === 'LANDING_PROBE' && interactionState.ignoreSatelliteLimit);
      if (!satellite.canLand) {
        canLand = false;
        landReason = satellite.reason;
      }
    }

    let isClickable = false;
    if (interactionState.type === 'REMOVING_LANDER') {
        isClickable = isOccupied && !!player && player.id === currentPlayer.id && actions.land;
    } else {
        isClickable = slotOpen && (canLand || interactionState.type === 'LANDING_PROBE') && actions.land;
    }

    const actionTextSuccess = interactionState.type === 'LANDING_PROBE'
      ? "Cliquez pour atterrir (Bonus)"
      : `Cliquez pour atterrir (Coût: ${landEnergyCost} Énergie)`;

    return renderTooltipContent(isOccupied, isClickable, player!, bonusText, landReason, actionTextSuccess, interactionState.type === 'REMOVING_LANDER', 'lander');
  }
  return null;
};

function renderTooltipContent(isOccupied: boolean, isClickable: boolean, player: Player | null, bonusText: React.ReactNode, reason: string, actionTextSuccess: string, isRemovingMode: boolean, removalType?: 'orbiter' | 'lander') {
  let statusText = isOccupied && player ? `Occupé par ${player.name}` : (isClickable ? "Disponible" : "Indisponible");
  let statusColor = isOccupied && player ? (player.color || "#ccc") : (isClickable ? SLOT_COLORS.available : SLOT_COLORS.unavailable);
  let actionText: string | null = isClickable ? actionTextSuccess : reason;

  if (isOccupied && isClickable && isRemovingMode) {
    statusText = "Cliquez pour retirer";
    statusColor = SLOT_COLORS.unavailable;
    actionText = null;
  }

  let removalBonusText: React.ReactNode = '';
  if (isRemovingMode && isClickable) {
      if (removalType === 'orbiter') {
          removalBonusText = <BonusIcons bonus={{ pv: 3, data: 1, anycard: 1 }} />;
      } else if (removalType === 'lander') {
          removalBonusText = <BonusIcons bonus={{ lifetraces: [{ amount: 1, scope: LifeTraceType.YELLOW }] }} />;
      }
  }

  return (
    <SlotTooltip
      status={statusText}
      statusColor={statusColor}
      label={isRemovingMode && isClickable ? 'Bonus du retrait' : 'Bonus'}
      value={isRemovingMode && isClickable ? removalBonusText : bonusText}
      note={actionText}
      noteColor={isClickable ? SLOT_COLORS.available : SLOT_COLORS.unavailable}
    />
  );
}
