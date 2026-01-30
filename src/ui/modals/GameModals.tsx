import { InteractionState, Game } from '../../core/types';
import { ScoreManager } from '../../core/ScoreManager';

export const ConfirmModal = ({ visible, message, onConfirm, onCancel }: { visible: boolean, message: string, onConfirm: () => void, onCancel: () => void }) => {
  if (!visible) return null;
  return (
    <div className="seti-modal-overlay">
      <div className="seti-modal-content-small" style={{ border: '1px solid #ff6b6b' }}>
        <h3 style={{ color: '#ff6b6b', marginTop: 0 }}>Attention</h3>
        <p style={{ color: '#ddd', marginBottom: '20px' }}>{message}</p>
        <div style={{ display: 'flex', justifyContent: 'center', gap: '10px' }}>
          <button onClick={onCancel} style={{ padding: '8px 16px', backgroundColor: '#555', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>Annuler</button>
          <button onClick={onConfirm} style={{ padding: '8px 16px', backgroundColor: '#ff6b6b', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}>Continuer quand même</button>
        </div>
      </div>
    </div>
  );
};

export const AlienDiscoveryModal = ({ visible, message }: { visible: boolean, message: string }) => {
  if (!visible) return null;
  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.85)', zIndex: 10000,
      display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column',
      animation: 'fadeIn 0.5s ease-out', backdropFilter: 'blur(5px)'
    }}>
      <div style={{
        fontSize: '2.5rem', fontWeight: 'bold', color: '#0f0',
        textShadow: '0 0 10px #0f0, 0 0 20px #0f0, 0 0 30px #0f0',
        textAlign: 'center',
        animation: 'alien-discovery-appear 0.8s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards',
        padding: '40px 60px', border: '4px solid #0f0', borderRadius: '20px',
        backgroundColor: 'rgba(0, 20, 0, 0.9)',
        boxShadow: '0 0 50px rgba(0, 255, 0, 0.5), inset 0 0 30px rgba(0, 255, 0, 0.2)',
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '20px'
      }}>
        <div style={{ fontSize: '6rem', animation: 'alien-bounce 1s infinite alternate' }}>👽</div>
        <div>{message}</div>
      </div>
      <style>{`
        @keyframes alien-discovery-appear { 0% { transform: scale(0.5); opacity: 0; } 60% { transform: scale(1.1); opacity: 1; } 100% { transform: scale(1); opacity: 1; } }
        @keyframes alien-bounce { from { transform: translateY(0); } to { transform: translateY(-10px); } }
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
      `}</style>
    </div>
  );
};

export const MediaOrMoveModal = ({ onChoice }: { onChoice: (choice: 'MEDIA' | 'MOVE') => void }) => (
  <div className="seti-modal-overlay">
    <div className="seti-modal-content-small">
      <h3 style={{ marginTop: 0, color: '#4a9eff' }}>Faites un choix</h3>
      <p style={{ marginBottom: '20px', color: '#ddd' }}>Choisissez votre bonus :</p>
      <div style={{ display: 'flex', gap: '10px', justifyContent: 'center' }}>
        <button onClick={() => onChoice('MEDIA')} style={{ padding: '15px 20px', backgroundColor: '#ff6b6b', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '5px', minWidth: '100px' }}>
          <span style={{ fontSize: '1.5em' }}>🎤</span><span>1 Média</span>
        </button>
        <button onClick={() => onChoice('MOVE')} style={{ padding: '15px 20px', backgroundColor: '#ffd700', color: '#000', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '5px', minWidth: '100px' }}>
          <span style={{ fontSize: '1.5em' }}>🚀</span><span>1 Déplacement</span>
        </button>
      </div>
    </div>
  </div>
);

