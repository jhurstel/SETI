import React from 'react';
import './BoardTooltips.css';

/**
 * Infobulle d'une action (principale, fin de tour, étape du scan) : nom, coût, bonus obtenu,
 * puis ce que fait un clic, ou pourquoi l'action n'est pas possible maintenant.
 */
export const ActionTooltip: React.FC<{
  title: string;
  cost?: React.ReactNode;
  bonus?: React.ReactNode;
  /** Libellé de la ligne du bonus (« Effet » pour passer ou finir le tour) */
  bonusLabel?: string;
  /** Action possible maintenant : `hint` en vert, sinon en rouge (raison) */
  available?: boolean;
  hint?: string | null;
}> = ({ title, cost, bonus, bonusLabel = 'Bonus', available = true, hint }) => (
  <div className="seti-board-tooltip">
    <div className="seti-board-tooltip-title">{title}</div>
    <dl className="seti-board-tooltip-rows">
      {cost !== undefined && (<><dt>Coût</dt><dd className="cost">{cost || 'Aucun'}</dd></>)}
      {bonus !== undefined && (<><dt>{bonusLabel}</dt><dd>{bonus}</dd></>)}
    </dl>
    {hint && <div className={`seti-board-tooltip-hint ${available ? 'ok' : 'blocked'}`}>{hint}</div>}
  </div>
);

/** Infobulle d'un emplacement de technologie : pouvoir actuel du joueur et bénéfice de la technologie */
export const TechTooltip: React.FC<{
  name: string;
  acquired: boolean;
  /** Pouvoir sans la technologie */
  base: string;
  /** Ce que la technologie apporte */
  benefit: string;
}> = ({ name, acquired, base, benefit }) => (
  <div className="seti-board-tooltip">
    <div className="seti-board-tooltip-title">
      {name}
      <span className={`seti-board-tooltip-badge ${acquired ? 'acquired' : ''}`}>{acquired ? 'Acquise' : 'À rechercher'}</span>
    </div>
    <dl className="seti-board-tooltip-rows">
      <dt>Pouvoir actuel</dt><dd>{acquired ? benefit : base}</dd>
      <dt>Bénéfice</dt><dd className="benefit">{benefit}</dd>
    </dl>
  </div>
);
