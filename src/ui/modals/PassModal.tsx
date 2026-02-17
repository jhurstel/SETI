import React, { useState } from 'react';
import { Card, CardType } from '../../core/types';
import { CardTooltip } from '../CardTooltip';
import { Tooltip } from '../Tooltip';

interface PassModalProps {
  visible: boolean;
  cards: Card[];
  onConfirm: (selectedCardId: string) => void;
  currentRound: number;
}

export const PassModal: React.FC<PassModalProps> = ({ visible, cards, onConfirm, currentRound }) => {
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null);
  const [activeTooltip, setActiveTooltip] = useState<{ content: React.ReactNode, rect: DOMRect } | null>(null);

  if (!visible) return null;

  return (
    <div className="seti-modal-overlay">
      <div className="seti-modal-content">
        <div className="seti-modal-title">
          Fin de manche {currentRound} : Choisissez une carte
        </div>
        <div style={{
          display: 'flex',
          gap: '15px',
          flexWrap: 'wrap',
          justifyContent: 'center',
          width: '100%',
          overflowY: 'auto',
          padding: '10px'
        }}>
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
                <div className="seti-card-name" style={{ fontSize: '0.75rem', lineHeight: '1.1', marginBottom: '4px', height: '2.2em', overflow: 'hidden', fontWeight: 'bold', color: '#fff' }}><span>{card.name}</span></div>
                <div style={{ fontSize: '0.75em', marginTop: '2px', display: 'flex', justifyContent: 'space-between' }}><span style={{ backgroundColor: 'rgba(0,0,0,0.3)', padding: '0 4px', borderRadius: '4px' }}>Coût: <span style={{ color: '#ffd700' }}>{card.cost}</span></span><span style={{ color: '#aaa', fontSize: '0.9em' }}>{card.type === CardType.ACTION ? 'ACT' : (card.type === CardType.END_GAME ? 'FIN' : 'MIS')}</span></div>
                {card.description && <div className="seti-card-description" style={{ flex: 1, margin: '4px 0', overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', textOverflow: 'ellipsis', fontSize: '0.7em', color: '#ccc' }}>{card.description}</div>}
                <div className="seti-card-details" style={{ display: 'flex', flexDirection: 'column', gap: '2px', marginTop: 'auto', fontSize: '0.7em', backgroundColor: 'rgba(0,0,0,0.2)', padding: '2px', borderRadius: '4px' }}><div className="seti-card-detail" style={{ display: 'flex', justifyContent: 'space-between' }}>{card.freeAction && <span>Act: {card.freeAction}</span>}{card.scanSector && <span>Scan: {card.scanSector}</span>}</div><div className="seti-card-detail">{card.revenue && <span>Rev: {card.revenue}</span>}</div></div>
              </div>
            )
          })}
        </div>
        <button
          disabled={!selectedCardId}
          onClick={() => {
            if (selectedCardId) {
              onConfirm(selectedCardId);
              setSelectedCardId(null);
            }
          }}
          className="seti-confirm-btn"
          style={{ marginTop: '30px', padding: '10px 30px', fontSize: '1.1rem', width: 'auto' }}
        >
          Confirmer et Passer
        </button>
      </div>
      {activeTooltip && (
        <Tooltip content={activeTooltip.content} targetRect={activeTooltip.rect} />
      )}
    </div>
  );
};
