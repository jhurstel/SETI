import React from 'react';
import { listErrors, recordError } from '../errorLog';
import { browserEnv, buildBugReport } from '../bugReport';
import { readAutosave } from '../hooks/useAutosave';
import { BugReportModal } from '../modals/BugReportModal';
import '../modals/BugReportModal.css';

/** Place en ligne gardée dans le navigateur (`seti_online`) : code et joueur seulement, jamais le jeton */
function storedOnlineSeat(): { code: string; playerId: string } | undefined {
  try {
    const seat = JSON.parse(localStorage.getItem('seti_online') || 'null') as { code?: unknown; playerId?: unknown } | null;
    return seat && typeof seat.code === 'string' && typeof seat.playerId === 'string' ? { code: seat.code, playerId: seat.playerId } : undefined;
  } catch {
    return undefined;
  }
}

/** Écran d'erreur : autonome (rien de l'état de BoardUI, qui vient d'échouer) */
const CrashScreen: React.FC<{ error: Error; onHome: () => void }> = ({ error, onHome }) => {
  const [reporting, setReporting] = React.useState(false);
  // L'état de la partie est perdu avec le composant : le rapport prend l'autosauvegarde et la place en ligne gardée
  const buildReport = (comment: string) => {
    const autosave = readAutosave();
    const seat = storedOnlineSeat();
    return buildBugReport({
      comment,
      mode: autosave ? 'solo' : seat ? 'online' : 'none',
      autosave,
      online: !autosave && seat ? { ...seat, entries: [] } : undefined,
      errors: listErrors(),
      env: browserEnv(),
    });
  };
  return (
    <div className="seti-crash" role="alertdialog" aria-labelledby="seti-crash-title">
      <div className="seti-crash-panel">
        <h2 id="seti-crash-title">Oups, le jeu a rencontré un problème</h2>
        <p>Votre partie n'est pas perdue : elle est sauvegardée automatiquement (en ligne, votre place reste reprenable).</p>
        <p className="seti-crash-message">{error.message || error.name}</p>
        <p>Rechargez la page pour reprendre (« Continuer » sur l'écran d'accueil). Si le problème revient, signalez-le : cela aide beaucoup !</p>
        <div className="seti-report-actions">
          <button type="button" className="seti-report-btn" onClick={() => setReporting(true)}>Signaler le problème</button>
          <button type="button" className="seti-report-btn" onClick={onHome}>Accueil</button>
          <button type="button" className="seti-report-btn primary" onClick={() => window.location.reload()}>Recharger</button>
        </div>
      </div>
      {reporting && <BugReportModal buildReport={buildReport} onClose={() => setReporting(false)} />}
    </div>
  );
};

interface ErrorBoundaryState {
  error: Error | null;
  /** Change à chaque retour à l'accueil : l'application repart de zéro (nouvelle clé) */
  generation: number;
}

/**
 * Limite d'erreur autour de l'application : une erreur d'affichage montre l'écran d'erreur au lieu d'une page
 * blanche, et l'erreur est retenue dans le journal (rapport « Signaler un problème »).
 */
export class ErrorBoundary extends React.Component<{ children: React.ReactNode }, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null, generation: 0 };

  static getDerivedStateFromError(error: unknown): Partial<ErrorBoundaryState> {
    return { error: error instanceof Error ? error : new Error(String(error)) };
  }

  componentDidCatch(error: unknown, info: React.ErrorInfo): void {
    recordError(error, 'render', info.componentStack ?? undefined);
  }

  private goHome = () => this.setState(s => ({ error: null, generation: s.generation + 1 }));

  render(): React.ReactNode {
    if (this.state.error) return <CrashScreen error={this.state.error} onHome={this.goHome} />;
    return <React.Fragment key={this.state.generation}>{this.props.children}</React.Fragment>;
  }
}
