import React from 'react';
import { TechnologyCategory } from '../../core/types';
import { ActionHexIcon, EndTurnIcon, ResourceIcon, VictoryPointsIcon, LifeTraceIcon, AnyLifeTraceIcon, SignalGainIcon, RowCardIcon } from './GameIcons';
import { ReservationIcon, TechCategoryIcon, AnyTechIcon, OrbiterOrLanderIcon } from './ObjectiveSymbol';
import { LIFE_TRACE_COLORS } from '../styles/lifeTraceColors';

interface Entry {
  icon: React.ReactNode;
  name: string;
  text: string;
}

const SECTIONS: { title: string; entries: Entry[] }[] = [
  {
    title: 'Actions principales',
    entries: [
      { icon: <ActionHexIcon kind="launch" size={30} />, name: 'Lancer une sonde', text: '2 crédits : une sonde sur la Terre.' },
      { icon: <ActionHexIcon kind="orbit" size={30} />, name: 'Mettre en orbite', text: '1 crédit + 1 énergie : la sonde devient un orbiteur de la planète.' },
      { icon: <ActionHexIcon kind="land" size={30} />, name: 'Poser une sonde', text: '3 énergies (moins avec un orbiteur ou Exploration III) : atterrisseur sur la planète ou une lune.' },
      { icon: <ActionHexIcon kind="scan" size={30} />, name: 'Scanner un secteur', text: '1 crédit + 2 énergies : signaux dans le secteur de la Terre et celui d\'une carte de la rangée.' },
      { icon: <ActionHexIcon kind="analyze" size={30} />, name: 'Analyser les données', text: '1 énergie, ligne du haut de l\'ordinateur pleine : une trace de vie bleue.' },
      { icon: <ActionHexIcon kind="card" size={30} />, name: 'Jouer une carte', text: 'Coût de la carte : ses gains, sa mission ou son effet de fin de partie.' },
      { icon: <ActionHexIcon kind="research" size={30} />, name: 'Rechercher une technologie', text: '6 Médias : une technologie, et le système solaire tourne.' },
      { icon: <ActionHexIcon kind="pass" size={30} />, name: 'Passer', text: 'Plus de tour jusqu\'à la fin de la manche ; garder 4 cartes au plus.' },
      { icon: <EndTurnIcon size={30} />, name: 'Fin de tour', text: 'Après l\'action principale : au joueur suivant (paliers vérifiés).' },
    ],
  },
  {
    title: 'Ressources et gains',
    entries: [
      { icon: <VictoryPointsIcon amount={3} size={28} />, name: 'Points de victoire', text: 'Le nombre indique les PV gagnés.' },
      { icon: <ResourceIcon kind="credit" size={28} />, name: 'Crédit', text: 'Paie les sondes, les orbites, les scans et beaucoup de cartes.' },
      { icon: <ResourceIcon kind="energy" size={28} />, name: 'Énergie', text: 'Paie les déplacements, les atterrissages, les scans et l\'analyse.' },
      { icon: <ResourceIcon kind="media" size={28} />, name: 'Média', text: 'Couverture médiatique (10 au plus) : technologies, achat de cartes.' },
      { icon: <ResourceIcon kind="data" size={28} />, name: 'Donnée', text: 'Réserve de 6 au plus, à transférer dans l\'ordinateur.' },
      { icon: <ResourceIcon kind="card" size={28} />, name: 'Carte', text: 'Une carte piochée (ou prise dans la rangée si le gain le permet).' },
      { icon: <ResourceIcon kind="alienCard" size={28} />, name: 'Carte Alien', text: 'Une carte de l\'espèce (pioche ou rangée de l\'espèce).' },
      { icon: <ResourceIcon kind="movement" size={28} />, name: 'Déplacement', text: 'Un déplacement gratuit de sonde (sans énergie).' },
      { icon: <ReservationIcon size={24} />, name: 'Réservation', text: 'Une carte de la main glissée sous les revenus : son revenu tout de suite, puis à chaque manche.' },
      { icon: <ResourceIcon kind="token" size={28} />, name: 'Jeton Oumuamua', text: 'Dépensé sur la piste d\'Oumuamua.' },
      { icon: <OrbiterOrLanderIcon size={26} />, name: 'Orbiteur ou atterrisseur', text: 'Une sonde mise en orbite ou posée (missions, objectifs).' },
    ],
  },
  {
    title: 'Traces de vie',
    entries: [
      { icon: <LifeTraceIcon color="red" size={28} />, name: 'Trace rouge (rose)', text: 'Molécule : à placer sur un plateau Alien.' },
      { icon: <LifeTraceIcon color="yellow" size={28} />, name: 'Trace jaune', text: 'Roche : souvent gagnée en posant une sonde.' },
      { icon: <LifeTraceIcon color="blue" size={28} />, name: 'Trace bleue', text: 'Micro-organismes : souvent gagnée en analysant les données.' },
      { icon: <AnyLifeTraceIcon size={28} />, name: 'Trace au choix', text: 'Joker : la couleur de son choix.' },
    ],
  },
  {
    title: 'Signaux',
    entries: [
      { icon: <span className="seti-glossary-icons"><SignalGainIcon color={LIFE_TRACE_COLORS.red} size={24} /><SignalGainIcon color={LIFE_TRACE_COLORS.yellow} size={24} /><SignalGainIcon color={LIFE_TRACE_COLORS.blue} size={24} /><SignalGainIcon color="#2b2b2b" size={24} /></span>, name: 'Signal d\'une couleur', text: 'Un signal dans un secteur de cette couleur (rouge, jaune, bleu, noir).' },
      { icon: <SignalGainIcon size={24} />, name: 'Signal au choix', text: 'Un signal dans le secteur de son choix.' },
      { icon: <SignalGainIcon badge="earth" size={26} />, name: 'Signal sur la Terre', text: 'Dans le secteur où se trouve la Terre.' },
      { icon: <SignalGainIcon badge="card" size={26} />, name: 'Signal de la rangée', text: 'Dans le secteur d\'une carte de la rangée (la carte est défaussée).' },
      { icon: <SignalGainIcon badge="deck" size={26} />, name: 'Signal de la pioche', text: 'Dans le secteur de la carte révélée en haut de la pioche.' },
      { icon: <SignalGainIcon badge="probe" size={26} />, name: 'Signal d\'une sonde', text: 'Dans le secteur d\'une de vos sondes.' },
      { icon: <span className="seti-glossary-icons"><SignalGainIcon badge="mercury" size={26} /><SignalGainIcon badge="mars" size={26} /><SignalGainIcon badge="jupiter" size={26} /></span>, name: 'Signal d\'une planète', text: 'Dans le secteur de cette planète.' },
      { icon: <RowCardIcon size={24} />, name: 'Carte de la rangée', text: 'Une des 3 cartes face visible.' },
    ],
  },
  {
    title: 'Technologies',
    entries: [
      { icon: <TechCategoryIcon category={TechnologyCategory.EXPLORATION} size={26} />, name: 'Exploration', text: 'Sondes, déplacements, atterrissages.' },
      { icon: <TechCategoryIcon category={TechnologyCategory.OBSERVATION} size={26} />, name: 'Observation', text: 'Scans et signaux supplémentaires.' },
      { icon: <TechCategoryIcon category={TechnologyCategory.COMPUTING} size={26} />, name: 'Informatique', text: 'Ordinateur de données : PV et gains.' },
      { icon: <AnyTechIcon size={26} />, name: 'Technologie au choix', text: 'Une technologie de n\'importe quelle catégorie.' },
    ],
  },
];

/** Glossaire des symboles du jeu (documentation) : les vraies icônes de l'interface, avec leur sens */
export const SymbolGlossary: React.FC = () => (
  <div className="seti-glossary">
    {SECTIONS.map(section => (
      <section key={section.title}>
        <h4>{section.title}</h4>
        <div className="seti-glossary-grid">
          {section.entries.map(entry => (
            <div key={entry.name} className="seti-glossary-entry">
              <span className="seti-glossary-icon">{entry.icon}</span>
              <span>
                <strong>{entry.name}</strong>
                <span className="seti-glossary-text">{entry.text}</span>
              </span>
            </div>
          ))}
        </div>
      </section>
    ))}
  </div>
);
