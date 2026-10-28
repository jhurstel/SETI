import React, { useState } from 'react';
import { Card } from '../../core/types';
import { Tooltip } from '../Tooltip';
import { ChoiceCardTile } from './CardPickModal';
import { ChoiceModal, ChoiceFooterButton } from './ChoiceModal';

interface PassModalProps {
  visible: boolean;
  cards: Card[];
  onConfirm: (selectedCardId: string) => void;
  currentRound: number;
  /** Titre et bouton personnalisés (ex: réservation de carte) ; par défaut, choix de fin de manche */
  title?: string;
  subtitle?: string;
  confirmLabel?: string;
  /** Attribut mis en surbrillance, comme sur le plateau joueur (revenu pour une réservation) */
  highlightedAttribute?: 'revenue' | 'scan' | 'freeAction';
}

/** Choix d'une carte dans une fenêtre centrale (fin de manche, réservation) */
export const PassModal: React.FC<PassModalProps> = ({ visible, cards, onConfirm, currentRound, title, subtitle, confirmLabel, highlightedAttribute = 'freeAction' }) => {
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null);
  const [activeTooltip, setActiveTooltip] = useState<{ content: React.ReactNode, rect: DOMRect } | null>(null);

  if (!visible) return null;

  const confirm = () => {
    if (selectedCardId) {
      onConfirm(selectedCardId);
      setSelectedCardId(null);
    }
  };

  return (
    <>
      <ChoiceModal
        title={title ?? `Fin de manche ${currentRound} : choisissez une carte`}
        subtitle={subtitle}
        footer={<ChoiceFooterButton onClick={confirm} disabled={!selectedCardId}>{confirmLabel ?? 'Confirmer et passer'}</ChoiceFooterButton>}
        wide
      >
          {cards.map(card => (
            <ChoiceCardTile
              key={card.id}
              card={card}
              selected={selectedCardId === card.id}
              highlightedAttribute={highlightedAttribute}
              onClick={() => setSelectedCardId(card.id)}
              onHover={setActiveTooltip}
            />
          ))}
      </ChoiceModal>
      {activeTooltip && (
        <Tooltip content={activeTooltip.content} targetRect={activeTooltip.rect} />
      )}
    </>
  );
};
