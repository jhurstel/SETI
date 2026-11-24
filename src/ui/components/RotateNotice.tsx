import React from 'react';

/**
 * Téléphone tenu en paysage : le jeu ne se joue qu'en portrait, un message par-dessus tout l'écran demande de tourner
 * le téléphone (CSS : `.seti-rotate-notice`, affiché seulement sur écran tactile, en paysage, de faible hauteur).
 */
export const RotateNotice: React.FC = () => (
  <div className="seti-rotate-notice" role="alert" aria-live="polite">
    <svg width={56} height={56} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x={7} y={2.5} width={10} height={19} rx={2} />
      <line x1={11} y1={18.5} x2={13} y2={18.5} />
      <path d="M2.5 9 A9.5 9.5 0 0 1 6 4" />
      <path d="M6 4 L6.3 6.6 M6 4 L3.5 4.6" />
    </svg>
    <div className="seti-rotate-notice-title">Tournez votre téléphone</div>
    <div className="seti-rotate-notice-text">SETI se joue en mode portrait.</div>
  </div>
);
