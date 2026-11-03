import { serializeGame, deserializeGame, SAVE_VERSION, SaveVersionError } from '../src/core/GamePersistence';
import { cloneGame } from '../src/core/cloneGame';
import { Game, HistoryEntry } from '../src/core/types';
import { createTestGame, getPlayer, makeCard } from './helpers/gameFixture';
import { CardSystem } from '../src/systems/CardSystem';

describe('GamePersistence', () => {
  let game: Game;
  let previous: Game;

  beforeEach(async () => {
    game = await createTestGame();
    previous = cloneGame(game);
  });

  const entry = (message: string, sequenceId?: string, withState = true): HistoryEntry => ({
    id: message, message, playerId: 'player_0', timestamp: 1, sequenceId, previousState: withState ? previous : undefined,
  });

  test('aller-retour JSON : la partie est restituée à l\'identique', () => {
    const log = [entry('a'), entry('b')];
    const { game: restored, historyLog } = deserializeGame(JSON.stringify(serializeGame(game, log)));

    expect(restored.players).toEqual(game.players);
    expect(restored.board).toEqual(game.board);
    expect(restored.decks).toEqual(game.decks);
    expect(historyLog.map(e => e.message)).toEqual(['a', 'b']);
    expect(historyLog[0].previousInteractionState).toEqual({ type: 'IDLE' });
  });

  test('format 2 : les cartes Oumuamua à jetons et à signal reçoivent leur effet (ET.25 en main, mission ET.21 en jeu)', () => {
    const player = getPlayer(game, 'player_0');
    player.cards.push(makeCard('ET.25', { cost: 1, permanentEffects: [{ type: 'GAIN_ON_TOKEN_AND_LAND', target: 'move', value: 'GAIN_ON_TOKEN_AND_LAND:move:1' }] }));
    player.missions.push({
      id: 'm', cardId: 'ET.21', name: 'Visiteur Céleste', description: '', ownerId: player.id, completedRequirementIds: [], fulfillableRequirementIds: [], completed: false,
      requirements: [{ id: 'mission-ET.21-req-0', type: 'GAIN_ON_OUMUAMUA_SIGNAL', value: 'x' }, { id: 'mission-ET.21-req-1', type: 'GAIN_IF_PAY_FOR_LIFETRACE', value: 'y' }],
    });
    player.permanentBuffs.push({ id: 'mission-ET.21-req-0', type: 'GAIN_ON_OUMUAMUA_SIGNAL', value: 'x', source: 'Visiteur Céleste' });
    player.tokens = 1;
    player.credits = 5;
    const saved = { ...serializeGame(game, []), saveVersion: 2 };

    const { game: restored } = deserializeGame(JSON.stringify(saved));
    const p = getPlayer(restored, 'player_0');
    const card = p.cards.find(c => c.id === 'ET.25')!;
    expect(card.permanentEffects).toEqual([]);
    expect(card.passiveEffects).toContainEqual({ type: 'DISCARD_TOKENS_THEN_LAND', target: 'move', value: 2 });
    expect(p.missions[0].requirements.map(r => r.type)).toEqual(['GAIN_IF_PAY_FOR_LIFETRACE']);
    expect(p.permanentBuffs.some(b => b.type === 'GAIN_ON_OUMUAMUA_SIGNAL')).toBe(false);
    // La carte jouée propose maintenant la défausse de jetons
    expect(CardSystem.playCard(restored, 'player_0', 'ET.25').newPendingInteractions).toContainEqual(expect.objectContaining({ type: 'DISCARDING_TOKEN' }));
  });

  test('retire l\'historique d\'annulation du moteur des anciennes sauvegardes', () => {
    const old = { ...serializeGame(game, [entry('a')]), history: [{ state: previous, timestamp: 1 }] };
    const { game: restored } = deserializeGame(JSON.stringify(old));

    expect('history' in restored).toBe(false);
    expect(restored.players).toEqual(game.players);
  });

  test('ne conserve l\'état d\'annulation que pour la dernière séquence', () => {
    const log = [entry('ancien', 'seq-1'), entry('ancien 2', 'seq-1'), entry('dernier', 'seq-2'), entry('dernier bis', 'seq-2')];
    const saved = serializeGame(game, log);

    expect(saved.gameLog.map(e => !!e.previousState)).toEqual([false, false, true, true]);
  });

  test('la dernière entrée sans séquence garde son état d\'annulation', () => {
    const saved = serializeGame(game, [entry('a'), entry('b')]);
    expect(saved.gameLog.map(e => !!e.previousState)).toEqual([false, true]);
  });

  test('les états sauvegardés ne contiennent pas le journal (pas de récursion)', () => {
    const saved = serializeGame(game, [entry('a')]);
    expect('gameLog' in saved.gameLog[0].previousState!).toBe(false);
  });

  test('la sauvegarde porte la version du format, absente de la partie relue', () => {
    const saved = serializeGame(game, [entry('a')]);
    expect(saved.saveVersion).toBe(SAVE_VERSION);
    const { game: restored } = deserializeGame(JSON.stringify(saved));
    expect('saveVersion' in restored).toBe(false);
  });

  test('migre une sauvegarde sans version (paliers Centauriens en scores), journal compris', () => {
    const saved = serializeGame(game, [entry('a')]) as unknown as Record<string, unknown>;
    delete saved.saveVersion;
    const legacy = JSON.parse(JSON.stringify(saved));
    legacy.players[0].centaurienMilestones = [12, 30];
    legacy.gameLog[0].previousState.players[0].centaurienMilestones = [12];

    const { game: restored, historyLog } = deserializeGame(JSON.stringify(legacy));
    const id = restored.players[0].id;
    expect(restored.players[0].centaurienMilestones).toEqual([
      { id: `centaurien-${id}-0`, score: 12 },
      { id: `centaurien-${id}-1`, score: 30 },
    ]);
    expect(historyLog[0].previousState!.players[0].centaurienMilestones).toEqual([{ id: `centaurien-${id}-0`, score: 12 }]);
  });

  test('migration : joueur sans paliers, paliers déjà en marqueurs, sauvegarde sans journal', () => {
    const legacy = JSON.parse(JSON.stringify(serializeGame(game, [])));
    delete legacy.saveVersion;
    delete legacy.gameLog;
    delete legacy.players[0].centaurienMilestones;
    legacy.players[1].centaurienMilestones = [{ id: 'm', score: 20 }, 35];

    const { game: restored, historyLog } = deserializeGame(JSON.stringify(legacy));
    expect(restored.players[0].centaurienMilestones).toEqual([]);
    expect(restored.players[1].centaurienMilestones).toEqual([{ id: 'm', score: 20 }, { id: `centaurien-${restored.players[1].id}-1`, score: 35 }]);
    expect(historyLog).toEqual([]);
  });

  test('migration : état sans joueurs ; entrées du journal sans identifiant, date ni joueur', () => {
    const legacy = { gameLog: [{ message: 'ancien' }] };
    const { historyLog } = deserializeGame(JSON.stringify(legacy));
    expect(historyLog).toEqual([expect.objectContaining({ message: 'ancien', playerId: '', id: undefined, previousState: undefined })]);

    const saved = serializeGame(game, [{ message: 'sans id', playerId: 'player_0' } as HistoryEntry]);
    expect(saved.gameLog[0]).toMatchObject({ id: '', timestamp: 0, message: 'sans id' });
  });

  test("refuse une sauvegarde d'un format plus récent", () => {
    const saved = { ...serializeGame(game, []), saveVersion: SAVE_VERSION + 1 };
    expect(() => deserializeGame(JSON.stringify(saved))).toThrow(SaveVersionError);
  });

  test('ne modifie pas la partie sauvegardée', () => {
    const before = JSON.stringify(game);
    serializeGame(game, [entry('a')]);
    expect(JSON.stringify(game)).toBe(before);
  });
});
