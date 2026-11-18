import { DataLoader } from '../src/core/DataLoader';
import { Card, CardType, FreeActionType, RevenueType, SectorType, TechnologyCategory } from '../src/core/types';
import { conditionText, describeCard, isSentenceSignal, richText, EFFECT_SYMBOLS, TEXT_EFFECTS, unsymbolizedParts } from '../src/ui/components/cardFaceModel';
import { mockFetchFromPublic } from './helpers/gameFixture';

/** Face des cartes : coins, coût, effet en symboles, panneaux (module pur de l'interface, sans React) */

const CSVS = ['main', 'mascamites', 'anomalies', 'oumuamua', 'centauriens', 'exertiens'];
let allCards: Card[];

beforeAll(async () => {
  const fetchSpy = mockFetchFromPublic();
  allCards = [];
  for (const name of CSVS) allCards.push(...await DataLoader.loadCards(`cards/${name}.csv`));
  fetchSpy.mockRestore();
});

const card = (id: string): Card => allCards.find(c => c.id === id)!;

describe('coins et coût', () => {
  test('carte 1 (Pioneer 11) : déplacement, secteur jaune, revenu énergie, coût 0 crédit', () => {
    const face = describeCard(card('1'));
    expect(face.freeActionType).toBe(FreeActionType.MOVEMENT);
    expect(face.freeAction).toEqual({ movements: 1 });
    expect(face.sector).toBe(SectorType.YELLOW);
    expect(face.sectorColor).toBe('yellow');
    expect(face.revenueType).toBe(RevenueType.ENERGY);
    expect(face.revenue).toEqual({ energy: 1 });
    expect(face.cost).toEqual({ amount: 0, kind: 'credit' });
  });

  test('carte payée en énergie : badge énergie', () => {
    const energyCard = allCards.find(c => c.type !== CardType.EXERTIEN && c.costType === 'Energie')!;
    expect(describeCard(energyCard).cost).toEqual({ amount: energyCard.cost, kind: 'energy' });
  });

  test('carte Exertien : danger à la place du coût, ni coins ni revenu', () => {
    const face = describeCard(card('ET.41'));
    expect(face.danger).toBe(6);
    expect(face.cost).toBeNull();
    expect(face.freeAction).toBeNull();
    expect(face.sector).toBeNull();
    expect(face.revenue).toBeNull();
    expect(face.scorePanel).toEqual(expect.objectContaining({ kind: 'endGame', reward: { pv: 14 } }));
  });

  test('la carte reçue n\'est pas modifiée', () => {
    const before = JSON.stringify(card('9'));
    describeCard(card('9'));
    expect(JSON.stringify(card('9'))).toBe(before);
  });
});

describe('effet en symboles', () => {
  test('carte 9 (Falcon Heavy) : 2 sondes puis 1 Média, la limite de sondes ignorée en texte', () => {
    const face = describeCard(card('9'));
    expect(face.effects).toEqual([
      { kind: 'bonus', bonus: { probe: 2 } },
      { kind: 'bonus', bonus: { media: 1 } },
      { kind: 'text', text: 'Limite de sondes ignorée', effectType: 'IGNORE_PROBE_LIMIT' },
    ]);
    expect(unsymbolizedParts(face)).toEqual(['Limite de sondes ignorée']);
  });

  test('carte 124 (Rencontre avec une Comète) : gain sous condition écrit en phrase, avec ses symboles', () => {
    const face = describeCard(card('124'));
    expect(face.effects).toEqual([{ kind: 'bonus', bonus: { movements: 2 } }]);
    // « gagnez » à la ligne
    expect(face.text).toBe('Si vous visitez une comète ce tour-ci,\ngagnez 4 PVs.');
    expect(richText(face.text)).toEqual([{ kind: 'text', text: 'Si vous visitez une comète ce tour-ci,' }, { kind: 'break' }, { kind: 'text', text: 'gagnez' }, { kind: 'bonus', bonus: { pv: 4 } }, { kind: 'text', text: '.' }]);
  });
});

