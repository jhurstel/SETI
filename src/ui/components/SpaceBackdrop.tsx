import React from 'react';
import '../HomeScreen.css';

/** Planètes décoratives sur les orbites : rayon (vmin), taille (px), couleur, durée d'un tour (s), départ (°) */
const ORBITS = [
  { radius: 30, size: 9, color: '#c9a37a', duration: 80, start: 320 },
  { radius: 46, size: 13, color: '#4a9eff', duration: 130, start: 20 },
  { radius: 64, size: 18, color: '#e0b56a', duration: 190, start: 300 },
  { radius: 84, size: 11, color: '#b2e4ff', duration: 260, start: 50 },
];

/**
 * Fond de l'accueil : nébuleuses, trois couches d'étoiles qui scintillent, orbites lentes autour d'un soleil (en bas de l'écran, comme un horizon)
 * et balayage d'un radiotélescope. Purement décoratif (aria-hidden), animations coupées si le système le demande.
 */
export const SpaceBackdrop: React.FC<{ overGame?: boolean }> = ({ overGame = false }) => (
  /* overGame : au-dessus de la partie en cours, sous les fenêtres (Nouvelle partie, Partie en ligne ouvertes depuis l'accueil) */
  <div className={`seti-space${overGame ? ' over-game' : ''}`} aria-hidden="true">
    <div className="seti-space-nebula" />
    <div className="seti-space-stars small" />
    <div className="seti-space-stars medium" />
    <div className="seti-space-stars large" />
    <div className="seti-space-system">
      <div className="seti-space-sun" />
      {ORBITS.map((orbit, index) => (
        <div
          key={index}
          className="seti-space-orbit"
          style={{
            width: `${orbit.radius * 2}vmin`,
            height: `${orbit.radius * 2}vmin`,
            animationDuration: `${orbit.duration}s`,
            transform: `translate(-50%, -50%) rotate(${orbit.start}deg)`,
            ['--start' as string]: `${orbit.start}deg`,
          }}
        >
          <span
            className="seti-space-planet"
            style={{ width: orbit.size, height: orbit.size, background: orbit.color, boxShadow: `0 0 ${orbit.size}px ${orbit.color}` }}
          />
        </div>
      ))}
      <div className="seti-space-sweep" />
    </div>
    <div className="seti-space-vignette" />
  </div>
);
