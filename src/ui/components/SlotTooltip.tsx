import React from 'react';

/** Code couleur commun des infobulles d'emplacement */
export const SLOT_COLORS = {
  available: '#4a9eff',
  unavailable: '#ff6b6b',
  neutral: '#aaa',
  bonus: '#ffd700',
};

interface SlotTooltipProps {
  /** 1re ligne : état (Disponible, Indisponible, Occupé par…) */
  status: string;
  statusColor: string;
  /** 2e ligne : libellé suivi de la valeur en doré (ex : « Bonus : 3 PV ») */
  label?: string;
  value?: React.ReactNode;
  /** 3e ligne : action possible ou raison de l'indisponibilité, dans la couleur de l'état par défaut */
  note?: string | null;
  noteColor?: string;
}

/**
 * Infobulle d'un emplacement : état (bleu = disponible, rouge = indisponible, couleur du joueur = occupé),
 * gain en doré, puis l'action ou la raison dans la couleur de l'état.
 */
export const SlotTooltip: React.FC<SlotTooltipProps> = ({ status, statusColor, label = 'Bonus', value, note, noteColor }) => (
  <div style={{ textAlign: 'center' }}>
    <div style={{ fontWeight: 'bold', marginBottom: '4px', color: statusColor }}>{status}</div>
    {value !== undefined && value !== null && value !== '' ? (
      <div style={{ fontSize: '0.9em', color: '#ccc' }}>{label} : <span style={{ color: SLOT_COLORS.bonus }}>{value}</span></div>
    ) : label === 'Bonus' && value !== undefined ? (
      <div style={{ fontSize: '0.9em', color: '#ccc' }}>Aucun bonus</div>
    ) : null}
    {note && <div style={{ fontSize: '0.8em', color: noteColor ?? statusColor, marginTop: '4px', fontStyle: 'italic' }}>{note}</div>}
  </div>
);