test('signal dans le secteur d\'une étoile ou d\'une planète : signal à la couleur du secteur, « sur … » ou « dans le secteur de … »', () => {
  // Kepler-22 : secteur jaune
  expect(describeCard(card('40')).effects[0]).toEqual({ kind: 'bonus', bonus: { signals: [{ amount: 2, scope: SectorType.YELLOW }] }, caption: 'sur Kepler-22' });
  // Sirius A : secteur bleu
  expect(describeCard(card('41')).effects[0]).toEqual({ kind: 'bonus', bonus: { signals: [{ amount: 2, scope: SectorType.BLUE }] }, caption: 'sur Sirius A' });
  // Saturne : symbole de la planète
  expect(describeCard(card('36')).effects[0]).toEqual({ kind: 'bonus', bonus: { signals: [{ amount: 2, scope: SectorType.SATURN }] }, caption: 'dans le secteur de Saturne' });
});

describe('texte propre à la carte', () => {
  test('les gains déjà dessinés ne sont pas répétés, la précision reste', () => {
    // « Gagnez 2 sondes et 1 Média. Ignorez la limite… » : seule la seconde phrase reste
    expect(describeCard(card('9')).text).toBe('Ignorez la limite de sondes sur le plateau Systéme Solaire pour ces lancements.');
    // Gain sous condition dessiné (visite de comète) : pas répété en texte
    expect(describeCard(card('5')).text).toBe('');
    // Carte Exertien : « DANGER 6 » n'est pas répété
    expect(describeCard(card('ET.41')).text).toBe('');
  });

  test('condition d\'une fin de partie écrite comme sur la carte, PV lus dans le texte faute d\'effet', () => {
    expect(conditionText('Gagnez 3 PVs pour chaque secteur Rouge que vous avez couvert.')).toBe('Pour chaque secteur Rouge que vous avez couvert');
    expect(conditionText('Gagnez 14 PV si vous avez acquis 3 Technologies Exploration.')).toBe('Avoir acquis 3 Technologies Exploration');
    expect(conditionText('Si vous avez une sonde sur un champ d\'astéroïdes, gagnez 13 PVs.')).toBe('Avoir une sonde sur un champ d\'astéroïdes');
    expect(conditionText('Gagnez 1 Carte si vous n\'avez aucune carte en main.')).toBe('N\'avoir aucune carte en main');
    expect(describeCard(card('12')).scorePanel).toEqual(expect.objectContaining({ kind: 'endGame', reward: { pv: 3 } }));
  });
});

test('intitulés des missions déclenchables 106, 128, 129, 138 ; sans onglet quand l\'intitulé dit tout', () => {
  const panel = (id: string) => describeCard(card(id)).mission!;
  expect(panel('106').intro).toBe('Lorsque vous payez ce coût pour jouer une carte en tant qu\'action principale :');
  expect(panel('128').intro).toBe('Lorsque vous visitez une planète (sauf la Terre) :');
  expect(panel('129').intro).toBe('Lorsque vous visitez un champ d\'astéroïdes lors de votre tour :');
  expect(panel('138').intro).toBe('Lorsque vous défaussez une carte de votre main pour cette action gratuite :');
  expect(panel('128').circles.every(c => c.noCriterion)).toBe(true);
  expect(panel('129').circles.every(c => c.noCriterion)).toBe(true);
  expect(panel('106').circles.map(c => c.symbols)).toEqual([1, 2, 3].map(n => [{ kind: 'bonus', bonus: { credits: n } }]));
  // Actions : le symbole suffit, pas d'intitulé (ISS : 3 lancements)
  expect(panel('79').intro).toBeUndefined();
  expect(panel('79').circles[0].symbols).toEqual([{ kind: 'action', action: 'launch' }]);
});

