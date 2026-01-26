import React, { useState, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Game, Card, InteractionState } from '../core/types';

interface DebugPanelProps {
  game: Game;
  setGame: (game: Game) => void;
  onHistory: (msg: string, playerId?: string, previousState?: Game) => void;
  interactionState: InteractionState;
}

export const DebugPanel: React.FC<DebugPanelProps> = ({ 
  game, 
  setGame, 
  onHistory, 
  interactionState 
}) => {
  const [cardId, setCardId] = useState('');
  const [amount, setAmount] = useState(1);
  const [isVisible, setIsVisible] = useState(true);
  const [position, setPosition] = useState({ x: 20, y: 150 });
  const panelRef = useRef<HTMLDivElement>(null);
  const offsetRef = useRef({ x: 0, y: 0 });

  const handleMouseDown = (e: React.MouseEvent) => {
    if (panelRef.current && (e.target as HTMLElement).dataset.dragHandle) {
      offsetRef.current = {
        x: e.clientX - panelRef.current.getBoundingClientRect().left,
        y: e.clientY - panelRef.current.getBoundingClientRect().top,
      };
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    }
  };

  const handleMouseMove = (e: MouseEvent) => {
    setPosition({
      x: e.clientX - offsetRef.current.x,
      y: e.clientY - offsetRef.current.y,
    });
  };

  const handleMouseUp = () => {
    document.removeEventListener('mousemove', handleMouseMove);
    document.removeEventListener('mouseup', handleMouseUp);
  };

  const handleAddResource = (resourceType: 'credits' | 'energy' | 'mediaCoverage' | 'data') => {
    const updatedGame = structuredClone(game);
    const player = updatedGame.players[updatedGame.currentPlayerIndex];
    player[resourceType] = (player[resourceType] || 0) + amount;
    setGame(updatedGame);
    onHistory(`DEBUG: Added ${amount} ${resourceType} to ${player.name}`, player.id, updatedGame);
  };

  const handleAddCard = () => {
    const updatedGame = structuredClone(game);
    const player = updatedGame.players[updatedGame.currentPlayerIndex];
    const cardToFind = cardId.toLowerCase();

    const allCards: Card[] = [
        ...(updatedGame.decks.cards || []),
        ...(updatedGame.decks.cardRow || []),
        ...(updatedGame.decks.discardPile || []),
        ...Object.values(updatedGame.decks.roundDecks || {}).flat()
    ];
    
    const card = allCards.find(c => c.id === cardId || c.name.toLowerCase().includes(cardToFind));
    
    if (card) {
      player.cards.push(structuredClone(card));
      setGame(updatedGame);
      onHistory(`DEBUG: Added card "${card.name}" to ${player.name}`, player.id, updatedGame);
    } else {
      onHistory(`DEBUG: Card with ID/name part "${cardId}" not found.`, player.id, updatedGame);
    }
  };

  if (process.env.NODE_ENV !== 'development') {
    return null;
  }

  if (!isVisible) {
    return createPortal(<button onClick={() => setIsVisible(true)} style={{position: 'fixed', top: '10px', left: '10px', zIndex: 10000, padding: '5px 10px'}}>Debug</button>, document.body);
  }

  return createPortal(
    <div 
      ref={panelRef}
      style={{ 
        position: 'fixed', top: position.y, left: position.x, zIndex: 10000, background: 'rgba(40, 40, 60, 0.9)', 
        border: '1px solid #78a0ff', borderRadius: '8px', padding: '10px', color: 'white', width: '250px',
        boxShadow: '0 5px 15px rgba(0,0,0,0.5)', backdropFilter: 'blur(5px)', fontFamily: 'sans-serif', fontSize: '14px'
      }}
    >
      <div 
        data-drag-handle="true"
        style={{ cursor: 'move', paddingBottom: '10px', borderBottom: '1px solid #555', marginBottom: '10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
        onMouseDown={handleMouseDown}
      >
        <strong>Debug Panel</strong>
        <button onClick={() => setIsVisible(false)} style={{background: 'none', border: '1px solid #777', borderRadius: '4px', color: 'white', cursor: 'pointer', padding: '2px 6px'}}>X</button>
      </div>
      
      <div style={{display: 'flex', flexDirection: 'column', gap: '10px'}}>
        <div>
          <label>Amount: </label>
          <input type="number" value={amount} onChange={e => setAmount(parseInt(e.target.value, 10) || 0)} style={{width: '60px', background: '#222', color: 'white', border: '1px solid #555', borderRadius: '4px', padding: '4px'}} />
        </div>
        <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '5px'}}>
          <button onClick={() => handleAddResource('credits')}>+ Credits</button>
          <button onClick={() => handleAddResource('energy')}>+ Energy</button>
          <button onClick={() => handleAddResource('mediaCoverage')}>+ Media</button>
          <button onClick={() => handleAddResource('data')}>+ Data</button>
        </div>
        <div>
          <input type="text" value={cardId} onChange={e => setCardId(e.target.value)} placeholder="Card ID/Name" style={{width: '100%', boxSizing: 'border-box', background: '#222', color: 'white', border: '1px solid #555', borderRadius: '4px', padding: '4px', marginTop: '4px'}} />
          <button onClick={handleAddCard} style={{width: '100%', marginTop: '5px'}}>Add Card to Hand</button>
        </div>
        <div style={{ marginTop: '10px', borderTop: '1px solid #555', paddingTop: '5px' }}>
          <div style={{ fontSize: '0.8em', color: '#aaa' }}>Interaction State:</div>
          <div style={{ color: '#4a9eff', fontWeight: 'bold', fontSize: '0.9em' }}>{interactionState.type}</div>
          {interactionState.type !== 'IDLE' && (
             <pre style={{ fontSize: '0.7em', color: '#ccc', overflowX: 'auto', whiteSpace: 'pre-wrap', maxHeight: '100px', overflowY: 'auto', margin: '5px 0 0 0' }}>
               {JSON.stringify(interactionState, (k, v) => k === 'type' ? undefined : v, 2)}
             </pre>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
};
