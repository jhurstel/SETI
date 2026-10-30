import React, { useState } from 'react';
import { InteractionState, Game, AlienBoardType, FinalScore } from '../../core/types';
import { ScoreManager } from '../../core/ScoreManager';
import { ResourceSystem } from '../../systems/ResourceSystem';
import { CardSystem } from '../../systems/CardSystem';
import { ChoiceModal, ChoiceOption, ChoiceFooterButton } from './ChoiceModal';
import { HoverTooltip } from '../components/HoverTooltip';
import { ChoiceCardTile } from './CardPickModal';
import { Tooltip } from '../Tooltip';
import { ResourceIcon } from '../components/GameIcons';

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

export const CentaurienRewardModal = ({ game, interactionState, onChoice }: { game: Game, interactionState: InteractionState, onChoice: (index: number) => void }) => {
  if (interactionState.type !== 'CHOOSING_CENTAURIEN_REWARD') return null;

  const species = game.species.find(s => s.name === AlienBoardType.CENTAURIENS);
  if (!species || !species.message) return null;

  return (
    <ChoiceModal
      title="Message Centaurien décodé"
      subtitle="Choisissez une tuile Message encore disponible : sa récompense est gagnée immédiatement."
    >
      {species.message.map((token, index) => {
        const owner = token.claimedBy ? game.players.find(p => p.id === token.claimedBy) : undefined;
        return (
          <ChoiceOption
            key={index}
            icon="📩"
            label={(ResourceSystem.formatBonus(token.bonus) || []).join(', ')}
            onClick={() => onChoice(index)}
            disabled={!token.isAvailable}
            disabledReason={owner ? <span>Déjà choisi par <strong style={{ color: owner.color }}>{owner.name}</strong></span> : 'Déjà choisi'}
          />
        );
      })}
    </ChoiceModal>
  );
};

export const ExertienCardModal = ({ game, interactionState, onChoice }: { game: Game, interactionState: InteractionState, onChoice: (cardId?: string) => void }) => {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [activeTooltip, setActiveTooltip] = useState<{ content: React.ReactNode, rect: DOMRect } | null>(null);
  if (interactionState.type !== 'CHOOSING_EXERTIEN_CARD') return null;

  const player = game.players[game.currentPlayerIndex];
  const cards = player.cards.filter(c => CardSystem.isExertienCard(c));
  const choose = (cardId?: string) => { setSelectedId(null); setActiveTooltip(null); onChoice(cardId); };

  return (
    <>
      <ChoiceModal
        title={`Palier Exertien atteint (${interactionState.milestone} PV)`}
        subtitle={`Vous pouvez jouer une de vos cartes Exertiens face cachée. Son DANGER s'ajoute au vôtre (actuellement ${player.danger || 0}).`}
        footer={
          <>
            <ChoiceFooterButton secondary onClick={() => choose(undefined)}>Ne pas jouer de carte</ChoiceFooterButton>
            <ChoiceFooterButton onClick={() => selectedId && choose(selectedId)} disabled={!selectedId}>Jouer la carte</ChoiceFooterButton>
          </>
        }
        wide
      >
        {cards.map(card => (
          <ChoiceCardTile
            key={card.id}
            card={card}
            selected={selectedId === card.id}
            highlightedAttribute="freeAction"
            onClick={() => setSelectedId(selectedId === card.id ? null : card.id)}
            onHover={setActiveTooltip}
          />
        ))}
      </ChoiceModal>
      {activeTooltip && <Tooltip content={activeTooltip.content} targetRect={activeTooltip.rect} />}
    </>
  );
};

export const AlienDiscoveryModal =({ visible, message }: { visible: boolean, message: string }) => {
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
  <ChoiceModal title="Assistance gravitationnelle" subtitle="En arrivant sur cette planète, choisissez votre bonus.">
    <ChoiceOption icon={<ResourceIcon kind="media" size={22} />} label="1 Média" onClick={() => onChoice('MEDIA')} />
    <ChoiceOption icon={<ResourceIcon kind="movement" size={22} />} label="1 Déplacement" detail="gratuit" onClick={() => onChoice('MOVE')} />
  </ChoiceModal>
);

export const Observation2Modal = ({ onChoice }: { onChoice: (accepted: boolean) => void }) => (
  <ChoiceModal title="Observation II" subtitle="Défausser un Média pour marquer un signal supplémentaire dans le secteur de Mercure ?">
    <ChoiceOption icon="📡" label="Oui" detail="−1 Média, +1 signal (Mercure)" onClick={() => onChoice(true)} />
    <ChoiceOption icon="✋" label="Non" onClick={() => onChoice(false)} />
  </ChoiceModal>
);

export const Observation3Modal = ({ onChoice }: { onChoice: (accepted: boolean) => void }) => (
  <ChoiceModal title="Observation III" subtitle="Défausser une carte de votre main pour marquer un signal supplémentaire ?">
    <ChoiceOption icon="🃏" label="Oui" detail="une carte de la main pour son signal" onClick={() => onChoice(true)} />
    <ChoiceOption icon="✋" label="Non" onClick={() => onChoice(false)} />
  </ChoiceModal>
);

