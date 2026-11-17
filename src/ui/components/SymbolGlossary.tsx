import React from 'react';
import { AlienBoardType, ObjectiveCategory, ObjectiveTile, TechnologyCategory } from '../../core/types';
import { AnomalyIcon, MascamiteIcon, TrophyIcon, ActionHexIcon, EndTurnIcon, DiscardCardIcon, CentaurienMessageIcon, ResourceIcon, VictoryPointsIcon, LifeTraceIcon, AnyLifeTraceIcon, SignalGainIcon, RowCardIcon, RotationChevronIcon, RotationTokenIcon, ROTATION_CHEVRON_COLORS, MissionCompleteIcon, RefuseIcon, TransferDataIcon, TechTileIcon } from './GameIcons';
import { ReservationIcon, TechCategoryIcon, AnyTechIcon, OrbiterOrLanderIcon, OrbiterIcon, LanderIcon, CoveredSectorIcon, ObjectiveSymbol } from './ObjectiveSymbol';
import { LIFE_TRACE_COLORS } from '../styles/lifeTraceColors';
import { ANOMALY_COLORS } from '../styles/anomalyColors';
import { HumanIcon, LevelStrength } from './PlayerKindIcon';

interface Entry {
  icon: React.ReactNode;
  name: string;
  text: string;
}

/** Couleur des secteurs noirs (signaux et secteurs couverts) */
const BLACK_SECTOR = '#2b2b2b';

/** Conversion d'une action gratuite : ce qu'on dépense → ce qu'on gagne */
const Conversion: React.FC<{ from: React.ReactNode; to: React.ReactNode }> = ({ from, to }) => (
  <span className="seti-glossary-icons seti-glossary-conversion">{from}<span className="seti-glossary-arrow">→</span>{to}</span>
);

/** Symboles propres à chaque espèce (glossaire des symboles une fois l'espèce rencontrée, et section de l'espèce) */
const SPECIES_SYMBOLS: Record<AlienBoardType, Entry[]> = {
  [AlienBoardType.MASCAMITES]: [
    { icon: <MascamiteIcon size={26} />, name: 'Spécimen Mascamite', text: 'À côté du nom des Mascamites : son infobulle montre les spécimens restants sur Jupiter et Saturne (récompense si vous les avez vus, sinon « ? »). Sur les planètes : un spécimen à prélever ou étudier.' },
  ],
  [AlienBoardType.ANOMALIES]: [
    { icon: <span className="seti-glossary-icons">{Object.values(ANOMALY_COLORS).map(color => <AnomalyIcon key={color} color={color} size={24} />)}</span>, name: 'Anomalies', text: 'Jetons Anomalie du système solaire, à la couleur de leur trace de vie : quand une rotation amène la Terre sur l\'une d\'elles, sa récompense (au centre du jeton) va au joueur le plus haut sur la piste de sa couleur.' },
    { icon: <SignalGainIcon badge="anomaly" size={26} />, name: 'Signal d\'une anomalie', text: 'Dans un secteur qui contient une anomalie, au choix (la couleur du secteur et celle de l\'anomalie ne comptent pas).' },
    { icon: <SignalGainIcon badge="nextAnomaly" size={26} />, name: 'Signal de la prochaine anomalie', text: 'Dans le secteur de la prochaine anomalie qui sera déclenchée (la première après la Terre dans le sens des secteurs), sans choix.' },
  ],
  [AlienBoardType.OUMUAMUA]: [
    { icon: <ResourceIcon kind="token" size={28} />, name: 'Jeton Oumuamua', text: 'Gagné en couvrant le secteur d\'Oumuamua ; dépensé sur la piste de l\'espèce ou par ses cartes.' },
    { icon: <SignalGainIcon badge="oumuamua" size={26} />, name: 'Signal Oumuamua', text: 'Sur la tuile d\'Oumuamua, ou dans le secteur où il se trouve.' },
  ],
  [AlienBoardType.CENTAURIENS]: [
    { icon: <CentaurienMessageIcon size={28} />, name: 'Message centaurien', text: 'Palier des Centauriens : une tuile Message à choisir, ou l\'effet Réception d\'une carte. Sur le plateau de l\'espèce, son infobulle liste les paliers et les tuiles Message.' },
  ],
  [AlienBoardType.EXERTIENS]: [
    { icon: <span className="seti-glossary-emoji">☣️</span>, name: 'Danger Exertiens', text: 'À côté du nom des Exertiens : son infobulle donne le danger de chaque joueur et ses cartes Exertiens (celles des adversaires de dos).' },
  ],
};

