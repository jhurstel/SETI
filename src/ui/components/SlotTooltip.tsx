import React from 'react';
import { SLOT_COLORS } from '../styles/slotColors';

interface SlotTooltipProps {
  /** 1re ligne : état (Disponible, Indisponible, Occupé par…) */
  status: string;
  statusColor: string;
  /** 2e ligne : libellé suivi de la valeur en doré (ex : « Bonus : 3 PV ») */
  label?: string;
  value?: React.ReactNode;
  /** Coût de l'emplacement (symboles), affiché sur la même ligne, avant le bonus (ex : « Coût : 3 Données  Bonus : 15 PV ») */
  cost?: React.ReactNode;
  /** 3e ligne : action possible ou raison de l'indisponibilité, dans la couleur de l'état par défaut */
  note?: string | null;
  noteColor?: string;
}

/**
 * Infobulle d'un emplacement : état (bleu = disponible, rouge = indisponible, couleur du joueur = occupé),
 * gain en doré, puis l'action ou la raison dans la couleur de l'état.
 */
export const SlotTooltip: React.FC<SlotTooltipProps> = ({ status, statusColor, label = 'Bonus', value, cost, note, noteColor }) => (
  <div className="slot-tooltip">
    <div style={{ fontWeight: 'bold', marginBottom: '4px', color: statusColor }}>{status}</div>
    {value !== undefined && value !== null && value !== '' ? (
      <div className="slot-tooltip-line">
        {cost && <>Coût :<span style={{ color: SLOT_COLORS.unavailable, display: 'inline-flex', alignItems: 'center', marginRight: '6px' }}>{cost}</span></>}
        {label} :<span style={{ color: SLOT_COLORS.bonus, display: 'inline-flex', alignItems: 'center' }}>{value}</span>
      </div>
    ) : label === 'Bonus' && value !== undefined ? (
      <div className="slot-tooltip-empty">Aucun bonus</div>
    ) : null}
    {note && <div style={{ fontSize: '0.8em', color: noteColor ?? statusColor, marginTop: '4px', fontStyle: 'italic' }}>{note}</div>}
  </div>
);
