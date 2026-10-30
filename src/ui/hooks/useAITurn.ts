import { useEffect, useRef } from 'react';
import { Game } from '../../core/types';
import { GameSession } from '../../session/GameSession';
import { playAIStep, endAITurn } from './aiWorkerClient';
import { RobotStep } from './useGameSession';

const AI_STEP_DELAY_MS = 1500;

/**
 * Fait jouer les robots : une étape (action gratuite, action principale, fin de tour…) toutes les AI_STEP_DELAY_MS,
 * tant qu'aucune interaction n'attend un joueur humain (GameSession.robotCanPlay) et que l'interface n'est pas occupée.
 * L'étape est calculée par AITurn dans un Web Worker (aiWorkerClient) pendant le délai, puis appliquée par la session.
 */
export function useAITurn(game: Game | null, paused: boolean, onStep: (step: RobotStep) => void): void {
  // Toujours appeler le rappel le plus récent sans relancer l'effet à chaque rendu
  const onStepRef = useRef(onStep);
  onStepRef.current = onStep;

  useEffect(() => {
    if (!game || paused || !GameSession.robotCanPlay(game)) return;

    // Le calcul commence tout de suite ; son résultat est appliqué au plus tôt après le délai,
    // et jamais si la partie a changé entre-temps (annulation, nouvelle partie…)
    let cancelled = false;
    const delay = new Promise<void>(resolve => setTimeout(resolve, AI_STEP_DELAY_MS));
    const run = async () => {
      const [step] = await Promise.all([playAIStep(game), delay]);
      if (cancelled || step.kind === 'WAIT') return;
      if (step.kind === 'END_TURN') {
        const end = await endAITurn(game);
        if (!cancelled) onStepRef.current({ kind: 'END_TURN_DONE', end });
        return;
      }
      onStepRef.current(step);
    };
    run().catch(error => console.error('[AI] Erreur pendant le tour du robot :', error));

    return () => { cancelled = true; };
  }, [game, paused]);
}
