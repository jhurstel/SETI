import React, { useState } from 'react';
import { Card } from '../../core/types';
import { CardTooltip } from '../../ui/components/CardTooltip';
import { CardContent } from '../components/HandCard';
import { Tooltip } from '../Tooltip';
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
          {cards.map(card => {
            const isSelected = selectedCardId === card.id;
            return (
              <div
                key={card.id}
                onClick={() => setSelectedCardId(card.id)}
                onMouseEnter={(e) => {
                  const rect = e.currentTarget.getBoundingClientRect();
                  setActiveTooltip({ content: <CardTooltip card={card} />, rect });
                }}
                onMouseLeave={() => setActiveTooltip(null)}
                className={`seti-common-card seti-card-wrapper ${isSelected ? 'selected' : ''}`}
                style={{
                  width: '140px',
                  height: '200px',
                  padding: '6px',
                  backgroundColor: isSelected ? 'rgba(74, 158, 255, 0.2)' : 'rgba(30, 30, 40, 0.9)',
                  border: isSelected ? '2px solid #4a9eff' : '1px solid #555',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  transform: isSelected ? 'scale(1.05)' : 'scale(1)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '2px',
                  position: 'relative'
                }}
              >
                <CardContent card={card} highlightedAttribute={highlightedAttribute} />
              </div>
            )
          })}
      </ChoiceModal>
      {activeTooltip && (
        <Tooltip content={activeTooltip.content} targetRect={activeTooltip.rect} />
      )}
    </>
  );
};
