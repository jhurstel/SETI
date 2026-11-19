import React, { useEffect, useRef } from 'react';
import './Announcement.css';

/** Annonce affichée au centre de l'écran : début de tour d'un joueur, découverte d'une espèce */
export interface AnnouncementContent {
  /** Identifiant de l'annonce : une nouvelle annonce relance l'animation */
  key: string;
  /** Petite ligne au-dessus du titre (« Manche 2 », « Nouvelle espèce ») */
  kicker: string;
  title: string;
  subtitle?: string;
  /** Couleur de la bande (couleur du joueur, de la découverte) */
  color: string;
  /** Grande bande (votre tour, découverte) ou bande réduite (tour d'un autre joueur) */
  size: 'large' | 'compact';
  /** Durée d'affichage en millisecondes */
  duration: number;
  icon?: React.ReactNode;
  /** Bouton de la bande (découverte : ouvrir le chapitre du tutoriel de l'espèce) */
  action?: { label: string; onClick: () => void };
}

/**
 * Bande qui glisse au centre de l'écran puis s'efface d'elle-même. Elle ne bloque pas le plateau : un clic sur la bande
 * ou Échap la ferme plus tôt. Avec un bouton, elle reste affichée tant que la souris est dessus (le temps de cliquer).
 */
export const Announcement = ({ announcement, onDone }: { announcement: AnnouncementContent | null; onDone: () => void }) => {
  // Temps d'affichage restant : le survol le suspend, la sortie de la bande le reprend
  const remaining = useRef(0);
  const startedAt = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const start = (ms: number) => {
    clearTimeout(timer.current);
    startedAt.current = Date.now();
    remaining.current = ms;
    timer.current = setTimeout(onDone, ms);
  };
  useEffect(() => {
    if (!announcement) return;
    start(announcement.duration);
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onDone(); };
    window.addEventListener('keydown', onKey);
    return () => { clearTimeout(timer.current); window.removeEventListener('keydown', onKey); };
    // start ne dépend que de onDone : relancé avec l'annonce
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [announcement?.key, onDone]);

  if (!announcement) return null;
  const { key, kicker, title, subtitle, color, size, duration, icon, action } = announcement;
  const pause = () => {
    if (!action) return;
    clearTimeout(timer.current);
    remaining.current = Math.max(remaining.current - (Date.now() - startedAt.current), 0);
  };
  const resume = () => { if (action) start(Math.max(remaining.current, 1500)); };
  return (
    <div className="seti-announcement-layer" aria-live="polite">
      <div
        key={key}
        className={`seti-announcement seti-announcement-${size}${action ? ' with-action' : ''}`}
        style={{ '--announce-color': color, '--announce-duration': `${duration}ms` } as React.CSSProperties}
        onClick={onDone}
        onMouseEnter={pause}
        onMouseLeave={resume}
      >
        {icon && <div className="seti-announcement-icon" aria-hidden="true">{icon}</div>}
        <div className="seti-announcement-kicker">{kicker}</div>
        <div className="seti-announcement-title">{title}</div>
        {subtitle && <div className="seti-announcement-subtitle">{subtitle}</div>}
        {action && (
          <button type="button" className="seti-modal-btn seti-announcement-action"
            onClick={e => { e.stopPropagation(); onDone(); action.onClick(); }}>
            {action.label}
          </button>
        )}
      </div>
    </div>
  );
};
