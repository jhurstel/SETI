import React, { useEffect } from 'react';
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
}

/**
 * Bande qui glisse au centre de l'écran puis s'efface d'elle-même. Elle ne bloque pas le plateau : seul un clic
 * sur la bande la ferme plus tôt.
 */
export const Announcement = ({ announcement, onDone }: { announcement: AnnouncementContent | null; onDone: () => void }) => {
  useEffect(() => {
    if (!announcement) return;
    const timer = setTimeout(onDone, announcement.duration);
    return () => clearTimeout(timer);
  }, [announcement, onDone]);

  if (!announcement) return null;
  const { key, kicker, title, subtitle, color, size, duration, icon } = announcement;
  return (
    <div className="seti-announcement-layer" aria-live="polite">
      <div
        key={key}
        className={`seti-announcement seti-announcement-${size}`}
        style={{ '--announce-color': color, '--announce-duration': `${duration}ms` } as React.CSSProperties}
        onClick={onDone}
      >
        {icon && <div className="seti-announcement-icon" aria-hidden="true">{icon}</div>}
        <div className="seti-announcement-kicker">{kicker}</div>
        <div className="seti-announcement-title">{title}</div>
        {subtitle && <div className="seti-announcement-subtitle">{subtitle}</div>}
      </div>
    </div>
  );
};
