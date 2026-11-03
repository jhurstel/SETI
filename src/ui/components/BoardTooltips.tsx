import React from 'react';
import { Bonus, LifeTraceType } from '../../core/types';
import { BonusIcons } from './BonusIcons';
import { ActionHexIcon, PieceIcon, PieceIconKind, ResourceIcon } from './GameIcons';
import { AnyTechIcon } from './ObjectiveSymbol';
import { HoverTooltip } from './HoverTooltip';
import './BoardTooltips.css';

/** Symbole avec sa propre infobulle (le gain ou le coût en toutes lettres), dans une autre infobulle */
export const Sym: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <HoverTooltip content={label} nested style={{ alignItems: 'center', cursor: 'help' }}>{children}</HoverTooltip>
);

/** Ligne de symboles (coût ou bonus), chacun avec son infobulle ; `note` en petit à la suite */
const Symbols: React.FC<{ children: React.ReactNode; note?: string }> = ({ children, note }) => (
  <span className="seti-board-tooltip-symbols">{children}{note && <span className="seti-board-tooltip-note">{note}</span>}</span>
);

/** Coût ou gain en ressources, avec les symboles du matériel */
export const ResourceSymbols: React.FC<{ bonus: Bonus; note?: string }> = ({ bonus, note }) => (
  <Symbols note={note}><BonusIcons bonus={bonus} size={20} tooltips /></Symbols>
);

/** Pièce posée par une action (sonde, orbiteur, atterrisseur) */
export const PieceSymbol: React.FC<{ kind: PieceIconKind; label: string; note?: string }> = ({ kind, label, note }) => (
  <Symbols note={note}><Sym label={label}><PieceIcon kind={kind} size={26} /></Sym></Symbols>
);

/** Bonus du scan : le symbole scan */
export const ScanSymbol: React.FC = () => (
  <Symbols><Sym label="Scan">
    <ActionHexIcon kind="scan" size={26} />
  </Sym></Symbols>
);

/** Bonus de l'analyse : une trace de vie bleue */
export const BlueTraceSymbol: React.FC = () => <ResourceSymbols bonus={{ lifetraces: [{ amount: 1, scope: LifeTraceType.BLUE }] }} />;

/** Coût d'une carte : crédit marqué « ? » */
export const CardCostSymbol: React.FC<{ note?: string }> = ({ note }) => (
  <Symbols note={note}><Sym label="Le coût de la carte jouée, en crédits ou en énergie"><ResourceIcon kind="credit" amount="?" size={20} /></Sym></Symbols>
);

/** Bonus de la recherche : une technologie au choix */
export const TechSymbol: React.FC<{ note?: string }> = ({ note }) => (
  <Symbols note={note}><Sym label="Une technologie au choix, et le bonus de sa tuile"><AnyTechIcon size={24} /></Sym></Symbols>
);

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