export const Observation2Modal = ({ onChoice }: { onChoice: (accepted: boolean) => void }) => (
  <div className="seti-modal-overlay">
    <div className="seti-modal-content-small">
      <h3 style={{ marginTop: 0, color: '#4a9eff' }}>Observation II</h3>
      <p style={{ marginBottom: '20px', color: '#ddd' }}>Voulez-vous défausser un Média pour marquer un signal supplémentaire dans le secteur de Mercure ?</p>
      <div style={{ display: 'flex', gap: '10px', justifyContent: 'center' }}>
        <button onClick={() => onChoice(true)} style={{ padding: '10px 20px', backgroundColor: '#4caf50', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}>Oui (-1 Média)</button>
        <button onClick={() => onChoice(false)} style={{ padding: '10px 20px', backgroundColor: '#555', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>Non</button>
      </div>
    </div>
  </div>
);

export const Observation3Modal = ({ onChoice }: { onChoice: (accepted: boolean) => void }) => (
  <div className="seti-modal-overlay">
    <div className="seti-modal-content-small">
      <h3 style={{ marginTop: 0, color: '#4a9eff' }}>Observation III</h3>
      <p style={{ marginBottom: '20px', color: '#ddd' }}>Voulez-vous défausser une carte de votre main pour marquer un signal supplémentaire ?</p>
      <div style={{ display: 'flex', gap: '10px', justifyContent: 'center' }}>
        <button onClick={() => onChoice(true)} style={{ padding: '10px 20px', backgroundColor: '#4caf50', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}>Oui</button>
        <button onClick={() => onChoice(false)} style={{ padding: '10px 20px', backgroundColor: '#555', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>Non</button>
      </div>
    </div>
  </div>
);

export const Observation4Modal = ({ onChoice, canLaunch, canMove }: { onChoice: (choice: 'PROBE' | 'MOVE') => void, canLaunch: boolean, canMove: boolean }) => (
  <div className="seti-modal-overlay">
    <div className="seti-modal-content-small">
      <h3 style={{ marginTop: 0, color: '#4a9eff' }}>Observation IV</h3>
      <p style={{ marginBottom: '20px', color: '#ddd' }}>Choisissez votre bonus :</p>
      <div style={{ display: 'flex', gap: '10px', justifyContent: 'center' }}>
        <button onClick={() => onChoice('PROBE')} disabled={!canLaunch} style={{ padding: '10px 20px', backgroundColor: !canLaunch ? '#555' : '#4caf50', color: '#fff', border: 'none', borderRadius: '4px', cursor: !canLaunch ? 'not-allowed' : 'pointer', fontWeight: 'bold', opacity: !canLaunch ? 0.6 : 1 }}>Lancer une sonde (-1 Énergie)</button>
        <button onClick={() => onChoice('MOVE')} disabled={!canMove} style={{ padding: '10px 20px', backgroundColor: !canMove ? '#555' : '#ffd700', color: !canMove ? '#fff' : '#000', border: 'none', borderRadius: '4px', cursor: !canMove ? 'not-allowed' : 'pointer', fontWeight: 'bold', opacity: !canMove ? 0.6 : 1 }}>+1 Déplacement</button>
      </div>
    </div>
  </div>
);

export const BonusChoiceModal = ({ interactionState, onChoice, onFinish }: { interactionState: InteractionState, onChoice: (idx: number) => void, onFinish: () => void }) => {
  if (interactionState.type !== 'CHOOSING_BONUS_ACTION') return null;
  return (
    <div className="seti-modal-overlay">
      <div className="seti-modal-content-small" style={{ maxWidth: '500px', textAlign: 'left' }}>
        <h3 style={{ marginTop: 0, color: '#4a9eff' }}>Récompenses</h3>
        <p style={{ fontSize: '1.1em', marginBottom: '20px', color: '#ddd' }}>{interactionState.bonusesSummary}</p>
        <p style={{ fontSize: '0.9em', marginBottom: '10px', color: '#aaa' }}>Quelles actions voulez-vous effectuer ?</p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {interactionState.choices.map((choice, idx) => (
            <button key={choice.id} onClick={() => onChoice(idx)} disabled={choice.done} style={{ padding: '12px', backgroundColor: choice.done ? '#444' : '#4a9eff', color: choice.done ? '#888' : '#fff', border: 'none', borderRadius: '4px', cursor: choice.done ? 'default' : 'pointer', textAlign: 'left', fontWeight: 'bold', display: 'flex', justifyContent: 'space-between', opacity: choice.done ? 0.6 : 1 }}>
              <span>{choice.label}</span>
              {choice.done && <span>✓</span>}
            </button>
          ))}
        </div>
        {interactionState.choices.every(c => c.done) && (
          <button onClick={onFinish} style={{ marginTop: '20px', width: '100%', padding: '10px', backgroundColor: '#4caf50', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}>Terminer</button>
        )}
      </div>
    </div>
  );
}

export const EndGameModal = ({ game }: { game: Game }) => {
  const scoresData = game.players.map(p => {
    const bonuses = ScoreManager.calculateFinalScore(game, p.id);
    // Le score dans game.players est déjà le score final (mis à jour par TurnManager)
    // On recalcule le score de base pour l'affichage
    const baseScore = p.score - bonuses.total;
    return {
      player: p,
      bonuses,
      baseScore,
      total: p.score
    };
  }).sort((a, b) => b.total - a.total);

  const winner = scoresData[0];

  return (
    <div className="seti-endgame-overlay">
      <div className="seti-endgame-modal">
        <div className="seti-endgame-header">
          <h1>FIN DE PARTIE</h1>
          <div className="seti-endgame-winner">
            Vainqueur : <span style={{ color: winner.player.color }}>{winner.player.name}</span>
          </div>
        </div>
        
        <div className="seti-endgame-scores">
          <div className="seti-endgame-row header">
            <div className="col-rank">#</div>
            <div className="col-player">Joueur</div>
            <div className="col-score">Base</div>
            <div className="col-score">Obj.</div>
            <div className="col-score">Miss.</div>
            <div className="col-score">Alien</div>
            <div className="col-total">Total</div>
          </div>
          
          {scoresData.map((data, index) => (
            <div key={data.player.id} className="seti-endgame-row">
              <div className="col-rank">{index + 1}</div>
              <div className="col-player" style={{ color: data.player.color }}>{data.player.name}</div>
              <div className="col-score">{data.baseScore}</div>
              <div className="col-score">{data.bonuses.objectiveTiles}</div>
              <div className="col-score">{data.bonuses.missionEndGame}</div>
              <div className="col-score">{data.bonuses.speciesBonuses}</div>
              <div className="col-total">{data.total}</div>
            </div>
          ))}
        </div>
        
        <button className="seti-endgame-btn" onClick={() => window.location.reload()}>
          Nouvelle Partie
        </button>
      </div>
    </div>
  );
};
