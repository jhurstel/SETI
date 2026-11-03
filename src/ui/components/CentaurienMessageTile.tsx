import React from 'react';
import { Bonus } from '../../core/types';
import { BonusIcons } from './BonusIcons';
import './CentaurienMessageTile.css';

/**
 * Tuile Message des Centauriens (infobulle du plateau) : récompense en symboles seuls, toutes les tuiles de même taille.
 * Prise, elle est grisée et bordée de la couleur du joueur qui l'a choisie. (Le choix au palier utilise ChoiceOption.)
 */
export const CentaurienMessageTile: React.FC<{ bonus: Bonus; takenColor?: string; taken?: boolean }> = ({ bonus, takenColor, taken = false }) => (
  <span className={`seti-message-tile ${taken ? 'taken' : ''}`} style={taken && takenColor ? { borderColor: takenColor } : undefined}>
    <BonusIcons bonus={bonus} size={16} />
  </span>
);
