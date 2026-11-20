import React, { useEffect, useState } from 'react';
import { ErrorLogEntry, subscribeErrors } from '../errorLog';
import '../modals/BugReportModal.css';

/**
 * Message discret d'une erreur hors de l'affichage (action, tâche de fond, promesse rejetée) : la partie reste
 * jouable, le joueur peut signaler le problème. Une erreur identique répétée n'en affiche pas de nouveau.
 */
export const ErrorNotice: React.FC<{ onReport: () => void; hidden?: boolean }> = ({ onReport, hidden }) => {
  const [notice, setNotice] = useState<ErrorLogEntry | null>(null);
  useEffect(() => subscribeErrors((entry, repeated) => { if (!repeated) setNotice(entry); }), []);
  if (!notice || hidden) return null;
  return (
    <div className="seti-error-notice" role="alert">
      <span>Un problème est survenu.</span>
      <button type="button" className="seti-error-notice-report" onClick={() => { setNotice(null); onReport(); }}>Signaler</button>
      <button type="button" className="seti-error-notice-close" aria-label="Fermer" onClick={() => setNotice(null)}>×</button>
    </div>
  );
};
