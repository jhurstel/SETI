import { DiskName, LifeTraceLocation, LifeTraceType, SectorNumber } from '../core/types';

/**
 * Réponse du joueur à l'interaction en cours (`game.interaction`).
 * Chaque genre ne répond qu'aux interactions indiquées (vérifié par GameSession).
 */
export type Choice =
  /** PLACING_LIFE_TRACE */
  | { kind: 'LIFE_TRACE'; boardIndex: number; color: LifeTraceType; slotType: LifeTraceLocation; slotIndex?: number }
  /** ACQUIRING_ALIEN_CARD : carte de la rangée de l'espèce, ou 'deck' */
  | { kind: 'ALIEN_CARD'; cardId: string }
  /** PLACING_OBJECTIVE_MARKER */
  | { kind: 'OBJECTIVE'; tileId: string }
  /** ACQUIRING_TECH */
  | { kind: 'TECH'; techId: string }
  /** SELECTING_COMPUTER_SLOT */
  | { kind: 'COMPUTER_COLUMN'; column: number }
  /** ORBITING_PROBE, LANDING_PROBE, REMOVING_ORBITER, REMOVING_LANDER */
  | { kind: 'PLANET'; planetId: string; slotIndex?: number }
  /** CHOOSING_CENTAURIEN_REWARD */
  | { kind: 'CENTAURIEN'; tokenIndex: number }
  /** CHOOSING_BONUS_ACTION */
  | { kind: 'MENU'; index: number }
  /** ACQUIRING_CARD (absent : la pioche), SELECTING_SCAN_CARD */
  | { kind: 'CARD'; cardId?: string }
  /** RESERVING_CARD, DISCARDING_FOR_SIGNAL */
  | { kind: 'CARDS'; cardIds: string[] }
  /** CHOOSING_MEDIA_OR_MOVE */
  | { kind: 'MEDIA_OR_MOVE'; choice: 'MEDIA' | 'MOVE' }
  /** COLLECTING_SPECIMEN, CONSULTING_SPECIMEN */
  | { kind: 'SPECIMEN'; planetId: string; tokenIndex: number }
  /** CHOOSING_EXERTIEN_CARD (absent : renoncer) */
  | { kind: 'EXERTIEN'; cardId?: string }
  /** CHOOSING_MISSION_REQUIREMENT (absent : renoncer) */
  | { kind: 'MISSION'; missionId?: string; requirementId?: string }
  /** CHOOSING_OBS2_ACTION, CHOOSING_OBS3_ACTION */
  | { kind: 'ACCEPT'; accepted: boolean }
  /** CHOOSING_OBS4_ACTION */
  | { kind: 'OBS4'; choice: 'PROBE' | 'MOVE' }
  /** SELECTING_SCAN_SECTOR */
  | { kind: 'SECTOR'; sectorId: string };

/**
 * Tout ce qu'un joueur peut demander à la partie (GameSession.dispatch) : sérialisable, donc transmissible
 * d'un client à un serveur. Le moteur vérifie qui joue et ce qui est permis.
 */
export type Command =
  // Actions principales
  | { type: 'LAUNCH_PROBE' }
  | { type: 'SCAN'; sectorId?: string }
  | { type: 'ANALYZE' }
  | { type: 'RESEARCH_TECH'; techId?: string }
  | { type: 'ORBIT'; planetId: string }
  | { type: 'LAND'; planetId: string; slotIndex?: number }
  | { type: 'PLAY_CARD'; cardId: string }
  | { type: 'PASS'; cardsToKeep: string[]; roundCardId?: string }
  // Actions gratuites (un pas de sonde à la fois ; avec des déplacements gratuits en cours, ils sont utilisés d'abord)
  | { type: 'MOVE_PROBE'; probeId: string; disk: DiskName; sector: SectorNumber }
  | { type: 'TRADE'; spend: string; gain: string; cardIds?: string[] }
  | { type: 'BUY_CARD' }
  | { type: 'DISCARD_FOR_FREE_ACTION'; cardId: string }
  | { type: 'TRANSFER_DATA'; slotId: string }
  | { type: 'CLAIM_MISSION'; missionId: string; requirementId: string }
  // Interaction en cours
  | { type: 'CHOOSE'; choice: Choice }
  | { type: 'SKIP' }
  // Tour
  | { type: 'END_TURN' };