export const Observation4Modal = ({ onChoice, canLaunch, canMove }: { onChoice: (choice: 'PROBE' | 'MOVE') => void, canLaunch: boolean, canMove: boolean }) => (
  <ChoiceModal title="Observation IV" subtitle="Choisissez votre bonus.">
    <ChoiceOption icon="🛰️" label="Lancer une sonde" detail="−1 Énergie" onClick={() => onChoice('PROBE')} disabled={!canLaunch} disabledReason="Pas assez d'énergie ou limite de sondes atteinte" />
    <ChoiceOption icon="🚀" label="1 Déplacement" onClick={() => onChoice('MOVE')} disabled={!canMove} disabledReason="Aucune sonde dans le système solaire" />
  </ChoiceModal>
);

export const BonusChoiceModal = ({ interactionState, onChoice, onFinish }: { interactionState: InteractionState, onChoice: (idx: number) => void, onFinish: () => void }) => {
  if (interactionState.type !== 'CHOOSING_BONUS_ACTION') return null;
  const allDone = interactionState.choices.every(c => c.done);
  return (
    <ChoiceModal
      title="Récompenses"
      subtitle={interactionState.bonusesSummary}
      footer={allDone ? <ChoiceFooterButton onClick={onFinish}>Terminer</ChoiceFooterButton> : undefined}
    >
      {interactionState.choices.map((choice, idx) => (
        <ChoiceOption key={choice.id} label={choice.label} onClick={() => onChoice(idx)} done={choice.done} />
      ))}
    </ChoiceModal>
  );
};

/** Infobulle d'une case du décompte : une ligne par élément, puis le total */
/** Ligne d'un tableau de décompte : libellé, calcul éventuel, valeur */
type ScoreRow = { label: string; detail?: string; value: string; negative?: boolean };

/** « Libellé : 3 × 5 PV = 15 PV » → libellé, calcul « 3 × 5 PV », valeur « 15 PV » (détails enregistrés en texte par le moteur) */
const parseDetail = (line: string): ScoreRow => {
  const sep = line.indexOf(' : ');
  if (sep < 0) return { label: line, value: '' };
  const label = line.slice(0, sep);
  const rest = line.slice(sep + 3);
  const eq = rest.lastIndexOf(' = ');
  const value = eq < 0 ? rest : rest.slice(eq + 3);
  // « condition non remplie » : explication en gris, aucun point
  if (!/\d/.test(value)) return { label, detail: value, value: '0 PV' };
  return { label, detail: eq < 0 ? undefined : rest.slice(0, eq), value, negative: value.startsWith('−') };
};

/** Tableau d'une infobulle de l'écran de fin, avec une ligne Total */
const ScoreTable = ({ title, rows, total, empty = 'Aucun' }: { title: string; rows: ScoreRow[]; total?: string; empty?: string }) => (
  <table className="seti-score-table">
    <thead><tr><th colSpan={3}>{title}</th></tr></thead>
    <tbody>
      {rows.length === 0 && <tr><td colSpan={3} className="empty">{empty}</td></tr>}
      {rows.map((row, i) => (
        <tr key={i}>
          <td>{row.label}</td>
          <td className="detail">{row.detail}</td>
          <td className={`value ${row.negative ? 'negative' : ''}`}>{row.value}</td>
        </tr>
      ))}
    </tbody>
    {total !== undefined && <tfoot><tr><td colSpan={2}>Total</td><td className="value">{total}</td></tr></tfoot>}
  </table>
);

const pv = (n: number) => `${n} PV`;

/** Infobulle d'une catégorie (tuiles objectif, cartes fin de partie) */
const categoryTooltip = (title: string, lines: string[] | undefined, total: number) => (
  <ScoreTable title={title} rows={(lines || []).map(parseDetail)} total={pv(total)} />
);

/** Infobulle de la colonne Espèces : bonus d'espèces, cartes Exertiens, pénalité de danger ; puis le danger */
const speciesTooltip = (score: FinalScore) => {
  const rows = (score.details?.speciesBonuses || []).map(parseDetail);
  if (score.dangerPenalty > 0) rows.push({ label: 'Pénalité de danger', detail: '−10 %', value: `−${pv(score.dangerPenalty)}`, negative: true });
  const dangerRows = (score.details?.danger || []).map(parseDetail).filter(r => !r.negative);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
      <ScoreTable title="Espèces" rows={rows} total={pv(score.categories.speciesBonuses + score.categories.exertienCards - score.dangerPenalty)} />
      {(dangerRows.length > 0 || score.danger > 0) && (
        <ScoreTable title="Danger Exertien" rows={dangerRows} total={`danger ${score.danger}`} />
      )}
    </div>
  );
};