/** Ordre des espèces dans le glossaire */
const SPECIES_ORDER: AlienBoardType[] = [AlienBoardType.MASCAMITES, AlienBoardType.ANOMALIES, AlienBoardType.OUMUAMUA, AlienBoardType.CENTAURIENS, AlienBoardType.EXERTIENS];

const sections = (unlockedSpecies: string[]): { title: string; entries: Entry[] }[] => [
  {
    title: 'Joueurs',
    entries: [
      { icon: <HumanIcon size={22} />, name: 'Joueur humain', text: "Devant le nom d'un joueur humain ; « / » suivi de ce symbole : par joueur (bonus de présence d'un secteur)." },
      { icon: <LevelStrength value={2} />, name: "Niveau d'un robot", text: '1 à 3 barres : Débutant, Avancé, Expert.' },
      { icon: <span className="seti-glossary-emoji">👑</span>, name: 'Premier joueur', text: 'Sur l\'onglet du joueur qui a commencé la partie.' },
      { icon: <TrophyIcon size={24} />, name: 'Vainqueur', text: 'Après le nom du ou des vainqueurs, en fin de partie.' },
    ],
  },
  {
    title: 'Ressources',
    entries: [
      { icon: <VictoryPointsIcon amount={3} size={28} />, name: 'Points de victoire', text: 'Le nombre indique les PV gagnés.' },
      { icon: <ResourceIcon kind="credit" size={28} />, name: 'Crédit', text: 'Paie les sondes, les orbites, les scans et beaucoup de cartes.' },
      { icon: <ResourceIcon kind="energy" size={28} />, name: 'Énergie', text: 'Paie les déplacements, les atterrissages, les scans et l\'analyse.' },
      { icon: <ResourceIcon kind="media" size={28} />, name: 'Média', text: 'Couverture médiatique (10 au plus) : technologies, achat de cartes.' },
      { icon: <ResourceIcon kind="data" size={28} />, name: 'Donnée', text: 'Réserve de 6 au plus, à transférer dans l\'ordinateur.' },
      { icon: <ResourceIcon kind="card" size={28} />, name: 'Carte', text: 'Une carte piochée (ou prise dans la rangée si le gain le permet).' },
      { icon: <ResourceIcon kind="alienCard" size={28} />, name: 'Carte Alien', text: 'Une carte de l\'espèce (pioche ou rangée de l\'espèce).' },
      { icon: <ResourceIcon kind="movement" size={28} />, name: 'Déplacement', text: 'Un déplacement gratuit de sonde (sans énergie).' },
      { icon: <ResourceIcon kind="credit" amount={1} size={28} />, name: 'Quantité', text: 'Un nombre devant le symbole : la quantité gagnée (négative : dépensée).' },
    ],
  },
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
    title: 'Actions gratuites',
    entries: [
      { icon: <Conversion from={<ResourceIcon kind="energy" amount={1} size={24} />} to={<ResourceIcon kind="movement" amount={1} size={24} />} />, name: 'Acheter un déplacement', text: '1 énergie par case : la sonde avance d\'une case (ou un déplacement gratuit reçu).' },
      { icon: <Conversion from={<ResourceIcon kind="media" amount={3} size={24} />} to={<ResourceIcon kind="card" amount={1} size={24} />} />, name: 'Acheter une carte', text: '3 Médias : une carte de la rangée ou de la pioche (infobulle des Médias).' },
      { icon: <Conversion from={<ResourceIcon kind="credit" amount={2} size={24} />} to={<ResourceIcon kind="energy" amount={1} size={24} />} />, name: 'Échanger des ressources', text: '2 crédits, 2 énergies ou 2 cartes contre 1 crédit, 1 énergie ou 1 carte (infobulle de la ressource dépensée).' },
      { icon: <DiscardCardIcon size={28} />, name: 'Défausser une carte', text: 'Une carte de la main pour l\'action gratuite de son coin (Média, donnée, déplacement…).' },
      { icon: <TransferDataIcon size={30} />, name: 'Transférer une donnée', text: 'Une donnée de la réserve dans l\'ordinateur (clic sur une case libre) : l\'ordinateur monte d\'un cran, certaines cases rapportent un bonus.' },
      { icon: <MissionCompleteIcon size={28} />, name: 'Accomplir une mission', text: "Recouvrir un cercle (mission déclenchable) ou le carré (mission conditionnelle) d'une mission jouée pour gagner sa récompense ; hors de son tour, une fenêtre propose les cercles déclenchés." },
    ],
  },
  {
    title: 'Bonus',
    entries: [
      { icon: <ReservationIcon size={24} />, name: 'Réservation', text: 'Une carte de la main glissée sous les revenus : son revenu tout de suite, puis à chaque manche.' },
      { icon: <RotationTokenIcon size={28} />, name: 'Rotation du Système solaire', text: "Jeton Rotation : le Système solaire tourne (recherche d'une technologie, premier joueur à passer, gains de cartes)." },
      { icon: <span className="seti-glossary-icons">{Object.values(ROTATION_CHEVRON_COLORS).map(color => <RotationChevronIcon key={color} color={color} size={22} />)}</span>, name: 'Rotation', text: 'Le Système Solaire tourne : anneau bleu, rouge ou jaune, celui du chevron sur le plateau.' },
      { icon: <span className="seti-glossary-icons"><OrbiterIcon size={26} /><LanderIcon size={26} /></span>, name: 'Orbiteur, atterrisseur', text: 'Une sonde en orbite ou posée (panneau des planètes, infobulles des actions).' },
      { icon: <OrbiterOrLanderIcon size={26} />, name: 'Orbiteur ou atterrisseur', text: 'Une sonde mise en orbite ou posée (missions, objectifs).' },
      { icon: <RefuseIcon size={26} />, name: 'Refuser', text: 'Dans une fenêtre de choix : renoncer au gain proposé.' },
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
  {
    title: 'Traces de vie',
    entries: [
      { icon: <LifeTraceIcon color="red" size={28} />, name: 'Trace rouge', text: 'Molécule : souvent gagnée en couvrant un secteur.' },
      { icon: <LifeTraceIcon color="yellow" size={28} />, name: 'Trace jaune', text: 'Roche : souvent gagnée en posant une sonde.' },
      { icon: <LifeTraceIcon color="blue" size={28} />, name: 'Trace bleue', text: 'Micro-organismes : souvent gagnée en analysant les données.' },
      { icon: <AnyLifeTraceIcon size={28} />, name: 'Trace au choix', text: 'Joker : la couleur de son choix.' },
    ],
  },
  {
    title: 'Signaux et secteurs',
    entries: [
      { icon: <span className="seti-glossary-icons"><SignalGainIcon color={LIFE_TRACE_COLORS.red} size={24} /><SignalGainIcon color={LIFE_TRACE_COLORS.yellow} size={24} /><SignalGainIcon color={LIFE_TRACE_COLORS.blue} size={24} /><SignalGainIcon color={BLACK_SECTOR} size={24} /></span>, name: 'Signal d\'une couleur', text: 'Un signal dans un secteur de cette couleur (rouge, jaune, bleu, noir).' },
      { icon: <SignalGainIcon size={24} />, name: 'Signal au choix', text: 'Un signal dans le secteur de son choix.' },
      { icon: <SignalGainIcon badge="earth" size={26} />, name: 'Signal sur la Terre', text: 'Dans le secteur où se trouve la Terre.' },
      { icon: <SignalGainIcon badge="card" size={26} />, name: 'Signal de la rangée', text: 'Dans le secteur d\'une carte de la rangée (la carte est défaussée).' },
      { icon: <SignalGainIcon badge="deck" size={26} />, name: 'Signal de la pioche', text: 'Dans le secteur de la carte révélée en haut de la pioche.' },
      { icon: <SignalGainIcon badge="probe" size={26} />, name: 'Signal d\'une sonde', text: 'Dans le secteur d\'une de vos sondes.' },
      { icon: <span className="seti-glossary-icons"><SignalGainIcon badge="mercury" size={26} /><SignalGainIcon badge="mars" size={26} /><SignalGainIcon badge="jupiter" size={26} /></span>, name: 'Signal d\'une planète', text: 'Dans le secteur de cette planète.' },
      { icon: <RowCardIcon size={24} />, name: 'Carte de la rangée', text: 'Une des 3 cartes face visible.' },
      { icon: <span className="seti-glossary-icons"><CoveredSectorIcon color={LIFE_TRACE_COLORS.red} size={24} /><CoveredSectorIcon color={LIFE_TRACE_COLORS.yellow} size={24} /><CoveredSectorIcon color={LIFE_TRACE_COLORS.blue} size={24} /><CoveredSectorIcon color={BLACK_SECTOR} size={24} /></span>, name: 'Secteur couvert d\'une couleur', text: 'Un secteur de cette couleur couvert (rouge, jaune, bleu, noir) : missions, objectifs.' },
      { icon: <CoveredSectorIcon size={26} />, name: 'Secteur couvert', text: 'Un secteur couvert, de n\'importe quelle couleur.' },
    ],
  },
  {
    title: 'Espèces',
    // Une espèce encore jamais rencontrée en partie reste sous cadenas, sans son nom ni son symbole
    entries: SPECIES_ORDER.map(species => (unlockedSpecies.includes(species)
      ? { ...SPECIES_SYMBOLS[species][0], name: `${species} : ${SPECIES_SYMBOLS[species][0].name}` }
      : { icon: <span className="seti-glossary-emoji seti-glossary-locked">🔒</span>, name: 'Espèce inconnue', text: 'Son symbole se dévoile quand vous la découvrez en partie.' })),
  },
];

/** Grille d'entrées (symbole, nom, sens) */
const EntryGrid: React.FC<{ entries: Entry[] }> = ({ entries }) => (
  <div className="seti-glossary-grid">
    {entries.map((entry, index) => (
      <div key={`${entry.name}-${index}`} className="seti-glossary-entry">
        <span className="seti-glossary-icon">{entry.icon}</span>
        <span>
          <strong>{entry.name}</strong>
          <span className="seti-glossary-text">{entry.text}</span>
        </span>
      </div>
    ))}
  </div>
);

/** Glossaire des symboles du jeu (documentation) : les vraies icônes de l'interface, avec leur sens */
export const SymbolGlossary: React.FC<{ unlockedSpecies?: string[] }> = ({ unlockedSpecies = [] }) => (
  <div className="seti-glossary">
    {sections(unlockedSpecies).map(section => (
      <section key={section.title}>
        <h4>{section.title}</h4>
        <EntryGrid entries={section.entries} />
      </section>
    ))}
  </div>
);

/** Symboles d'une espèce (section de l'espèce dans le glossaire) */
export const SpeciesSymbols: React.FC<{ species: string }> = ({ species }) => {
  const entries = SPECIES_SYMBOLS[species as AlienBoardType];
  return entries ? <div className="seti-glossary"><EntryGrid entries={entries} /></div> : null;
};

const TECHNOLOGIES: { id: string; name: string; text: string }[] = [
  { id: 'exploration-1', name: 'Exploration I', text: 'Une 2ᵉ sonde dans le système solaire, et le lancement d\'une sonde devient gratuit.' },
  { id: 'exploration-2', name: 'Exploration II', text: '+1 Média en visitant un champ d\'astéroïdes ; le quitter ne coûte qu\'un déplacement.' },
  { id: 'exploration-3', name: 'Exploration III', text: 'Atterrir coûte 1 énergie de moins (en plus de la réduction d\'un orbiteur déjà présent).' },
  { id: 'exploration-4', name: 'Exploration IV', text: 'Atterrir sur les lunes des planètes.' },
  { id: 'observation-1', name: 'Observation I', text: 'Scan : le signal de la Terre peut aller dans un secteur adjacent.' },
  { id: 'observation-2', name: 'Observation II', text: 'Scan : payer 1 Média pour un signal dans le secteur de Mercure.' },
  { id: 'observation-3', name: 'Observation III', text: 'Scan : défausser une carte de la main pour un signal dans un secteur de sa couleur.' },
  { id: 'observation-4', name: 'Observation IV', text: 'Scan : payer 1 énergie pour lancer une sonde, ou gagner 1 déplacement.' },
  { id: 'computing-1', name: 'Informatique I', text: 'Posée sur une colonne de l\'ordinateur : sa case du haut rapporte 2 PV, la case ajoutée en bas 1 crédit, quand une donnée y est transférée.' },
  { id: 'computing-2', name: 'Informatique II', text: 'Posée sur une colonne de l\'ordinateur : sa case du haut rapporte 2 PV, la case ajoutée en bas 1 carte au choix, quand une donnée y est transférée.' },
  { id: 'computing-3', name: 'Informatique III', text: 'Posée sur une colonne de l\'ordinateur : sa case du haut rapporte 2 PV, la case ajoutée en bas 1 énergie, quand une donnée y est transférée.' },
  { id: 'computing-4', name: 'Informatique IV', text: 'Posée sur une colonne de l\'ordinateur : sa case du haut rapporte 2 PV, la case ajoutée en bas 2 Médias, quand une donnée y est transférée.' },
];

const TECH_CATEGORIES: { prefix: string; title: string }[] = [
  { prefix: 'exploration', title: 'Exploration' },
  { prefix: 'observation', title: 'Observation' },
  { prefix: 'computing', title: 'Informatique' },
];

/** Glossaire des 12 technologies : tuile et effet, une sous-section par catégorie */
export const TechnologyGlossary: React.FC = () => (
  <div className="seti-glossary">
    {TECH_CATEGORIES.map(category => (
      <section key={category.prefix}>
        <h4>{category.title}</h4>
        <EntryGrid entries={TECHNOLOGIES.filter(tech => tech.id.startsWith(category.prefix)).map(tech => ({ icon: <TechTileIcon techId={tech.id} width={29} height={41} />, name: tech.name, text: tech.text }))} />
      </section>
    ))}
  </div>
);

const OBJECTIVES: { id: string; category: ObjectiveCategory; name: string; side: 'A' | 'B'; rewards: ObjectiveTile['rewards']; text: string }[] = [
  { id: 'obj_tech', category: ObjectiveCategory.TECHNOLOGY, name: 'Technologies', side: 'A', rewards: { first: 11, second: 8, others: 5 }, text: 'Par série d\'une technologie de chaque catégorie (Exploration, Observation, Informatique).' },
  { id: 'obj_tech', category: ObjectiveCategory.TECHNOLOGY, name: 'Technologies', side: 'B', rewards: { first: 7, second: 5, others: 3 }, text: 'Par paire de technologies, toutes catégories confondues.' },
  { id: 'obj_mission', category: ObjectiveCategory.MISSION, name: 'Missions', side: 'A', rewards: { first: 4, second: 3, others: 2 }, text: 'Par mission accomplie.' },
  { id: 'obj_mission', category: ObjectiveCategory.MISSION, name: 'Missions', side: 'B', rewards: { first: 8, second: 6, others: 4 }, text: 'Par paire de cartes Mission accomplies ou Fin de partie jouées.' },
  { id: 'obj_revenue', category: ObjectiveCategory.REVENUE, name: 'Revenus', side: 'A', rewards: { first: 11, second: 8, others: 5 }, text: 'Par série de 3 cartes réservées de revenus différents (crédit, énergie, carte).' },
  { id: 'obj_revenue', category: ObjectiveCategory.REVENUE, name: 'Revenus', side: 'B', rewards: { first: 5, second: 4, others: 3 }, text: 'Par carte réservée du type de revenu que vous avez réservé le plus souvent.' },
  { id: 'obj_other', category: ObjectiveCategory.OTHER, name: 'Autres', side: 'A', rewards: { first: 8, second: 6, others: 4 }, text: 'Par série de 3 traces de vie de couleurs différentes (rouge, jaune, bleue).' },
  { id: 'obj_other', category: ObjectiveCategory.OTHER, name: 'Autres', side: 'B', rewards: { first: 8, second: 6, others: 4 }, text: 'Par paire secteur couvert / orbiteur ou atterrisseur.' },
];

/** Tuiles objectif, dans l'ordre du plateau */
const OBJECTIVE_TILES = [...new Set(OBJECTIVES.map(objective => objective.name))];

/** Glossaire des 8 objectifs (une sous-section par tuile Score dorée, faces A et B) : symbole, décompte et PV selon le rang */
export const ObjectiveGlossary: React.FC = () => (
  <div className="seti-glossary">
    {OBJECTIVE_TILES.map(name => (
      <section key={name}>
        <h4>{name}</h4>
        <div className="seti-glossary-grid seti-glossary-grid--wide">
          {OBJECTIVES.filter(objective => objective.name === name).map(objective => (
            <div key={`${objective.id}-${objective.side}`} className="seti-glossary-entry">
              <span className="seti-glossary-icon">
                <ObjectiveSymbol tile={{ ...objective, description: objective.text, markers: [] }} height={30} />
              </span>
              <span>
                <strong>Face {objective.side}</strong>
                <span className="seti-glossary-text">{objective.text} Au décompte final, selon le rang du marqueur sur la tuile : 1er {objective.rewards.first} PV, 2e {objective.rewards.second} PV, suivants {objective.rewards.others} PV.</span>
              </span>
            </div>
          ))}
        </div>
      </section>
    ))}
  </div>
);
