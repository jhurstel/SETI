/** Énumérations et types simples du jeu (libellés français affichés, aussi lus dans les CSV des cartes) */

export enum GamePhase {
  SETUP = "SETUP",
  PLAYING = "PLAYING",
  ROUND_END = "ROUND_END",
  FINAL_SCORING = "FINAL_SCORING"
}

export enum ActionType {
  LAUNCH_PROBE = "Lancer une sonde",
  ORBIT = "Mettre en orbite",
  LAND = "Poser une sonde",
  SCAN_SECTOR = "Scanner un secteur",
  ANALYZE_DATA = "Analyser les données",
  PLAY_CARD = "Jouer une carte",
  RESEARCH_TECH = "Rechercher une tech",
  PASS = "Passer définitivement",
  MOVE_PROBE = "Déplacer une sonde",
  TRANSFERE_DATA = "Transférer une donnée",
  DISCARD_CARD = "Défausser une carte",
  BUY_CARD = "Acheter une carte",
  TRADE_RESOURCES = "Echanger des ressources",
  ACCOMPLISH_MISSION = "Accomplir une mission"
}

export const MAIN_ACTION_TYPES: ActionType[] = [
  ActionType.LAUNCH_PROBE,
  ActionType.ORBIT,
  ActionType.LAND,
  ActionType.SCAN_SECTOR,
  ActionType.ANALYZE_DATA,
  ActionType.PLAY_CARD,
  ActionType.RESEARCH_TECH,
  ActionType.PASS
];

export type DiskName = 'A' | 'B' | 'C' | 'D' | 'E';
export type SectorNumber = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;

export enum ProbeState {
  IN_SOLAR_SYSTEM = "IN_SOLAR_SYSTEM",
  IN_ORBIT = "IN_ORBIT",
  LANDED = "LANDED",
  /** Capsule transportant un spécimen Mascamite : se déplace comme une sonde, mais n'en est pas une */
  CAPSULE = "CAPSULE"
}

export enum SignalType {
  DATA = "Donnée",
  MEDIA = "Média",
  TOKEN = "Token",
  OTHER = "OTHER"
}

export enum CardType {
  ACTION = "Action",
  CONDITIONAL_MISSION = "Mission Conditionnelle",
  TRIGGERED_MISSION = "Mission Déclenchable",
  END_GAME = "Fin de jeu",
  CENTAURIEN = "Centaurien",
  EXERTIEN = "Exertien",
  UNDEFINED = "Non défini"
}

export enum CostType {
  CREDIT = "Crédit",
  ENERGY = "Energie",
  UNDEFINED = "Non défini"
}

export enum FreeActionType {
  MOVEMENT = "Déplacement",
  DATA = "Donnée",
  MEDIA = "Média",
  PV_MOVEMENT = "PV + Déplacement",
  PV_DATA = "PV + Donnée",
  TWO_MEDIA = "2 Médias",
  UNDEFINED = "Non défini"
}

export enum RevenueType {
  CREDIT = "Crédit",
  ENERGY = "Energie",
  CARD = "Carte",
  DATA = "Data",
  MEDIA = "Média",
  UNDEFINED = "Non défini"
}

export enum SectorType {
  BLUE = "Bleu",
  RED = "Rouge",
  YELLOW = "Jaune",
  BLACK = "Noir",
  DECK = "Pioche",
  ROW = "Rangée",
  PROBE = "Sonde",
  EARTH = "Terre",
  MERCURY = "Mercure",
  VENUS = "Venus",
  MARS = "Mars",
  JUPITER = "Jupiter",
  SATURN = "Saturne",
  VIRGINIS = "61 Virginis",
  KEPLER = "Kepler 22",
  PROXIMA = "Proxima Centauri",
  BARNARD = "Etoile de Barnard",
  SIRIUS = "Sirius A",
  PROCYON = "Procyon",
  VEGA = "Vega",
  PICTORIS = "Beta Pictoris",
  OUMUAMUA = "Oumuamua",
  ANOMALY = "Anomalie",
  ANY = "quelconque",
  UNDEFINED = "Non défini"
}

export enum TechnologyCategory {
  EXPLORATION = "Exploration",
  OBSERVATION = "Observation",
  COMPUTING = "Informatique",
  EXPLORATION_OR_OBSERVATION = "Exploration ou Observation",
  ANY = "quelconque"
}

export enum LifeTraceType {
  RED = "Rouge",
  YELLOW = "Jaune",
  BLUE = "Bleu",
  ANY = "quelconque"
}

export enum LifeTraceLocation {
  TRIANGLE = "triangle",
  SPECIES = "species"
}

export enum EventType {
  PROBE_LAUNCHED = "PROBE_LAUNCHED",
  PROBE_MOVED = "PROBE_MOVED",
  PROBE_ORBITED = "PROBE_ORBITED",
  PROBE_LANDED = "PROBE_LANDED",
  SECTOR_SCANNED = "SECTOR_SCANNED",
  SECTOR_COVERED = "SECTOR_COVERED",
  DATA_ANALYZED = "DATA_ANALYZED",
  SPECIES_DISCOVERED = "SPECIES_DISCOVERED",
  TECHNOLOGY_RESEARCHED = "TECHNOLOGY_RESEARCHED",
  SYSTEM_ROTATED = "SYSTEM_ROTATED",
  ROUND_ENDED = "ROUND_ENDED",
  GAME_ENDED = "GAME_ENDED"
}

export enum AlienBoardType {
  ANOMALIES = "Anomalies",
  OUMUAMUA = "Oumuamua",
  EXERTIENS = "Exertiens",
  MASCAMITES = "Mascamites",
  CENTAURIENS = "Centauriens"
}

export enum ObjectiveCategory {
  TECHNOLOGY = "TECHNOLOGY",
  MISSION = "MISSION",
  REVENUE = "REVENUE",
  OTHER = "OTHER"
}

export type SpeciesDiscoveryCode = 'NO_MARKERS' | 'NO_SPACE' | 'PLACED' | 'DISCOVERED';
