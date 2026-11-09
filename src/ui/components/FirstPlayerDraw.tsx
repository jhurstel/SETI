import React, { useEffect, useRef, useState } from 'react';
import { Player } from '../../core/types';
import { PlayerKindIcon } from './PlayerKindIcon';
import './FirstPlayerDraw.css';

/** Durée du balayage (ms), puis temps d'affichage du résultat avant fermeture automatique */
const SWEEP_MS = 2800;
const RESULT_MS = 1800;
/** Tours complets du faisceau avant de se verrouiller sur le premier joueur */
const TURNS = 2;

const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);
/** Écart angulaire (0 à 180°) entre deux directions */
const angleGap = (a: number, b: number) => {
  const d = Math.abs(((a - b) % 360 + 360) % 360);
  return d > 180 ? 360 - d : d;
};

/**
 * Tirage du premier joueur, au démarrage d'une partie : les joueurs sont des signaux autour d'un radiotélescope ;
 * le faisceau tourne, ralentit et se verrouille sur le premier joueur (onde à sa couleur), puis « X commence ! ».
 * Le tirage est déjà fait par le moteur (`firstPlayerIndex`) : l'animation ne fait que l'annoncer. Un clic ferme.
 */
export const FirstPlayerDraw: React.FC<{ players: Player[]; firstIndex: number; meId?: string; onDone: () => void }> = ({ players, firstIndex, meId, onDone }) => {
  const reduced = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  // Joueurs répartis autour du radar, le premier en haut
  const angleOf = (index: number) => (index * 360) / players.length - 90;
  const target = angleOf(firstIndex);
  const finalAngle = target + TURNS * 360;
  const [angle, setAngle] = useState(reduced ? finalAngle : -90);
  const [locked, setLocked] = useState(!!reduced);
  const doneRef = useRef(onDone);
  doneRef.current = onDone;

  useEffect(() => {
    if (reduced) return;
    let frame = 0;
    const start = performance.now();
    const step = (now: number) => {
      const t = Math.min(1, (now - start) / SWEEP_MS);
      setAngle(-90 + (finalAngle + 90) * easeOutCubic(t));
      if (t < 1) frame = requestAnimationFrame(step);
      else setLocked(true);
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [finalAngle, reduced]);

  // Résultat affiché un moment, puis fermeture
  useEffect(() => {
    if (!locked) return;
    const timer = setTimeout(() => doneRef.current(), RESULT_MS);
    return () => clearTimeout(timer);
  }, [locked]);

  const first = players[firstIndex];
  const size = 300;
  const center = size / 2;
  const radius = 112;

  return (
    <div className="seti-draw-overlay" role="dialog" aria-modal="true" aria-label="Tirage du premier joueur" onClick={() => onDone()}>
      <div className="seti-draw-box">
        <div className="seti-draw-title">Tirage du premier joueur</div>
        <div className="seti-draw-radar" style={{ width: size, height: size }}>
          <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
            <defs>
              <radialGradient id="seti-draw-bg">
                <stop offset="0%" stopColor="rgba(40, 120, 200, 0.25)" />
                <stop offset="100%" stopColor="rgba(10, 20, 40, 0.1)" />
              </radialGradient>
              <linearGradient id="seti-draw-beam" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor="rgba(111, 195, 255, 0)" />
                <stop offset="100%" stopColor="rgba(111, 195, 255, 0.55)" />
              </linearGradient>
            </defs>
            <circle cx={center} cy={center} r={radius + 26} fill="url(#seti-draw-bg)" stroke="rgba(111, 195, 255, 0.35)" />
            {[0.33, 0.66, 1].map(f => <circle key={f} cx={center} cy={center} r={(radius + 26) * f} fill="none" stroke="rgba(111, 195, 255, 0.15)" />)}
            <line x1={center - radius - 26} y1={center} x2={center + radius + 26} y2={center} stroke="rgba(111, 195, 255, 0.1)" />
            <line x1={center} y1={center - radius - 26} x2={center} y2={center + radius + 26} stroke="rgba(111, 195, 255, 0.1)" />
            {/* Faisceau : un secteur de 40° qui traîne derrière la direction balayée */}
            {!locked && (
              <g transform={`rotate(${angle} ${center} ${center})`}>
                <path d={`M ${center} ${center} L ${center + radius + 26} ${center} A ${radius + 26} ${radius + 26} 0 0 0 ${center + (radius + 26) * Math.cos((-40 * Math.PI) / 180)} ${center + (radius + 26) * Math.sin((-40 * Math.PI) / 180)} Z`} fill="url(#seti-draw-beam)" />
                <line x1={center} y1={center} x2={center + radius + 26} y2={center} stroke="#9fdcff" strokeWidth="2" />
              </g>
            )}
            <circle cx={center} cy={center} r="6" fill="#9fdcff" />
            {players.map((p, i) => {
              const a = (angleOf(i) * Math.PI) / 180;
              const x = center + radius * Math.cos(a);
              const y = center + radius * Math.sin(a);
              // Signal éclairé au passage du faisceau, plein une fois verrouillé
              const glow = locked ? (i === firstIndex ? 1 : 0.25) : Math.max(0.25, 1 - angleGap(angle, angleOf(i)) / 50);
              return (
                <g key={p.id}>
                  {locked && i === firstIndex && (
                    <>
                      <circle className="seti-draw-ping" cx={x} cy={y} r="10" fill="none" stroke={p.color} strokeWidth="3" />
                      <circle className="seti-draw-ping delayed" cx={x} cy={y} r="10" fill="none" stroke={p.color} strokeWidth="2" />
                    </>
                  )}
                  <circle cx={x} cy={y} r={i === firstIndex && locked ? 11 : 8} fill={p.color} opacity={glow} style={{ filter: `drop-shadow(0 0 ${6 * glow}px ${p.color})` }} />
                </g>
              );
            })}
          </svg>
          {/* Noms des joueurs, à côté de leur signal */}
          {players.map((p, i) => {
            const a = (angleOf(i) * Math.PI) / 180;
            const x = center + (radius + 40) * Math.cos(a);
            const y = center + (radius + 40) * Math.sin(a);
            return (
              <span key={p.id} className={`seti-draw-name ${locked && i === firstIndex ? 'chosen' : ''}`} style={{ left: x, top: y, color: p.color }}>
                {p.name}
              </span>
            );
          })}
        </div>
        <div className={`seti-draw-result ${locked ? 'visible' : ''}`} style={{ color: first.color }} aria-live="polite">
          {locked && (
            <>
              <PlayerKindIcon player={first} />
              <span>{first.id === meId ? 'Vous commencez !' : `${first.name} commence !`}</span>
              <span aria-hidden="true">👑</span>
            </>
          )}
        </div>
        <div className="seti-draw-hint">Cliquez pour continuer</div>
      </div>
    </div>
  );
};
