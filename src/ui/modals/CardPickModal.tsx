import React, { useState } from 'react';
import { Card } from '../../core/types';
import { CardTooltip } from '../components/CardTooltip';
import { CardContent } from '../components/HandCard';
import { Tooltip } from '../Tooltip';
import { ChoiceModal, ChoiceFooterButton } from './ChoiceModal';

type HighlightedAttribute = 'revenue' | 'scan' | 'freeAction';

/** Carte cliquable d'une fenêtre de choix, dessinée comme sur le plateau joueur */
export const ChoiceCardTile: React.FC<{
  card: Card;
  selected: boolean;
  highlightedAttribute: HighlightedAttribute;
  onClick: () => void;
  onHover: (tooltip: { content: React.ReactNode, rect: DOMRect } | null) => void;
}> = ({ card, selected, highlightedAttribute, onClick, onHover }) => (
  <div
    onClick={onClick}
    onMouseEnter={(e) => onHover({ content: <CardTooltip card={card} />, rect: e.currentTarget.getBoundingClientRect() })}
    onMouseLeave={() => onHover(null)}
    className={`seti-common-card seti-card-wrapper ${selected ? 'selected' : ''}`}
    style={{
      width: '140px',
      height: '200px',
      padding: '6px',
      backgroundColor: selected ? 'rgba(74, 158, 255, 0.2)' : 'rgba(30, 30, 40, 0.9)',
      border: selected ? '2px solid #4a9eff' : '1px solid #555',
      borderRadius: '8px',
      cursor: 'pointer',
      transition: 'all 0.2s',
      transform: selected ? 'scale(1.05)' : 'scale(1)',
      display: 'flex',
      flexDirection: 'column',
      gap: '2px',
      position: 'relative'
    }}
  >
    <CardContent card={card} highlightedAttribute={highlightedAttribute} />
  </div>
);

interface CardPickModalProps {
  title: string;
  subtitle?: string;
  cards: Card[];
  /** Sélection tenue par l'appelant (état d'interaction) */
  selectedIds: string[];
  onToggle: (cardId: string) => void;
  highlightedAttribute: HighlightedAttribute;
  /** Ligne d'état sous les cartes (ex : « Sélectionnées : 1 / 2 ») */
  status: string;
  confirmLabel: string;
  canConfirm: boolean;
  onConfirm: () => void;
  /** Bouton Annuler (choix facultatif, ex : échange) */
  onCancel?: () => void;
}

/** Choix de plusieurs cartes de la main dans une fenêtre centrale (défausses, échange) */
export const CardPickModal: React.FC<CardPickModalProps> = ({ title, subtitle, cards, selectedIds, onToggle, highlightedAttribute, status, confirmLabel, canConfirm, onConfirm, onCancel }) => {
  const [activeTooltip, setActiveTooltip] = useState<{ content: React.ReactNode, rect: DOMRect } | null>(null);

  return (
    <>
      <ChoiceModal
        title={title}
        subtitle={subtitle}
        footer={
          <>
            <div className="seti-choice-modal-subtitle">{status}</div>
            {onCancel && <ChoiceFooterButton onClick={onCancel} secondary>Annuler</ChoiceFooterButton>}
            <ChoiceFooterButton onClick={onConfirm} disabled={!canConfirm}>{confirmLabel}</ChoiceFooterButton>
          </>
        }
        wide
      >
        {cards.map(card => (
          <ChoiceCardTile
            key={card.id}
            card={card}
            selected={selectedIds.includes(card.id)}
            highlightedAttribute={highlightedAttribute}
            onClick={() => onToggle(card.id)}
            onHover={setActiveTooltip}
          />
        ))}
      </ChoiceModal>
      {activeTooltip && <Tooltip content={activeTooltip.content} targetRect={activeTooltip.rect} />}
    </>
  );
};