describe('conditions et décomptes', () => {
  const circle = (id: string) => describeCard(card(id)).mission!.circles[0];
  const words = (symbols: { kind: string; text?: string }[]) => symbols.filter(s => s.kind === 'text').map(s => s.text);

  test('seuils : « Avoir au moins » (51 : 8 Médias, 61 : 50 PV)', () => {
    expect(circle('51').symbols).toEqual([{ kind: 'text', text: 'Avoir au moins' }, { kind: 'bonus', bonus: { media: 8 } }]);
    expect(circle('61').symbols).toEqual([{ kind: 'text', text: 'Avoir au moins' }, { kind: 'bonus', bonus: { pv: 50 } }]);
  });

  test('sondes : condition écrite, sans symbole (87, 95, 104)', () => {
    expect(circle('87')).toEqual(expect.objectContaining({ symbols: [], label: 'Avoir une sonde à au moins 5 cases de la Terre' }));
    expect(circle('95')).toEqual(expect.objectContaining({ symbols: [], label: 'Avoir une sonde sur un champ d\'astéroïdes adjacent à la Terre' }));
    expect(circle('104')).toEqual(expect.objectContaining({ symbols: [], label: 'Avoir une sonde sur une comète' }));
  });

  test('« (lunes comprises) » à la ligne, sous « sur Saturne »', () => {
    expect(circle('8').symbols).toEqual([{ kind: 'orbiterOrLander' }, { kind: 'text', text: 'sur Saturne' }, { kind: 'break' }, { kind: 'text', text: '(lunes comprises)' }]);
  });

  test('102 : trois couleurs pour une même espèce, la trace gagnée pour cette espèce', () => {
    expect(words(circle('102').symbols)).toEqual(['pour une même espèce']);
    expect(circle('102').rewardCaption).toBe('pour cette espèce');
  });

  test('fins de partie : 127 écrite, 12 avec son texte à droite de l\'atterrissage, 126 en deux choix', () => {
    expect(describeCard(card('127')).scorePanel).toEqual(expect.objectContaining({ symbols: [{ kind: 'text', text: 'si vous avez une sonde sur un champ d\'astéroïdes' }], reward: { pv: 13 } }));
    const europa = describeCard(card('12'));
    expect(europa.inlineText).toBe('sur une planète ou une lune, même sans la technologie requise.');
    expect(europa.text).toBe('');
    // 81 : « qu'un autre joueur possède déjà » à droite de la technologie, les autres phrases dessous
    const shared = describeCard(card('81'));
    expect(shared.inlineText).toBe('qu\'un autre joueur possède déjà.');
    expect(shared.text).toMatch(/^Ne faites pas pivoter/);
  });

  test('Mascamites : atterrissage dessiné, orbite ou atterrissage (ET.3), jeton résolu dans les récompenses', () => {
    expect(describeCard(card('ET.4')).effects).toEqual([{ kind: 'bonus', bonus: { landing: 1 } }]);
    expect(describeCard(card('ET.3')).effects[0]).toEqual({ kind: 'symbols', symbols: [{ kind: 'action', action: 'orbit' }, { kind: 'text', text: '/' }, { kind: 'action', action: 'land' }] });
    expect(describeCard(card('ET.1')).mission!.circles[0].rewardSymbols).toEqual([{ kind: 'specimen', resolved: true }]);
    expect(describeCard(card('ET.7')).mission!.circles[0].rewardSymbols).toEqual([{ kind: 'text', text: 'Résolvez' }, { kind: 'specimen', resolved: true }, { kind: 'text', text: 'deux fois' }]);
    expect(describeCard(card('ET.8')).mission!.circles[0].rewardSymbols?.[0]).toEqual({ kind: 'text', text: 'Choisissez Jupiter ou Saturne. Consultez tous ses' });
    // Carte 11 : la carte gagnée (rangée ou pioche, au choix) est dessinée
    expect(describeCard(card('11')).effects).toEqual([{ kind: 'bonus', bonus: { anycard: 1 } }]);
    // Carte 15 : « … pour gagner : », puis les gains à la ligne, dans l'ordre du texte et sans virgule
    const reentry = describeCard(card('15'));
    expect(reentry.text).toBe("Retirez l'un de vos orbiteurs de n'importe quelle planète pour gagner :");
    expect(reentry.textGains).toEqual([{ pv: 3 }, { data: 1 }, { anycard: 1 }]);
    // Retours à la ligne : « gagnez » (22), parenthèse finale (25), pas celle d'une phrase suivie d'une autre (30)
    expect(describeCard(card('22')).text).toBe('Si vous visitez Mars ce tour-ci,\ngagnez 4 PVs.');
    expect(describeCard(card('25')).text).toMatch(/ce tour-ci\n\(y compris la Terre\)\.$/);
    // … mais pas après une longue première partie (123)
    expect(describeCard(card('123')).text).toBe("Si vous visitez un champ d'astéroïdes ce tour-ci, gagnez 1 Donnée.");
    // Gain dessiné en tête de phrase : sans « Gagnez » (52, 74, 134), signal de la couleur du secteur (52)
    const parkes = describeCard(card('52')).text;
    expect(parkes).toBe('2 PVs chaque fois que vous marquez un Signal dans un secteur Rouge grâce à cette action.');
    expect(richText(parkes)).toContainEqual({ kind: 'signal', color: 'red', count: undefined });
    expect(describeCard(card('74')).text).toMatch(/^1 Déplacement pour chaque carte/);
    expect(describeCard(card('134')).text).toBe("1 Signal dans un secteur où se trouve l'une de vos sondes.");
    // Signal là où se trouve une sonde : pas de symbole à part, signal quelconque dans la phrase
    const kepler = describeCard(card('28'));
    expect(kepler.effects).toEqual([{ kind: 'bonus', bonus: { movements: 1 } }]);
    expect(richText(kepler.text)).toContainEqual({ kind: 'signal', count: 2 });
    const observatories = describeCard(card('30'));
    expect(observatories.effects).toEqual([]);
    expect(observatories.text).toContain("Choisissez jusqu'à 3 sondes (les vôtres");
    expect(richText(observatories.text)).toContainEqual({ kind: 'signal', count: undefined });
    expect(describeCard(card('126')).effects).toEqual([
      { kind: 'bonus', bonus: { rotation: 1, technologies: [{ amount: 1, scope: TechnologyCategory.EXPLORATION }] } },
      { kind: 'or' },
      { kind: 'bonus', bonus: { rotation: 1, technologies: [{ amount: 1, scope: TechnologyCategory.OBSERVATION }] } },
    ]);
  });
});

