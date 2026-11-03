import React from 'react';
import { Bonus } from '../../core/types';
import { BonusIcons } from './BonusIcons';
import './CentaurienMessageTile.css';

/**
 * Tuile Message des Centauriens : récompense en symboles seuls, toutes les tuiles de même taille.
 * Prise, elle est grisée et bordée de la couleur du joueur qui l'a choisie. Avec onClick, c'est un bouton (choix au palier).
 */
export const CentaurienMessageTile: React.FC<{
  bonus: Bonus;
  takenColor?: string;
  taken?: boolean;
  large?: boolean;
  onClick?: () => void;
}> = ({ bonus, takenColor, taken = false, large = false, onClick }) => {
  const className = `seti-message-tile ${large ? 'large' : ''} ${taken ? 'taken' : ''}`;
  const style = taken && takenColor ? { borderColor: takenColor } : undefined;
  const content = <BonusIcons bonus={bonus} size={large ? 26 : 16} tooltips={large} />;
  return onClick
    ? <button type="button" className={className} style={style} onClick={onClick} disabled={taken}>{content}</button>
    : <span className={className} style={style}>{content}</span>;
};
