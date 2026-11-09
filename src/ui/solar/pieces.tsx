import React from 'react';
import { Game, Probe, ProbeState } from '../../core/types';
import { specimenRewardText } from './cellPieces';

/**
 * Sondes et capsules d'une case, regroupées par joueur (une ligne par joueur, à sa couleur) ; la récompense du
 * spécimen d'une capsule n'est montrée qu'à son propriétaire (`viewerId`)
 */
export const PiecesSummary: React.FC<{ game: Game; pieces: Probe[]; viewerId: string | undefined }> = ({ game, pieces, viewerId }) => {
  if (pieces.length === 0) return null;
  return (
    <div className="solar-pieces-summary">
      {game.players.filter(pl => pieces.some(p => p.ownerId === pl.id)).map(pl => {
        const mine = pieces.filter(p => p.ownerId === pl.id);
        const probes = mine.filter(p => p.state !== ProbeState.CAPSULE).length;
        const capsules = mine.filter(p => p.state === ProbeState.CAPSULE);
        const parts: string[] = [];
        if (probes > 0) parts.push(`${probes} sonde${probes > 1 ? 's' : ''}`);
        capsules.forEach(c => {
          const reward = c.specimen ? specimenRewardText(c.specimen.bonus, c.ownerId === viewerId) : '';
          parts.push(`1 capsule${reward ? ` (spécimen : ${reward})` : ''}`);
        });
        return (
          <div key={pl.id} className="solar-pieces-line">
            <strong style={{ color: pl.color }}>{pl.name}</strong> : {parts.join(', ')}
          </div>
        );
      })}
    </div>
  );
};