describe('panneaux', () => {
  test('carte 2 (Mariner 10) : deux cercles, Mercure → 1 carte, Vénus → 1 Média', () => {
    const mission = describeCard(card('2')).mission!;
    expect(mission.kind).toBe('triggered');
    expect(mission.intro).toBe('Lorsque vous visitez :');
    expect(mission.circles.map(c => [c.label, c.reward])).toEqual([['Mercure', { card: 1 }], ['Vénus', { media: 1 }]]);
  });

  test('mission conditionnelle : condition écrite et récompense', () => {
    const conditional = allCards.find(c => c.type === CardType.CONDITIONAL_MISSION && c.permanentEffects.some(e => e.type === 'GAIN_IF_ORBITER_OR_LANDER'))!;
    const circle = describeCard(conditional).mission!.circles[0];
    // Condition écrite comme sur la carte (« Avoir un orbiteur/atterrisseur sur Vénus »)
    expect(circle.label).toMatch(/^Avoir un orbiteur\/atterrisseur/);
    expect(circle.reward.pv).toBeGreaterThan(0);
  });

  test('carte Fin de partie : panneau doré avec le texte et les PV du décompte', () => {
    const panel = describeCard(card('38')).scorePanel!;
    expect(panel.kind).toBe('endGame');
    expect(panel.text).toMatch(/secteur Rouge/);
    expect(panel.reward).toEqual({ pv: 3 });
  });

  test('carte Centaurien : panneau de réception', () => {
    expect(describeCard(card('ET.31')).scorePanel).toEqual(expect.objectContaining({ kind: 'reception' }));
  });
});

describe('catalogue', () => {
  test('les 193 cartes ont une face, sans effet perdu ni mot-clé inconnu', () => {
    expect(allCards).toHaveLength(193);
    for (const c of allCards) {
      const face = describeCard(c);
      // Chaque effet chargé apparaît : immédiat (un segment chacun), Contrainte (segment ou panneau), mission (un cercle par prérequis)
      const missionCircles = face.mission?.circles.length ?? 0;
      const permanentShown = face.mission ? missionCircles : face.effects.filter(s => s.kind === 'text' && c.permanentEffects.some(e => e.type === s.effectType)).length;
      expect(permanentShown).toBe(c.permanentEffects.length);
      // Signal d'une sonde ou d'une anomalie : dessiné dans la phrase de la carte, pas en segment
      const probeSignals = c.immediateEffects.filter(isSentenceSignal).length;
      expect(face.effects.length).toBeGreaterThanOrEqual(c.immediateEffects.length - probeSignals);
      // Un segment texte vient d'une table (pas du nom brut du mot-clé)
      for (const segment of face.effects) {
        if (segment.kind !== 'text') continue;
        const known = TEXT_EFFECTS[segment.effectType] || EFFECT_SYMBOLS[segment.effectType];
        if (!known) throw new Error(`Carte ${c.id} : mot-clé sans symbole ni texte (${segment.effectType})`);
      }
    }
  });
});
