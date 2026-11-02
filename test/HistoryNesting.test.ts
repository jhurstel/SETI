import { GameSession } from '../src/session/GameSession';
import { TechnologySystem } from '../src/systems/TechnologySystem';
import { ActionType, GamePhase, Probe, ProbeState, TechnologyCategory } from '../src/core/types';
import { AITurn } from '../src/ai/AITurn';
import { createTestGame, getPlayer } from './helpers/gameFixture';

const P1 = 'player_0';

describe('historique : les conséquences d\'une action de robot restent sous elle', () => {
  test('régression : le robot joue « Rover Perseverance » ; l\'atterrissage gagné et ses gains suivent la carte', async () => {
    const game = await createTestGame();
    game.phase = GamePhase.PLAYING;
    game.currentPlayerIndex = 0;
    const robot = getPlayer(game, P1);
    robot.type = 'robot';
    robot.credits = 10;
    robot.energy = 10;
    const probe: Probe = { id: 'p1', ownerId: P1, position: { x: 0, y: 0 }, solarPosition: { disk: 'B', sector: 1, level: 2 }, state: ProbeState.IN_SOLAR_SYSTEM, isOrbiter: false, isLander: false };
    robot.probes = [probe];
    game.board.solarSystem.probes = [probe];
    // La carte peut être dans la pioche ou dans un paquet de fin de manche
    const source = [game.decks.cards, game.decks.cardRow, ...Object.values(game.decks.roundDecks)].find(cards => cards.some(c => c.id === '13'))!;
    robot.cards.push(...source.splice(source.findIndex(c => c.id === '13'), 1));
    const logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});

    const step = AITurn['playMainAction'](game, robot, { action: ActionType.PLAY_CARD, data: { cardId: '13' } } as never)!;
    logSpy.mockRestore();

    expect(step).not.toBeNull();
    const messages = step.historyEntries.map(e => e.message);
    expect(messages[0]).toContain('Rover Perseverance');
    expect(messages.some(m => m.includes('Pose une sonde'))).toBe(true);
    const sequence = step.historyEntries[0].sequenceId;
    expect(sequence).toBeTruthy();
    expect(step.historyEntries.every(e => e.sequenceId === sequence)).toBe(true);
  });

  test("régression : le robot analyse ses données ; la trace de vie bleue placée suit l'analyse", async () => {
    const game = await createTestGame();
    game.phase = GamePhase.PLAYING;
    game.currentPlayerIndex = 0;
    const robot = getPlayer(game, P1);
    robot.type = 'robot';
    robot.energy = 5;
    // Ligne du haut de l'ordinateur pleine : l'analyse est possible
    robot.dataComputer.canAnalyze = true;
    const logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    const step = AITurn['playMainAction'](game, robot, { action: ActionType.ANALYZE_DATA } as never);
    logSpy.mockRestore();

    expect(step).not.toBeNull();
    const messages = step!.historyEntries.map(e => e.message);
    expect(messages[0]).toContain('Analyser les données');
    expect(messages.some(m => m.startsWith('place une trace de vie Bleu'))).toBe(true);
    expect(step!.historyEntries.every(e => e.sequenceId === step!.historyEntries[0].sequenceId)).toBe(true);
  });
});

describe('historique : les conséquences d\'une action restent sous elle', () => {
  test('régression : carte « Lanceur Starship » puis technologie choisie (et sa sonde) dans la même séquence', async () => {
    let game = await createTestGame();
    game.currentPlayerIndex = 0;
    const player = getPlayer(game, P1);
    player.credits = 10;
    player.probes = [];
    const index = game.decks.cards.findIndex(c => c.id === '85');
    player.cards.push(...game.decks.cards.splice(index, 1));
    const logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});

    const played = GameSession.dispatch(game, P1, { type: 'PLAY_CARD', cardId: '85' });
    expect(played.error).toBeUndefined();
    expect(played.game.interaction?.type).toBe('ACQUIRING_TECH');
    game = played.game;

    const tech = TechnologySystem.acquirableTechs(game, P1, { categories: [TechnologyCategory.EXPLORATION] })
      .find(t => t.id.startsWith('exploration-1')) ?? TechnologySystem.acquirableTechs(game, P1, { categories: [TechnologyCategory.EXPLORATION] })[0];
    const chosen = GameSession.dispatch(game, P1, { type: 'CHOOSE', choice: { kind: 'TECH', techId: tech.id } });
    logSpy.mockRestore();
    expect(chosen.error).toBeUndefined();

    const cardSequence = played.entries[0].sequenceId;
    expect(cardSequence).toBeTruthy();
    expect([...played.entries, ...chosen.entries].every(e => e.sequenceId === cardSequence)).toBe(true);

    const messages = chosen.entries.map(e => e.message);
    const techIndex = messages.findIndex(m => m.startsWith('acquiert technologie'));
    expect(techIndex).toBe(0);
    const launchIndex = messages.findIndex(m => m.includes('Lancer une sonde') || m.startsWith('lance'));
    if (launchIndex !== -1) expect(launchIndex).toBeGreaterThan(techIndex);
  });
});
