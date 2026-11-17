import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { SymbolGlossary, TechnologyGlossary, ObjectiveGlossary, SpeciesSymbols } from '../components/SymbolGlossary';
import { renderMarkdown } from '../components/markdown';
import { versionLabel } from '../version';
import { tutorialProgress } from '../tutorialProgress';
import { hideLockedSpecies, LOCKED_SPECIES_ANCHOR } from '../../tutorial/docMask';
import './DocumentationModal.css';

/** Chemins relatifs à la page (base Vite « ./ »), comme les CSV des cartes */
const BASE_URL = '';

interface DocumentationModalProps {
  visible: boolean;
  onClose: () => void;
  /** Identifiant d'un titre à afficher à l'ouverture (« En savoir plus » du tutoriel) */
  section?: string;
}

/** Documentation du jeu (public/docs/documentation.md), avec sommaire et accès aux règles et à la FAQ en PDF */
export const DocumentationModal: React.FC<DocumentationModalProps> = ({ visible, onClose, section }) => {
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

  // Règles des espèces pas encore rencontrées en partie : masquées (relu à chaque ouverture)
  const unlockedKey = visible ? tutorialProgress().species.join('|') : '';
  const unlockedSpecies = useMemo(() => (unlockedKey ? unlockedKey.split('|') : []), [unlockedKey]);
  const doc = useMemo(
    () => (source ? renderMarkdown(hideLockedSpecies(source, unlockedSpecies), BASE_URL) : null),
    [source, unlockedSpecies],
  );

  // Emplacements {{glossaire}}, {{technologies}}, {{objectifs}}, {{symboles-espece:Nom}} du texte :
  // le composant y est inséré (vraies icônes du jeu)
  const [componentSlots, setComponentSlots] = useState<Element[]>([]);
  useLayoutEffect(() => {
    setComponentSlots(visible && doc ? [...(bodyRef.current?.querySelectorAll('[data-doc-component]') || [])] : []);
  }, [doc, visible]);
  const slotComponent = (slot: Element): React.ReactNode => {
    switch (slot.getAttribute('data-doc-component')) {
      case 'glossaire': return <SymbolGlossary unlockedSpecies={unlockedSpecies} />;
      case 'technologies': return <TechnologyGlossary />;
      case 'objectifs': return <ObjectiveGlossary />;
      case 'symboles-espece': return <SpeciesSymbols species={slot.getAttribute('data-doc-arg') ?? ''} />;
      default: return null;
    }
  };

  // Section demandée : affichée dès que le texte est rendu
  useLayoutEffect(() => {
    // Identifiants des titres : slugs (lettres, chiffres, tirets), sans échappement nécessaire
    // Section masquée (espèce pas encore rencontrée) : l'encart des espèces inconnues
    const target = section && (bodyRef.current?.querySelector(`[id="${section}"]`) ?? bodyRef.current?.querySelector(`[id="${LOCKED_SPECIES_ANCHOR}"]`));
    if (visible && doc && target) target.scrollIntoView({ block: 'start' });
  }, [doc, visible, section]);

  if (!visible) return null;

  const goTo = (id: string) => {
    bodyRef.current?.querySelector(`#${CSS.escape(id)}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <div className="seti-modal-overlay seti-modal-overlay--docs" onClick={onClose}>
      <div className="seti-doc-modal" onClick={e => e.stopPropagation()} role="dialog" aria-label="Documentation">
        <div className="seti-doc-header">
          <h2 className="seti-modal-title seti-doc-title">
            <img className="seti-doc-logo" src="logo-seti.png" alt="SETI" />
            Documentation <span className="seti-doc-version">{versionLabel()}</span>
          </h2>
          <div className="seti-doc-links">
            <a href={`${BASE_URL}docs/seti-rules-fr.pdf`} target="_blank" rel="noopener noreferrer" className="seti-modal-btn">Règles du jeu (PDF)</a>
            <a href={`${BASE_URL}docs/SETI-FAQ-FR.pdf`} target="_blank" rel="noopener noreferrer" className="seti-modal-btn">FAQ (PDF)</a>
            <button onClick={onClose} className="seti-doc-close" aria-label="Fermer">✕</button>
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
            {componentSlots.map((slot, index) => createPortal(slotComponent(slot), slot, `doc-component-${index}`))}
          </div>
        </div>
      </div>
    </div>
  );
};
