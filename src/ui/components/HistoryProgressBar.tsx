import React from 'react';
import { TimelineRound } from '../../core/historyTimeline';
import { revealText } from '../../core/historyText';
import { HoverTooltip } from './HoverTooltip';
import './HistoryProgressBar.css';

interface Props {
  rounds: TimelineRound[];
  maxRounds: number;
  players: { id: string; name: string; color: string }[];
  /** Clic sur un trait : indice de l'entrée de l'historique (séparateur du tour ou de la manche). Absent : barre non cliquable */
  onSelect?: (entryIndex: number) => void;
  /** Barre fine (accueil) */
  compact?: boolean;
}

/** Message d'action lisible dans une infobulle (passages privés du jeu local, balises retirées) */
const actionText = (message: string) => revealText(message).replace(/<\/?strong>/g, '');

/**
 * Barre de progression de la partie : une part par manche (trait gris au début de chaque manche),
 * un trait de la couleur du joueur par tour. La manche en cours garde la place des tours à venir,
 * estimée d'après les manches terminées : la barre montre où en est la partie.
 */
export const HistoryProgressBar: React.FC<Props> = ({ rounds, maxRounds, players, onSelect, compact }) => {
  const slice = 100 / Math.max(maxRounds, rounds.length, 1);
  const finished = rounds.filter(r => r.complete && r.turns.length > 0);
  const expectedTurns = finished.length > 0 ? finished.reduce((sum, r) => sum + r.turns.length, 0) / finished.length : players.length * 4;

  const mark = (key: string, left: number, width: number, className: string, color: string | undefined, tooltip: React.ReactNode, entryIndex: number) => (
    <HoverTooltip key={key} content={tooltip} className={`seti-progress-mark ${className}`} style={{ left: `${left}%`, width: `${width}%` }}>
      {onSelect
        ? <button type="button" className="seti-progress-hit" onClick={e => { e.stopPropagation(); onSelect(entryIndex); }} aria-label={typeof tooltip === 'string' ? tooltip : undefined}><span style={{ background: color }} /></button>
        : <span className="seti-progress-hit"><span style={{ background: color }} /></span>}
    </HoverTooltip>
  );

  return (
    <div className={`seti-progress-bar ${compact ? 'compact' : ''}`}>
      {rounds.map((round, r) => {
        const start = r * slice;
        const slots = round.complete ? round.turns.length : Math.max(round.turns.length, Math.round(expectedTurns));
        const turnWidth = slots > 0 ? slice / slots : 0;
        return (
          <React.Fragment key={round.entryIndex}>
            {mark(`round-${round.entryIndex}`, start, 0, 'round', undefined, `Manche ${round.round}`, round.entryIndex)}
            {round.turns.map((turn, t) => {
              const player = players.find(p => p.id === turn.playerId);
              const tooltip = (
                <span>
                  <strong style={{ color: player?.color }}>{player?.name ?? 'Joueur'}</strong>
                  {turn.action ? ` : ${actionText(turn.action)}` : ''}
                </span>
              );
              return mark(`turn-${turn.entryIndex}`, start + t * turnWidth, turnWidth, 'turn', player?.color ?? '#888', tooltip, turn.entryIndex);
            })}
          </React.Fragment>
        );
      })}
    </div>
  );
};
