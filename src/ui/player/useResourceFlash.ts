import { useEffect, useRef, useState } from 'react';

/** Flash d'une valeur du plateau joueur : `gain` ou `loss` pendant 600 ms quand elle change (même joueur affiché) */
export const useResourceFlash = (value: number, playerId: string) => {
  const [flash, setFlash] = useState<{ type: 'gain' | 'loss'; id: number } | null>(null);
  const prevValueRef = useRef<number>(null);
  const prevPlayerIdRef = useRef<string>(null);

  useEffect(() => {
    const prevPlayerId = prevPlayerIdRef.current;
    const prevValue = prevValueRef.current;

    if (prevPlayerId === playerId && prevValue !== undefined && value !== prevValue) {
      setFlash({
        type: prevValue && value > prevValue ? 'gain' : 'loss',
        id: Date.now() + Math.random(),
      });
      const timer = setTimeout(() => setFlash(null), 600);
      return () => clearTimeout(timer);
    }
    return;
  }, [value, playerId]);

  // Mettre à jour les refs après l'effet principal pour la prochaine comparaison
  useEffect(() => {
    prevValueRef.current = value;
    prevPlayerIdRef.current = playerId;
  });

  return flash;
};
