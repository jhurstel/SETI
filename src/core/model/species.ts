/** Espèces Alien et leurs jetons (anomalies, messages Centauriens, spécimens Mascamites) */
import type { Planet, Sector } from './board';
import type { Bonus, Card } from './cards';
import { LifeTraceType } from './enums';

export interface Species {
  id: string;
  name: string;
  description: string;
  fixedSlots: {
    redlifetrace: Bonus[],
    yellowlifetrace: Bonus[],
    bluelifetrace: Bonus[],
  };
  infiniteSlots: {
    redlifetrace: Bonus,
    yellowlifetrace: Bonus,
    bluelifetrace: Bonus,
  };
  cards: Card[];
  cardRow: Card[];
  discovered: boolean;
  sector?: Sector;
  planet?: Planet;
  anomalie?: AnomalieToken[];
  message?: CentaurienToken[];
  specimen?: MascamitesToken[];
}

export interface AnomalieToken {
  color: LifeTraceType;
  head: Bonus;
  tail: Bonus;
}

export interface CentaurienToken {
  bonus: Bonus;
  isAvailable: boolean;
  /** Joueur qui a choisi cette tuile Message */
  claimedBy?: string;
}

export interface MascamitesToken {
  bonus: Bonus;
}
