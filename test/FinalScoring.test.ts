import { ScoreManager } from '../src/core/ScoreManager';
import { TurnManager } from '../src/core/TurnManager';
import { ActionValidator } from '../src/core/ActionValidator';
import { DataLoader } from '../src/core/DataLoader';
import { AITurn } from '../src/ai/AITurn';
import { PassAction } from '../src/actions/PassAction';
import { AlienBoardType, Card, Game, GamePhase, LifeTraceLocation, LifeTraceType, TechnologyCategory, Technology } from '../src/core/types';
import { createTestGame, getPlayer, mockFetchFromPublic } from './helpers/gameFixture';

const P1 = 'player_0';
const P2 = 'player_1';

let exertienCards: Card[];

beforeAll(async () => {
  const fetchSpy = mockFetchFromPublic();
  exertienCards = await DataLoader.loadCards('cards/exertiens.csv');
  fetchSpy.mockRestore();
});

const card = (id: string): Card => structuredClone(exertienCards.find(c => c.id === id)!);
const tech = (type: TechnologyCategory, i: number): Technology => ({ id: `t-${type}-${i}`, name: 't', type, effects: [], bonus: {}, description: '', shorttext: '' } as Technology);

/** Plateau Exertiens découvert à l'index 0. */
function discoverExertiens(game: Game): void {
  const board = game.board.alienBoards[0];
  board.speciesId = AlienBoardType.EXERTIENS;
  board.isDiscovered = true;
  board.lifeTraces = [];
}

