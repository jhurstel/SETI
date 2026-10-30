import { useEffect, useRef } from 'react';
import { Game, HistoryEntry, InteractionState } from '../../core/types';
import { playAIStep, endAITurn } from './aiWorkerClient';

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
 * La logique de jeu est dans AITurn (testable sans React) ; elle est calculée dans un Web Worker
 * (aiWorkerClient) pendant le délai, pour ne pas figer l'interface.
 */
export function useAITurn(game: Game | null, interactionState: InteractionState, callbacks: AITurnCallbacks): void {
  // Toujours appeler les callbacks les plus récents sans relancer l'effet à chaque rendu
  const callbacksRef = useRef(callbacks);
  callbacksRef.current = callbacks;

  useEffect(() => {
    if (!game || interactionState.type !== 'IDLE') return;
    const currentPlayer = game.players[game.currentPlayerIndex];
    if (!currentPlayer || currentPlayer.type !== 'robot') return;

    // Le calcul commence tout de suite ; son résultat est appliqué au plus tôt après le délai,
    // et jamais si la partie a changé entre-temps (annulation, nouvelle partie…)
    let cancelled = false;
    const delay = new Promise<void>(resolve => setTimeout(resolve, AI_STEP_DELAY_MS));
    const run = async () => {
      const [step] = await Promise.all([playAIStep(game), delay]);
      if (cancelled) return;
      const cb = callbacksRef.current;
      const record = (entries: HistoryEntry[]) =>
        entries.forEach(e => cb.addToHistory(e.message, e.playerId || undefined, game, undefined, e.sequenceId));

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
          const end = await endAITurn(game);
          if (cancelled) return;
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
    };
    run().catch(error => console.error('[AI] Erreur pendant le tour du robot :', error));

    return () => { cancelled = true; };
  }, [game, interactionState.type]);
}
