import { Choice, DiskName, SectorNumber } from '../core/types';

/** Réponse du joueur à l'interaction en cours : défini avec les interactions (core/model/interactions.ts, INTERACTIONS) */
export type { Choice };

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
  | { type: 'PASS'; cardsToKeep: string[] }
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
