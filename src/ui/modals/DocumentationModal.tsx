import React, { useEffect, useMemo, useRef, useState } from 'react';
import { renderMarkdown } from '../components/markdown';
import { versionLabel } from '../version';
import './DocumentationModal.css';

/** Chemins relatifs à la page (base Vite « ./ »), comme les CSV des cartes */
const BASE_URL = '';

interface DocumentationModalProps {
  visible: boolean;
  onClose: () => void;
}

/** Documentation du jeu (public/docs/documentation.md), avec sommaire et accès aux règles et à la FAQ en PDF */
export const DocumentationModal: React.FC<DocumentationModalProps> = ({ visible, onClose }) => {
  const [source, setSource] = useState<string | null>(null);
  const [error, setError] = useState(false);
  const bodyRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!visible || source !== null) return;
    fetch(`${BASE_URL}docs/documentation.md`)
      .then(response => (response.ok ? response.text() : Promise.reject(new Error(String(response.status)))))
      .then(setSource)
      .catch(() => setError(true));
  }, [visible, source]);

  useEffect(() => {
    if (!visible) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [visible, onClose]);

  const doc = useMemo(() => (source ? renderMarkdown(source, BASE_URL) : null), [source]);

  if (!visible) return null;

  const goTo = (id: string) => {
    bodyRef.current?.querySelector(`#${CSS.escape(id)}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <div className="seti-modal-overlay" style={{ zIndex: 2100 }} onClick={onClose}>
      <div className="seti-doc-modal" onClick={e => e.stopPropagation()} role="dialog" aria-label="Documentation">
        <div className="seti-doc-header">
          <h2 className="seti-modal-title">Documentation <span className="seti-doc-version">{versionLabel()}</span></h2>
          <div className="seti-doc-links">
            <a href={`${BASE_URL}docs/seti-rules-fr.pdf`} target="_blank" rel="noopener noreferrer" className="seti-modal-btn">Règles du jeu (PDF)</a>
            <a href={`${BASE_URL}docs/SETI-FAQ-FR.pdf`} target="_blank" rel="noopener noreferrer" className="seti-modal-btn">FAQ (PDF)</a>
            <button onClick={onClose} className="seti-modal-btn secondary">Fermer</button>
          </div>
        </div>
        <div className="seti-doc-columns">
          <nav className="seti-doc-toc">
            {doc?.toc.map(entry => (
              <button key={entry.id} className={`seti-doc-toc-item level-${entry.level}`} onClick={() => goTo(entry.id)}>
                {entry.title}
              </button>
            ))}
          </nav>
          <div className="seti-doc-body" ref={bodyRef}>
            {error && <p>Impossible de charger la documentation.</p>}
            {!error && !doc && <p>Chargement…</p>}
            {doc && <div dangerouslySetInnerHTML={{ __html: doc.html }} />}
          </div>
        </div>
      </div>
    </div>
  );
};
