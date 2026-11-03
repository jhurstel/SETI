import { CardSystem } from '../src/systems/CardSystem';
import { SpeciesSystem } from '../src/systems/SpeciesSystem';
import { ScoreManager } from '../src/core/ScoreManager';
import { AlienBoardType, CardType, CostType, FreeActionType, Game, LifeTraceType, Mission, ProbeState, RevenueType, TechnologyCategory } from '../src/core/types';
import { createTestGame, getPlayer, makeCard } from './helpers/gameFixture';
import { revealText, textFor } from '../src/core/historyText';

const P1 = 'player_0';

/** Mission « déclenchable » du joueur, avec son buff permanent */
function addTriggeredMission(game: Game, buffType: string): void {
  const player = getPlayer(game, P1);
  player.missions.push({ id: 'm', cardId: 'c', name: 'Mission test', description: '', ownerId: P1, requirements: [{ id: 'r', type: buffType, value: `${buffType}:pv:1` }], completedRequirementIds: [], fulfillableRequirementIds: [], completed: false } as Mission);
  player.permanentBuffs.push({ type: buffType, value: `${buffType}:pv:1`, id: 'r', source: 'Mission test' });
}

describe('Cartes : cas limites et refus', () => {
  let game: Game;

  beforeEach(async () => {
    game = await createTestGame();
    game.currentPlayerIndex = 0;
  });

  describe('acquireCard', () => {
    test('achat dans la pioche : message dédié', () => {
      getPlayer(game, P1).mediaCoverage = 5;
      const res = CardSystem.acquireCard(game, P1, undefined, {}, 's');
      const message = res.historyEntries[0].message;
      expect(revealText(message)).toMatch(/^paye 3 médias pour acheter ".+" depuis la pioche$/);
      // La carte piochée n'est lisible que par celui qui l'a achetée
      expect(textFor(message, P1)).toBe(revealText(message));
      expect(textFor(message, 'player_1')).toBe('paye 3 médias pour acheter une carte depuis la pioche');
      expect(getPlayer(res.updatedGame, P1).mediaCoverage).toBe(2);
    });

    test.each([
      [FreeActionType.PV_MOVEMENT, ' et gagne 1 PV et 1 Déplacement', { score: 1 }],
      [FreeActionType.PV_DATA, ' et gagne 1 PV et 1 Donnée', { score: 1, data: 1 }],
      [FreeActionType.TWO_MEDIA, ' et gagne 2 Médias', { mediaCoverage: 2 }],
    ])('carte gagnée avec son action gratuite (%s)', (freeAction, suffix, gains) => {
      game.decks.cardRow[0] = makeCard('row', { freeAction });
      const player = getPlayer(game, P1);
      Object.assign(player, { data: 0, mediaCoverage: 0 });
      const before = { score: player.score, data: 0, mediaCoverage: 0 };

      const res = CardSystem.acquireCard(game, P1, 'row', { isFree: true, triggerFreeAction: true }, 's');

      const after = getPlayer(res.updatedGame, P1);
      expect(res.historyEntries[0].message).toBe(`gagne "Carte row" de la rangée${suffix}`);
      Object.entries(gains).forEach(([key, value]) => expect(after[key as 'score']).toBe(before[key as 'score'] + value));
      expect(after.cards.find(c => c.id === 'row')!.isRevealed).toBe(true);
      if (freeAction === FreeActionType.PV_MOVEMENT) expect(res.newPendingInteractions).toEqual([{ type: 'MOVING_PROBE', count: 1, sequenceId: 's' }]);
    });
  });

  test('previewImmediateBonuses : gains annoncés par la carte, avant de la jouer', () => {
    const card = makeCard('p', {
      immediateEffects: [
        { type: 'GAIN', target: 'MEDIA', value: 2 },
        { type: 'ACTION', target: 'LAND', value: 1 },
        { type: 'ACTION', target: 'TECH', value: { amount: 1, scope: TechnologyCategory.EXPLORATION } },
      ],
      passiveEffects: [{ type: 'ATMOSPHERIC_ENTRY', value: 1 }, { type: 'IGNORE_PROBE_LIMIT', value: 1 }],
    });
    expect(CardSystem.previewImmediateBonuses(card)).toEqual(expect.objectContaining({
      media: 2, landing: 1, technologies: [{ amount: 1, scope: TechnologyCategory.EXPLORATION }], atmosphericEntry: true, ignoreProbeLimit: true,
    }));
  });

  test("achat dans une pioche vide : refusé, les Médias ne sont pas dépensés (régression)", () => {
    getPlayer(game, P1).mediaCoverage = 5;
    game.decks.cards = [];
    const res = CardSystem.buyCard(game, P1);
    expect(res.error).toBe('La pioche est vide');
    expect(res.updatedGame).toBe(game);
    expect(getPlayer(game, P1).mediaCoverage).toBe(5);
  });

  describe('playCard : refus sans changement', () => {
    test('joueur ou carte inconnus', () => {
      expect(() => CardSystem.playCard(game, 'inconnu', 'x')).toThrow('Joueur introuvable');
      expect(CardSystem.playCard(game, P1, 'inconnue').updatedGame).toBe(game);
    });

    test('crédits ou énergie insuffisants', () => {
      const player = getPlayer(game, P1);
      player.cards.push(makeCard('credit', { cost: 3 }), makeCard('energy', { cost: 2, costType: CostType.ENERGY }));
      player.credits = 2;
      player.energy = 1;
      expect(CardSystem.playCard(game, P1, 'credit').updatedGame).toBe(game);
      expect(CardSystem.playCard(game, P1, 'energy').updatedGame).toBe(game);
    });
  });

  test.each([
    [1, 'GAIN_ON_PLAY_1_CREDIT'],
    [2, 'GAIN_ON_PLAY_2_CREDITS'],
    [3, 'GAIN_ON_PLAY_3_CREDITS'],
  ])('mission « jouer une carte à %i crédit(s) » : signalée comme à recouvrir, pas pour un autre coût', (cost, buffType) => {
    addTriggeredMission(game, buffType);
    getPlayer(game, P1).cards.push(makeCard('cible', { cost }), makeCard('autre', { cost: cost === 1 ? 2 : 1 }));
    getPlayer(game, P1).credits = 5;
    const triggered = (cardId: string) => CardSystem.playCard(game, P1, cardId).historyEntries.some(e => e.message === 'déclenche une mission à recouvrir');
    expect(triggered('cible')).toBe(true);
    expect(triggered('autre')).toBe(false);
  });

  test('récompenses de mission : sonde, déplacements, trace bleue', () => {
    getPlayer(game, P1).mediaCoverage = 8;
    expect(CardSystem.evaluateMission(game, P1, 'GAIN_IF_8_MEDIA:probe:1:move:2:bluelifetrace:1')).toEqual({
      probe: 1, movements: 2, lifetraces: [{ amount: 1, scope: LifeTraceType.BLUE }],
    });
  });

  describe('Décompte des cartes Fin de partie', () => {
    const endGame = (passiveEffects: { type: string; target?: string; value: number }[]) => {
      getPlayer(game, P1).playedCards.push(makeCard('fin', { type: CardType.END_GAME, passiveEffects }));
      return ScoreManager.calculateFinalScore(game, P1).missionEndGame;
    };

    test('orbiteurs et atterrisseurs sur une planète (lunes comprises)', () => {
      const jupiter = game.board.planets.find(p => p.id === 'jupiter')!;
      const own = { ownerId: P1 } as never;
      jupiter.orbiters = [own];
      jupiter.landers = [own];
      jupiter.satellites![0].landers = [own];
      expect(endGame([{ type: 'SCORE_PER_ORBITER_LANDER', target: 'jupiter', value: 2 }])).toBe(6);
    });

    test('traces de vie rouges et bleues, technologies Exploration et Observation', () => {
      const trace = (type: LifeTraceType) => ({ id: type, type, playerId: P1 });
      getPlayer(game, P1).lifeTraces = [trace(LifeTraceType.RED), trace(LifeTraceType.BLUE), trace(LifeTraceType.BLUE)] as never;
      const techs = game.board.technologyBoard.available;
      getPlayer(game, P1).technologies = [techs.find(t => t.type === TechnologyCategory.EXPLORATION)!, ...techs.filter(t => t.type === TechnologyCategory.OBSERVATION).slice(0, 2)];

      expect(endGame([
        { type: 'SCORE_PER_LIFETRACE', target: 'red', value: 1 },
        { type: 'SCORE_PER_LIFETRACE', target: 'blue', value: 1 },
        { type: 'SCORE_PER_TECH_CATEGORY', target: 'exploration', value: 3 },
        { type: 'SCORE_PER_TECH_CATEGORY', target: 'observation', value: 1 },
      ])).toBe(1 + 2 + 3 + 2);
    });

    test('sonde sur un champ d\'astéroïdes : pas de points sans sonde', () => {
      getPlayer(game, P1).probes = [{ id: 'p', ownerId: P1, position: { x: 0, y: 0 }, solarPosition: { disk: 'A', sector: 1, level: 0 }, state: ProbeState.IN_ORBIT, isOrbiter: true, isLander: false }];
      expect(endGame([{ type: 'SCORE_IF_PROBE_ON_ASTEROID', value: 13 }])).toBe(0);
    });
  });

  describe('Réservation et défausse : cartes Exertiens refusées', () => {
    test('une carte Exertien (hors de la main) ne se réserve pas et ne se défausse pas pour son revenu', () => {
      getPlayer(game, P1).cards.push(makeCard('ex', { type: CardType.EXERTIEN, revenue: RevenueType.CREDIT }));

      const reserved = CardSystem.reserveCards(game, P1, ['ex'], 's');
      expect(reserved.reservedCount).toBe(0);
      expect(reserved.updatedGame).toBe(game);
      expect(CardSystem.discardCardForRevenue(game, P1, 'ex', 's').updatedGame).toBe(game);
    });

    test.each([
      [RevenueType.CREDIT, 'CREDIT'],
      [RevenueType.ENERGY, 'ENERGY'],
      [RevenueType.MEDIA, 'MEDIA'],
      [RevenueType.DATA, 'DATA'],
      [RevenueType.CARD, 'CARD'],
    ])('ressource du revenu %s : %s', (revenue, resource) => {
      expect(CardSystem.revenueResource(revenue)).toBe(resource);
    });
  });

  test("mission déclenchable : un cercle déjà prêt à recouvrir ne l'est pas une seconde fois", () => {
    addTriggeredMission(game, 'GAIN_ON_LAUNCH');
    const player = getPlayer(game, P1);
    expect(CardSystem.processMissionBuffs(player, b => b.type === 'GAIN_ON_LAUNCH')).toBe(true);
    expect(CardSystem.processMissionBuffs(player, b => b.type === 'GAIN_ON_LAUNCH')).toBe(false);
    expect(player.missions[0].fulfillableRequirementIds).toEqual(['r']);

    // Cercle déjà recouvert : plus rien à préparer
    player.missions[0].fulfillableRequirementIds = [];
    player.missions[0].completedRequirementIds = ['r'];
    expect(CardSystem.processMissionBuffs(player, b => b.type === 'GAIN_ON_LAUNCH')).toBe(false);
  });

  describe('Paliers neutres', () => {
    const milestone = () => Number(Object.keys(game.neutralMilestonesAvailable)[0]);
    /** Plateau 0 révélé comme `species`, avec déjà une trace rouge et une jaune : le marqueur neutre complète la découverte */
    const almostDiscovered = (species: AlienBoardType) => {
      const board = game.board.alienBoards[0];
      board.speciesId = species;
      board.lifeTraces = [
        { id: 'r', type: LifeTraceType.RED, playerId: P1 },
        { id: 'y', type: LifeTraceType.YELLOW, playerId: P1 },
      ];
    };

    test('le marqueur neutre fait découvrir les Anomalies : elles apparaissent', () => {
      almostDiscovered(AlienBoardType.ANOMALIES);
      const res = SpeciesSystem.placeNeutralMilestone(game, milestone());
      expect(res.updatedGame.board.alienBoards[0].isDiscovered).toBe(true);
      expect((res.updatedGame.board.solarSystem.extraCelestialObjects || []).filter(o => o.type === 'anomaly')).toHaveLength(3);
    });

    test('palier neutre atteint sans emplacement libre : aucune trace, le palier est noté dans l\'historique', () => {
      game.board.alienBoards.forEach(board => {
        board.lifeTraces = [LifeTraceType.RED, LifeTraceType.YELLOW, LifeTraceType.BLUE].map(type => ({ id: `t-${type}`, type, playerId: P1 }));
      });
      expect(SpeciesSystem.placeNeutralMilestone(game, milestone()).code).toBe('NO_SPACE');

      getPlayer(game, P1).score = milestone();
      const res = ScoreManager.checkScoreMilestones(game, P1);
      expect(res.historyEntries.map(e => e.message)).toContain(`a atteint le palier neutre ${milestone()} PV mais aucun emplacement libre sur les plateaux Alien.`);
      expect(res.updatedGame.board.alienBoards.every(b => b.lifeTraces.length === 3)).toBe(true);
    });

    test('le marqueur neutre fait découvrir les Exertiens : deux paliers apparaissent', () => {
      almostDiscovered(AlienBoardType.EXERTIENS);
      const best = Math.max(...game.players.map(p => p.score));
      const res = SpeciesSystem.placeNeutralMilestone(game, milestone());
      expect(res.updatedGame.exertienMilestones).toEqual([best + 20, best + 40]);
    });
  });
});