/** Infobulle du total : somme des colonnes */
const totalTooltip = (score: FinalScore) => {
  const rows: ScoreRow[] = [
    { label: 'Score avant décompte', value: pv(score.baseScore) },
    { label: 'Tuiles objectif', value: pv(score.categories.objectiveTiles) },
    { label: 'Cartes fin de partie', value: pv(score.categories.missionEndGame) },
    { label: 'Espèces', value: pv(score.categories.speciesBonuses + score.categories.exertienCards) },
  ];
  if (score.dangerPenalty > 0) rows.push({ label: 'Pénalité de danger', value: `−${pv(score.dangerPenalty)}`, negative: true });
  return <ScoreTable title="Score final" rows={rows} total={pv(score.finalScore)} />;
};

export const EndGameModal = ({ game }: { game: Game }) => {
  // Décompte calculé une fois par le moteur (TurnManager.endRound → ScoreManager.applyFinalScoring).
  // Anciennes sauvegardes sans décompte enregistré : seul le score final est connu.
  const emptyCategories = { missionEndGame: 0, objectiveTiles: 0, speciesBonuses: 0, exertienCards: 0, total: 0 };
  const finalScores: FinalScore[] = game.finalScores ?? game.players.map(p => ({
    playerId: p.id, baseScore: p.score, categories: emptyCategories, revealedExertienCards: [], danger: 0, dangerPenalty: 0, finalScore: p.score,
  }));
  const rows = finalScores
    .map(score => ({ score, player: game.players.find(p => p.id === score.playerId)! }))
    .sort((a, b) => b.score.finalScore - a.score.finalScore);

  const winners = ScoreManager.determineWinner(finalScores).map(id => game.players.find(p => p.id === id)!);
  const withExertienCards = rows.filter(r => r.score.revealedExertienCards.length > 0);

  return (
    <div className="seti-endgame-overlay">
      <div className="seti-endgame-modal">
        <div className="seti-endgame-header">
          <h1>FIN DE PARTIE</h1>
          <div className="seti-endgame-winner">
            {winners.length > 1 ? 'Vainqueurs ex aequo' : 'Vainqueur'} :{' '}
            {winners.map((w, i) => (
              <span key={w.id} style={{ color: w.color }}>{i > 0 ? ', ' : ''}{w.name}</span>
            ))}
          </div>
        </div>

        <div className="seti-endgame-scores">
          <div className="seti-endgame-row header">
            <div className="col-rank">#</div>
            <div className="col-player">Joueur</div>
            <div className="col-score"><HoverTooltip content="Score avant le décompte final">Base</HoverTooltip></div>
            <div className="col-score"><HoverTooltip content="Tuiles Score dorées">Obj.</HoverTooltip></div>
            <div className="col-score"><HoverTooltip content="Cartes Fin de partie">Fin</HoverTooltip></div>
            <div className="col-score"><HoverTooltip content="Espèces : bonus d'espèces, cartes Exertiens, pénalité de danger">Espèces</HoverTooltip></div>
            <div className="col-total">Total</div>
          </div>

          {rows.map(({ score, player }, index) => (
            <div key={player.id} className="seti-endgame-row">
              <div className="col-rank">{index + 1}</div>
              <div className="col-player" style={{ color: player.color }}>{player.name}</div>
              <div className="col-score"><HoverTooltip content="Score avant le décompte final">{score.baseScore}</HoverTooltip></div>
              <div className="col-score"><HoverTooltip content={categoryTooltip('Tuiles objectif', score.details?.objectiveTiles, score.categories.objectiveTiles)}>{score.categories.objectiveTiles}</HoverTooltip></div>
              <div className="col-score"><HoverTooltip content={categoryTooltip('Cartes fin de partie', score.details?.missionEndGame, score.categories.missionEndGame)}>{score.categories.missionEndGame}</HoverTooltip></div>
              <div className="col-score" style={score.dangerPenalty > 0 ? { color: '#ff6b6b' } : undefined}>
                <HoverTooltip content={speciesTooltip(score)}>{score.categories.speciesBonuses + score.categories.exertienCards - score.dangerPenalty}</HoverTooltip>
              </div>
              <div className="col-total"><HoverTooltip content={totalTooltip(score)}>{score.finalScore}</HoverTooltip></div>
            </div>
          ))}
        </div>

        {withExertienCards.length > 0 && (
          <div className="seti-endgame-exertiens">
            <div className="seti-endgame-exertiens-title">Cartes Exertiens révélées</div>
            {withExertienCards.map(({ score, player }) => (
              <div key={player.id} className="seti-endgame-exertiens-row">
                <span style={{ color: player.color, fontWeight: 'bold' }}>{player.name} :</span>{' '}
                {score.revealedExertienCards.map(c => `${c.name} (danger ${c.danger}, ${c.conditionMet ? `+${c.points} PV` : 'non remplie'})`).join(' · ')}
              </div>
            ))}
            <div className="seti-endgame-exertiens-note">
              Le joueur le plus exposé au danger perd 10 % de son total (arrondi à l'inférieur) ; en cas d'égalité, tous les ex aequo.
            </div>
          </div>
        )}

        <button className="seti-endgame-btn" onClick={() => window.location.reload()}>
          Nouvelle Partie
        </button>
      </div>
    </div>
  );
};
