import React, { useEffect, useState } from 'react';
import { DataLoader } from '../../core/DataLoader';
import { Card } from '../../core/types';
import { CardFace } from './CardFace';

/** Groupes de la planche du paquet de base, dans l'ordre du glossaire */
/** Fichier de cartes de chaque espèce (public/cards/) */
const SPECIES_FILES: Record<string, string> = {
  Mascamites: 'mascamites', Anomalies: 'anomalies', Oumuamua: 'oumuamua', Centauriens: 'centauriens', Exertiens: 'exertiens',
};

/** Numéro d'une carte pour le tri (« 12 », « ET.7 ») */
const cardNumber = (card: Card): number => Number(card.id.replace(/^ET\./, '')) || 0;
const byNumber = (a: Card, b: Card) => cardNumber(a) - cardNumber(b);

/** Cartes d'un fichier CSV, chargées une fois par fichier (le glossaire peut être rouvert) */
const cache = new Map<string, Promise<Card[]>>();
const loadCards = (file: string): Promise<Card[]> => {
  if (!cache.has(file)) cache.set(file, DataLoader.loadCards(`cards/${file}.csv`));
  return cache.get(file)!;
};

const useCards = (file: string | undefined): Card[] | null => {
  const [cards, setCards] = useState<Card[] | null>(null);
  useEffect(() => {
    if (!file) return;
    let alive = true;
    loadCards(file).then(loaded => { if (alive) setCards([...loaded].sort(byNumber)); });
    return () => { alive = false; };
  }, [file]);
  return cards;
};

const Plate: React.FC<{ cards: Card[] }> = ({ cards }) => (
  <div className="seti-card-plate">
    {cards.map(card => <CardFace key={card.id} card={card} />)}
  </div>
);

/** Planche du paquet de base (glossaire 3.2, sans sous-section) : toutes les cartes, par numéro */
export const CardGlossary: React.FC = () => {
  const cards = useCards('main');
  if (!cards) return <div className="seti-glossary-text">Chargement des cartes…</div>;
  return <div className="seti-glossary"><Plate cards={cards} /></div>;
};

/** Planche des cartes d'une espèce (section de l'espèce en 3.5, masquée tant qu'elle n'est pas débloquée) */
export const SpeciesCardGlossary: React.FC<{ species: string }> = ({ species }) => {
  const cards = useCards(SPECIES_FILES[species]);
  if (!SPECIES_FILES[species]) return null;
  if (!cards) return <div className="seti-glossary-text">Chargement des cartes…</div>;
  return <div className="seti-glossary"><Plate cards={cards} /></div>;
};
