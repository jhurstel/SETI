import React, { useEffect, useState } from 'react';
import { BugReport, bugReportFileName } from '../bugReport';
import { downloadJson } from '../download';
import './BugReportModal.css';

interface BugReportModalProps {
  /** Construit le rapport au moment du téléchargement (partie et erreurs à jour) */
  buildReport: (comment: string) => BugReport;
  onClose: () => void;
}

/**
 * Signaler un problème : commentaire facultatif, puis téléchargement du rapport (JSON) que le joueur envoie
 * lui-même. Autonome (ses propres styles) : ouverte aussi depuis l'écran d'erreur, quand le reste de l'interface a échoué.
 */
export const BugReportModal: React.FC<BugReportModalProps> = ({ buildReport, onClose }) => {
  const [comment, setComment] = useState('');
  const [saved, setSaved] = useState<string | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const download = async () => {
    setError('');
    try {
      const fileName = bugReportFileName();
      const content = JSON.stringify(buildReport(comment), null, 2);
      if (await downloadJson(content, fileName, 'Rapport de problème SETI')) setSaved(fileName);
    } catch (e) {
      setError(`Le rapport n'a pas pu être créé : ${(e as Error).message}`);
    }
  };

  return (
    <div className="seti-report-overlay" onClick={onClose}>
      <div className="seti-report-panel" role="dialog" aria-modal="true" aria-labelledby="seti-report-title" onClick={e => e.stopPropagation()}>
        <h2 id="seti-report-title">Signaler un problème</h2>
        {saved ? (
          <>
            <p>Rapport enregistré : <strong>{saved}</strong></p>
            <p>Envoyez ce fichier au développeur (message, e-mail…). Merci !</p>
            <div className="seti-report-actions">
              <button type="button" className="seti-report-btn primary" onClick={onClose}>Fermer</button>
            </div>
          </>
        ) : (
          <>
            <label className="seti-report-label" htmlFor="seti-report-comment">Que s'est-il passé ? (facultatif)</label>
            <textarea id="seti-report-comment" className="seti-report-comment" rows={4} value={comment} maxLength={2000}
              placeholder="Ce que vous faisiez, ce que vous attendiez, ce qui s'est passé…" onChange={e => setComment(e.target.value)} />
            <p className="seti-report-note">
              Le rapport contient la version du jeu, votre navigateur, les dernières erreurs et la partie en cours
              (en ligne : seulement ce que vous voyez). Rien n'est envoyé automatiquement : vous téléchargez le fichier
              et l'envoyez vous-même.
            </p>
            {error && <p className="seti-report-error" role="alert">{error}</p>}
            <div className="seti-report-actions">
              <button type="button" className="seti-report-btn" onClick={onClose}>Annuler</button>
              <button type="button" className="seti-report-btn primary" onClick={download}>Télécharger le rapport</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};
