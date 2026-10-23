import { useEffect, useRef } from 'react';
import { Game, HistoryEntry, InteractionState } from '../../core/types';
import { AITurn } from '../../ai/AITurn';

const AI_STEP_DELAY_MS = 1500;

interface AITurnCallbacks {
  /** Applique un nouvel état de jeu (état React + moteur). */
  applyGame: (game: Game) => void;
  /** Ajoute une entrée d'historique ; `previousState` sert à l'annulation. */
  addToHistory: (message: string, playerId?: string, previousState?: Game, customInteractionState?: InteractionState, sequenceId?: string) => void;
  /** Phase de mise en place : passe au joueur suivant après la réservation. */
  onSetupReserved: (game: Game) => void;
  /** Le robot passe pour la manche. */
  onPass: (cardsToKeep: string[]) => void;
  /** Notification de découverte d'espèce déclenchée par un palier. */
  onDiscovery: (message: string) => void;
  /** Le robot a terminé son tour (le joueur suivant est actif). */
  onTurnEnded: () => void;
  /** Interactions destinées au joueur humain déclenchées par le robot (ex: trace de vie du gagnant d'un secteur). */
  onHumanInteractions: (interactions: InteractionState[]) => void;
}

/**
 * Fait jouer les robots : une étape (action gratuite, action principale, fin de tour…)
 * toutes les AI_STEP_DELAY_MS, tant qu'aucune interaction n'est en cours.
 * La logique de jeu est dans AITurn (testable sans React).
 */
export function useAITurn(game: Game | null, interactionState: InteractionState, callbacks: AITurnCallbacks): void {
  // Toujours appeler les callbacks les plus récents sans relancer l'effet à chaque rendu
  const callbacksRef = useRef(callbacks);
  callbacksRef.current = callbacks;

  useEffect(() => {
    if (!game || interactionState.type !== 'IDLE') return;
    const currentPlayer = game.players[game.currentPlayerIndex];
    if (!currentPlayer || currentPlayer.type !== 'robot') return;

    const timer = setTimeout(() => {
      const cb = callbacksRef.current;
      const record = (entries: HistoryEntry[]) =>
        entries.forEach(e => cb.addToHistory(e.message, e.playerId || undefined, game, undefined, e.sequenceId));

      const step = AITurn.playStep(game);
      switch (step.kind) {
        case 'WAIT':
          return;
        case 'SETUP_RESERVED':
          record(step.historyEntries);
          cb.onSetupReserved(step.updatedGame);
          return;
        case 'UPDATED':
          record(step.historyEntries);
          cb.applyGame(step.updatedGame);
          if (step.humanInteractions?.length) cb.onHumanInteractions(step.humanInteractions);
          return;
        case 'END_TURN': {
          const end = AITurn.endTurn(game);
          record(end.historyEntries);
          if (end.discoveryNotification) cb.onDiscovery(end.discoveryNotification.message);
          cb.applyGame(end.updatedGame);
          cb.onTurnEnded();
          return;
        }
        case 'PASS':
          cb.onPass(step.cardsToKeep);
          return;
      }
    }, AI_STEP_DELAY_MS);

    return () => clearTimeout(timer);
  }, [game, interactionState.type]);
}