describe('Décompte final', () => {
  let game: Game;

  beforeEach(async () => {
    game = await createTestGame();
    game.players.forEach(p => (p.score = 0));
  });

  describe('cartes Exertiens jouées (conditions de fin de partie)', () => {
    test('les conditions sont lues depuis le CSV pour les 15 cartes', () => {
      expect(exertienCards.filter(c => c.passiveEffects.some(e => e.type === 'END_CONDITION'))).toHaveLength(15);
    });

    test('Navette des Confins : 14 PV avec 3 technologies Exploration, 0 sinon', () => {
      const player = getPlayer(game, P1);
      player.playedCards = [card('ET.41')];
      player.technologies = [tech(TechnologyCategory.EXPLORATION, 1), tech(TechnologyCategory.EXPLORATION, 2)];
      expect(ScoreManager.revealExertienCards(game, player)).toEqual([{ name: 'Navette des Confins', danger: 6, points: 0, conditionMet: false }]);

      player.technologies.push(tech(TechnologyCategory.EXPLORATION, 3));
      expect(ScoreManager.revealExertienCards(game, player)[0]).toMatchObject({ points: 14, conditionMet: true });
    });

    test.each([
      ['ET.51', 18, (g: Game) => { getPlayer(g, P1).reservedCards = Array.from({ length: 8 }, () => card('ET.41')); }],
      ['ET.54', 8, (g: Game) => { getPlayer(g, P1).lifeTraces = Array.from({ length: 5 }, (_, i) => ({ id: `l${i}`, type: LifeTraceType.BLUE, playerId: P1 })); }],
      ['ET.44', 12, (g: Game) => {
        g.board.sectors.filter(s => s.color === 'Rouge').slice(0, 2).forEach(s => s.coveredBy.push(P1));
      }],
    ])('%s rapporte %i PV quand sa condition est remplie', (id, points, setup) => {
      getPlayer(game, P1).playedCards = [card(id)];
      setup(game);
      expect(ScoreManager.revealExertienCards(game, getPlayer(game, P1))[0]).toMatchObject({ points, conditionMet: true });
    });

    test('une carte ne rapporte ses PV qu\'une fois (FAQ Q45)', () => {
      const player = getPlayer(game, P1);
      player.playedCards = [card('ET.54')];
      player.lifeTraces = Array.from({ length: 12 }, (_, i) => ({ id: `l${i}`, type: LifeTraceType.RED, playerId: P1 }));
      expect(ScoreManager.revealExertienCards(game, player)[0].points).toBe(8);
    });

    test('les cartes Exertiens non jouées (en main) ne sont pas comptées', () => {
      const player = getPlayer(game, P1);
      player.cards.push(card('ET.52'));
      expect(ScoreManager.revealExertienCards(game, player)).toEqual([]);
    });
  });

  describe('danger', () => {
    test('DANGER des cartes jouées + danger des marqueurs sur la piste Exertiens', () => {
      discoverExertiens(game);
      const player = getPlayer(game, P1);
      player.playedCards = [card('ET.41'), card('ET.43')]; // 6 + 3
      game.board.alienBoards[0].lifeTraces.push({ id: 'm', type: LifeTraceType.RED, playerId: P1, location: LifeTraceLocation.SPECIES, slotIndex: 0 }); // +3
      game.board.alienBoards[0].lifeTraces.push({ id: 'm2', type: LifeTraceType.RED, playerId: P1, location: LifeTraceLocation.SPECIES, slotIndex: 1 });
      const details: string[] = [];

      const danger = ScoreManager.calculateExertienDanger(game, player, details);
      const species = game.species.find(s => s.name === AlienBoardType.EXERTIENS)!;
      const secondSlot = species.fixedSlots.redlifetrace[1].danger || 0;

      expect(danger).toBe(12 + secondSlot);
      // Une ligne par carte et une par marqueur
      expect(details).toEqual([
        expect.stringMatching(/^Carte .+ : danger 6$/),
        expect.stringMatching(/^Carte .+ : danger 3$/),
        'Marqueur rouge : danger 3',
        `Marqueur rouge : danger ${secondSlot}`,
      ]);
    });

    test('les marqueurs ajoutent du danger, même avec une ancienne sauvegarde aux valeurs négatives', () => {
      discoverExertiens(game);
      const species = game.species.find(s => s.name === AlienBoardType.EXERTIENS)!;
      expect(species.fixedSlots.redlifetrace.every(slot => (slot.danger || 0) > 0)).toBe(true);

      species.fixedSlots.redlifetrace[0] = { ...species.fixedSlots.redlifetrace[0], danger: -3 };
      game.board.alienBoards[0].lifeTraces.push({ id: 'm', type: LifeTraceType.RED, playerId: P1, location: LifeTraceLocation.SPECIES, slotIndex: 0 });
      expect(ScoreManager.calculateExertienDanger(game, getPlayer(game, P1))).toBe(3);
    });
  });

  describe('applyFinalScoring', () => {
    beforeEach(() => {
      discoverExertiens(game);
      getPlayer(game, P1).score = 105;
      getPlayer(game, P2).score = 80;
    });

    test('le joueur le plus exposé perd 10 % de son total, arrondi à l\'inférieur', () => {
      getPlayer(game, P1).playedCards = [card('ET.53')]; // danger 9
      getPlayer(game, P2).playedCards = [card('ET.43')]; // danger 3
      const { updatedGame, finalScores } = ScoreManager.applyFinalScoring(game);
      const s1 = finalScores.find(s => s.playerId === P1)!;
      const s2 = finalScores.find(s => s.playerId === P2)!;

      expect(s1.dangerPenalty).toBeGreaterThan(0);
      expect(s1.finalScore).toBe(s1.baseScore + s1.categories.total - s1.dangerPenalty);
      expect(s1.dangerPenalty).toBe(Math.floor((s1.baseScore + s1.categories.total) * 0.1));
      expect(s2.dangerPenalty).toBe(0);
      expect(getPlayer(updatedGame, P1).score).toBe(s1.finalScore);
      expect(updatedGame.finalScores).toEqual(finalScores);
    });

    test("le détail des calculs est enregistré pour l'écran de fin (cartes, danger, pénalité, objectifs)", () => {
      getPlayer(game, P1).playedCards = [card('ET.53')];
      const tile = game.board.objectiveTiles[0];
      tile.markers = [P1];
      const s1 = ScoreManager.applyFinalScoring(game).finalScores.find(s => s.playerId === P1)!;

      expect(s1.details?.speciesBonuses.some(l => l.startsWith('Exertiens — '))).toBe(true);
      expect(s1.details?.danger).toEqual(expect.arrayContaining([expect.stringMatching(/^Carte .+ : danger 9$/), expect.stringMatching(/^Plus exposé au danger : −10 %/)]));
      expect(s1.details?.objectiveTiles).toEqual([expect.stringContaining(`${tile.name} ${tile.side} : `)]);
    });

    test('la pénalité est calculée après tous les PV, y compris ceux des cartes Exertiens', () => {
      const player = getPlayer(game, P1);
      player.playedCards = [card('ET.51')]; // danger 8, +18 PV avec 8 réservations
      player.reservedCards = Array.from({ length: 8 }, () => card('ET.41'));
      const s1 = ScoreManager.applyFinalScoring(game).finalScores.find(s => s.playerId === P1)!;

      expect(s1.categories.exertienCards).toBe(18);
      expect(s1.dangerPenalty).toBe(Math.floor((105 + s1.categories.total) * 0.1));
    });

    test('égalité de danger : tous les ex aequo perdent 10 %', () => {
      getPlayer(game, P1).playedCards = [card('ET.44')]; // 4
      getPlayer(game, P2).playedCards = [card('ET.45')]; // 4
      const { finalScores } = ScoreManager.applyFinalScoring(game);
      expect(finalScores.every(s => s.dangerPenalty > 0)).toBe(true);
    });

    test('pas de pénalité si les Exertiens n\'ont pas été découverts', () => {
      game.board.alienBoards[0].isDiscovered = false;
      getPlayer(game, P1).playedCards = [card('ET.53')];
      expect(ScoreManager.applyFinalScoring(game).finalScores.every(s => s.dangerPenalty === 0)).toBe(true);
    });

    test('pas de pénalité si personne n\'est exposé (danger nul pour tous)', () => {
      expect(ScoreManager.applyFinalScoring(game).finalScores.every(s => s.dangerPenalty === 0)).toBe(true);
    });

    test('historique : révélation des cartes, pénalité et vainqueur', () => {
      getPlayer(game, P1).playedCards = [card('ET.53')];
      const { historyEntries } = ScoreManager.applyFinalScoring(game);
      const messages = historyEntries.map(e => e.message);

      expect(messages[0]).toBe('--- DÉCOMPTE FINAL ---');
      expect(messages.some(m => m.startsWith('révèle ses cartes Exertiens : "Neurolab" (danger 9'))).toBe(true);
      expect(messages.some(m => m.includes('perd') && m.includes('(10 %)'))).toBe(true);
      expect(messages.at(-1)).toMatch(/^Vainqueur/);
    });

    test('ne modifie pas la partie reçue', () => {
      getPlayer(game, P1).playedCards = [card('ET.53')];
      const before = JSON.stringify(game);
      ScoreManager.applyFinalScoring(game);
      expect(JSON.stringify(game)).toBe(before);
    });
  });

  test('determineWinner : meilleur score final, ex aequo compris', () => {
    const base = { baseScore: 0, categories: { missionEndGame: 0, objectiveTiles: 0, speciesBonuses: 0, exertienCards: 0, total: 0 }, revealedExertienCards: [], danger: 0, dangerPenalty: 0 };
    expect(ScoreManager.determineWinner([{ ...base, playerId: 'a', finalScore: 90 }, { ...base, playerId: 'b', finalScore: 95 }])).toEqual(['b']);
    expect(ScoreManager.determineWinner([{ ...base, playerId: 'a', finalScore: 95 }, { ...base, playerId: 'b', finalScore: 95 }])).toEqual(['a', 'b']);
  });

  describe('fin de la dernière manche', () => {
    beforeEach(() => {
      game.currentRound = game.maxRounds;
      game.currentPlayerIndex = 0;
    });

    test('TurnManager.endRound enregistre le décompte final', () => {
      const ended = TurnManager.endRound(game);
      expect(ended.phase).toBe(GamePhase.FINAL_SCORING);
      expect(ended.finalScores).toHaveLength(2);
      ended.players.forEach(p => expect(p.score).toBe(ended.finalScores!.find(s => s.playerId === p.id)!.finalScore));
    });

    test('le dernier joueur à passer déclenche le décompte, journalisé dans l\'historique', () => {
      game.players[1].hasPassed = true;
      const action = new PassAction(P1, getPlayer(game, P1).cards.slice(0, 4).map(c => c.id));
      const updated = action.execute(game);

      expect(updated.phase).toBe(GamePhase.FINAL_SCORING);
      expect(action.historyEntries.some(e => e.message === '--- DÉCOMPTE FINAL ---')).toBe(true);
      expect(action.historyEntries.some(e => e.message.startsWith('--- Tour de'))).toBe(false);
    });

    test('après la fin : plus aucune action, les robots attendent', () => {
      const ended = TurnManager.endRound(game);
      ended.players[ended.currentPlayerIndex].type = 'robot';
      expect(AITurn.playStep(ended)).toEqual({ kind: 'WAIT' });
      expect(ActionValidator.validateAction(ended, new PassAction(ended.players[ended.currentPlayerIndex].id, [])).errors[0].code).toBe('GAME_OVER');
    });
  });
});
