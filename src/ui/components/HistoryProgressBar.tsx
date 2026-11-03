import React from 'react';
import { TimelineRound } from '../../core/historyTimeline';
import { revealText } from '../../core/historyText';
import { HoverTooltip } from './HoverTooltip';
import './HistoryProgressBar.css';

interface Props {
  rounds: TimelineRound[];
  maxRounds: number;
  players: { id: string; name: string; color: string }[];
  /** Clic sur un tour ou une manche : indice de l'entrée de l'historique (séparateur du tour ou de la manche). Absent : non cliquable */
  onSelect?: (entryIndex: number) => void;
  /** Barre fine sur une ligne (accueil) ; sinon une ligne par manche (fin de partie) */
  compact?: boolean;
}

/** Message d'action lisible dans une infobulle (passages privés du jeu local, balises retirées) */
const actionText = (message: string) => revealText(message).replace(/<\/?strong>/g, '');

/**
 * Résumé de la partie : un trait plein de la couleur du joueur par tour, tous de même longueur.
 * Compact (accueil) : une barre, un trait gris au début de chaque manche ; la manche en cours et les manches
 * à venir gardent la place des tours attendus (estimés d'après les manches terminées) : la barre montre où en est la partie.
 * Sinon (fin de partie) : une ligne par manche, les tours alignés en colonnes.
 */
export const HistoryProgressBar: React.FC<Props> = ({ rounds, maxRounds, players, onSelect, compact }) => {
  const finished = rounds.filter(r => r.complete && r.turns.length > 0);
  const expectedTurns = finished.length > 0 ? finished.reduce((sum, r) => sum + r.turns.length, 0) / finished.length : players.length * 4;

  const turnTooltip = (turn: TimelineRound['turns'][number]) => {
    const player = players.find(p => p.id === turn.playerId);
    return (
      <span>
        <strong style={{ color: player?.color }}>{player?.name ?? 'Joueur'}</strong>
        {turn.action ? ` : ${actionText(turn.action)}` : ''}
      </span>
    );
  };
  const colorOf = (playerId: string) => players.find(p => p.id === playerId)?.color ?? '#888';
  const hit = (entryIndex: number, color: string | undefined, label?: string) => onSelect
    ? <button type="button" className="seti-progress-hit" onClick={e => { e.stopPropagation(); onSelect(entryIndex); }} aria-label={label}><span style={{ background: color }} /></button>
    : <span className="seti-progress-hit"><span style={{ background: color }} /></span>;

  if (!compact) {
    const roundCount = Math.max(maxRounds, rounds.length, 1);
    const columns = Math.max(players.length, ...rounds.map(r => r.turns.length));
    return (
      <div className="seti-progress-rounds">
        {Array.from({ length: roundCount }, (_, r) => {
          const round = rounds[r];
          return (
            <div key={r} className={`seti-progress-round ${round ? '' : 'future'}`}>
              {round && onSelect
                ? <button type="button" className="seti-progress-round-label" onClick={e => { e.stopPropagation(); onSelect(round.entryIndex); }}>Manche {r + 1}</button>
                : <span className="seti-progress-round-label">Manche {r + 1}</span>}
              <div className="seti-progress-round-turns" style={{ gridTemplateColumns: `repeat(${columns}, 1fr)` }}>
                {round?.turns.map(turn => (
                  <HoverTooltip key={turn.entryIndex} content={turnTooltip(turn)} className="seti-progress-chip">
                    {hit(turn.entryIndex, colorOf(turn.playerId))}
                  </HoverTooltip>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    );
  }

  // Nombre de tours de chaque manche (attendus pour la manche en cours et celles à venir) : même largeur pour chaque tour
  const roundSlots = rounds.map(round => round.complete ? round.turns.length : Math.max(round.turns.length, Math.round(expectedTurns)));
  const futureSlots = Math.max(0, maxRounds - rounds.length) * Math.round(expectedTurns);
  const totalSlots = roundSlots.reduce((sum, n) => sum + n, 0) + futureSlots;
  const turnWidth = totalSlots > 0 ? 100 / totalSlots : 0;
  const starts = roundSlots.map((_, r) => roundSlots.slice(0, r).reduce((sum, n) => sum + n, 0));

  const mark = (key: string, left: number, width: number, className: string, color: string | undefined, tooltip: React.ReactNode, entryIndex: number) => (
    <HoverTooltip key={key} content={tooltip} className={`seti-progress-mark ${className}`} style={{ left: `${left}%`, width: `${width}%` }}>
      {hit(entryIndex, color, typeof tooltip === 'string' ? tooltip : undefined)}
    </HoverTooltip>
  );

  return (
    <div className="seti-progress-bar compact">
      {rounds.map((round, r) => {
        const start = starts[r] * turnWidth;
        return (
          <React.Fragment key={round.entryIndex}>
            {mark(`round-${round.entryIndex}`, start, 0, 'round', undefined, `Manche ${round.round}`, round.entryIndex)}
            {round.turns.map((turn, t) => mark(`turn-${turn.entryIndex}`, start + t * turnWidth, turnWidth, 'turn', colorOf(turn.playerId), turnTooltip(turn), turn.entryIndex))}
          </React.Fragment>
        );
      })}
    </div>
  );
};
