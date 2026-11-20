/** @jest-environment jsdom */
import { act, fireEvent, render, screen } from '@testing-library/react';
import React from 'react';
import { ErrorBoundary } from '../../src/ui/components/ErrorBoundary';
import { ErrorNotice } from '../../src/ui/components/ErrorNotice';
import { BugReportModal } from '../../src/ui/modals/BugReportModal';
import { buildBugReport } from '../../src/ui/bugReport';
import { clearErrors, listErrors, recordError } from '../../src/ui/errorLog';

/** Lien de téléchargement (repli sans boîte « Enregistrer sous ») : contenu du fichier téléchargé */
function captureDownloads(): { files: { name: string; blob: Blob }[] } {
  const captured = { files: [] as { name: string; blob: Blob }[] };
  let lastBlob: Blob | null = null;
  (URL as unknown as { createObjectURL: (b: Blob) => string }).createObjectURL = (blob: Blob) => { lastBlob = blob; return 'blob:test'; };
  (URL as unknown as { revokeObjectURL: () => void }).revokeObjectURL = () => {};
  jest.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
    captured.files.push({ name: this.download, blob: lastBlob! });
  });
  return captured;
}

/** Contenu d'un Blob (jsdom n'a pas Blob.text) */
const readBlob = (blob: Blob) => new Promise<string>(resolve => {
  const reader = new FileReader();
  reader.onload = () => resolve(String(reader.result));
  reader.readAsText(blob);
});

const Broken: React.FC<{ fail: boolean }> = ({ fail }) => {
  if (fail) throw new Error('plateau cassé');
  return <p>Accueil du jeu</p>;
};

describe('écran d\'erreur', () => {
  beforeEach(() => {
    clearErrors();
    localStorage.clear();
    // React signale l'erreur attrapée dans la console : sans intérêt ici
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });
  afterEach(() => jest.restoreAllMocks());

  test('une erreur d\'affichage montre l\'écran « Oups » et entre dans le journal ; la partie sauvegardée reste', () => {
    localStorage.setItem('seti_autosave', '{"seed":1}');
    localStorage.setItem('seti_online', '{"code":"ABCDE","token":"t","playerId":"p1"}');
    render(<ErrorBoundary><Broken fail /></ErrorBoundary>);
    expect(screen.getByText(/le jeu a rencontré un problème/)).toBeTruthy();
    expect(screen.getByText('plateau cassé')).toBeTruthy();
    for (const label of ['Recharger', 'Accueil', 'Signaler le problème']) expect(screen.getByRole('button', { name: label })).toBeTruthy();
    expect(listErrors()[0]).toMatchObject({ source: 'render', message: 'plateau cassé' });
    expect(localStorage.getItem('seti_autosave')).toBe('{"seed":1}');
    expect(localStorage.getItem('seti_online')).toContain('ABCDE');
  });

  test('« Accueil » remonte l\'application', () => {
    let fail = true;
    const Toggle = () => <Broken fail={fail} />;
    render(<ErrorBoundary><Toggle /></ErrorBoundary>);
    fail = false;
    fireEvent.click(screen.getByRole('button', { name: 'Accueil' }));
    expect(screen.getByText('Accueil du jeu')).toBeTruthy();
  });

  test('« Signaler le problème » : rapport avec l\'erreur et l\'autosauvegarde, sans le jeton en ligne ni requête réseau', async () => {
    localStorage.setItem('seti_autosave', '{"seed":7,"players":[]}');
    localStorage.setItem('seti_online', '{"code":"ABCDE","token":"jeton-secret","playerId":"p1"}');
    const fetchSpy = jest.fn();
    (globalThis as { fetch?: unknown }).fetch = fetchSpy;
    const downloads = captureDownloads();
    render(<ErrorBoundary><Broken fail /></ErrorBoundary>);
    fireEvent.click(screen.getByRole('button', { name: 'Signaler le problème' }));
    fireEvent.change(screen.getByLabelText(/Que s'est-il passé/), { target: { value: 'en jouant une carte' } });
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Télécharger le rapport' })); });

    expect(downloads.files).toHaveLength(1);
    expect(downloads.files[0].name).toMatch(/^seti_rapport_.*\.json$/);
    const report = JSON.parse(await readBlob(downloads.files[0].blob));
    expect(report).toMatchObject({ comment: 'en jouant une carte', seed: 7, save: { seed: 7 } });
    expect(report.errors[0].message).toBe('plateau cassé');
    expect(JSON.stringify(report)).not.toContain('jeton-secret');
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(screen.getByText(/Envoyez ce fichier au développeur/)).toBeTruthy();
    delete (globalThis as { fetch?: unknown }).fetch;
  });
});

describe('message d\'erreur non bloquant', () => {
  beforeEach(() => clearErrors());

  test('une nouvelle erreur affiche « Un problème est survenu » une seule fois ; Signaler ouvre le rapport', () => {
    const onReport = jest.fn();
    render(<ErrorNotice onReport={onReport} />);
    expect(screen.queryByRole('alert')).toBeNull();
    act(() => { recordError(new Error('clic'), 'error'); });
    expect(screen.getAllByRole('alert')).toHaveLength(1);
    // La même erreur répétée, une fois le message fermé, ne le rouvre pas
    fireEvent.click(screen.getByRole('button', { name: 'Fermer' }));
    act(() => { recordError(new Error('clic'), 'error'); });
    expect(screen.queryByRole('alert')).toBeNull();
    act(() => { recordError(new Error('autre'), 'promise'); });
    fireEvent.click(screen.getByRole('button', { name: 'Signaler' }));
    expect(onReport).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('alert')).toBeNull();
  });

  test('fenêtre de rapport : Annuler ou Échap la ferment sans rien télécharger', () => {
    const onClose = jest.fn();
    const build = jest.fn(() => buildBugReport({ comment: '', mode: 'none', errors: [], env: { userAgent: '', screen: '', language: '' } }));
    render(<BugReportModal buildReport={build} onClose={onClose} />);
    fireEvent.click(screen.getByRole('button', { name: 'Annuler' }));
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(2);
    expect(build).not.toHaveBeenCalled();
  });
});
