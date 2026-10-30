import { AIController } from '../src/ai/AIController';
import { AITurn } from '../src/ai/AITurn';
import { TechnologySystem } from '../src/systems/TechnologySystem';
import { CardSystem } from '../src/systems/CardSystem';
import { Game, InteractionState, LifeTraceType, Probe, ProbeState, TechnologyCategory } from '../src/core/types';
import { createTestGame, getPlayer } from './helpers/gameFixture';

const P1 = 'player_0';

const probe = (id: string, state: ProbeState, planetId?: string): Probe => ({
  id, ownerId: P1, position: { x: 0, y: 0 }, solarPosition: { disk: 'B', sector: 1, level: 2 }, state, isOrbiter: state === ProbeState.IN_ORBIT, isLander: state === ProbeState.LANDED, planetId,
});

/** Résout une file d'interactions pour le robot P1 */
const resolve = (game: Game, queue: InteractionState[]) => AIController.processInteractionQueue(game, queue, 'seq', getPlayer(game, P1));

describe('Robots : interactions résolues par AIController', () => {
  let game: Game;

  beforeEach(async () => {
    game = await createTestGame();
    game.currentPlayerIndex = 0;
    game.players.forEach(p => { p.type = 'robot'; });
  });

  test('réserve toutes les cartes demandées', () => {
    const reserved = getPlayer(game, P1).reservedCards.length;
    const res = resolve(game, [{ type: 'RESERVING_CARD', count: 2, selectedCards: [] }]);
    expect(getPlayer(res.updatedGame, P1).reservedCards).toHaveLength(reserved + 2);
  });

  test('prend toutes les cartes gagnées', () => {
    const hand = CardSystem.getHandCards(getPlayer(game, P1)).length;
    const res = resolve(game, [{ type: 'ACQUIRING_CARD', count: 2, isFree: true }]);
    expect(CardSystem.getHandCards(getPlayer(res.updatedGame, P1))).toHaveLength(hand + 2);
  });

  test('achat impossible (Médias insuffisants) : rien ne change', () => {
    getPlayer(game, P1).mediaCoverage = 0;
    const res = resolve(game, [{ type: 'ACQUIRING_CARD', count: 1 }]);
    expect(getPlayer(res.updatedGame, P1).cards).toHaveLength(getPlayer(game, P1).cards.length);
  });

  test('technologie Informatique : colonne d\'ordinateur libre choisie, technologie acquise', () => {
    const offered = TechnologySystem.acquirableTechs(game, P1, { categories: [TechnologyCategory.COMPUTING] }).map(t => TechnologySystem.stackId(t));
    const res = resolve(game, [{ type: 'ACQUIRING_TECH', categories: [TechnologyCategory.COMPUTING] }]);
    const player = getPlayer(res.updatedGame, P1);
    expect(player.technologies).toHaveLength(1);
    expect(offered).toContain(TechnologySystem.stackId(player.technologies[0]));
    expect(Object.values(player.dataComputer.slots).some(s => s.technologyId)).toBe(true);
  });

  test.each(['REMOVING_ORBITER', 'REMOVING_LANDER'] as const)('%s : retire sa propre sonde', type => {
    const mars = game.board.planets.find(p => p.id === 'mars')!;
    const mine = probe('p1', type === 'REMOVING_ORBITER' ? ProbeState.IN_ORBIT : ProbeState.LANDED, 'mars');
    if (type === 'REMOVING_ORBITER') mars.orbiters = [mine]; else mars.landers = [mine];
    getPlayer(game, P1).probes = [mine];

    const res = resolve(game, [{ type }]);

    const after = res.updatedGame.board.planets.find(p => p.id === 'mars')!;
    expect(type === 'REMOVING_ORBITER' ? after.orbiters : after.landers).toHaveLength(0);
  });

  test('niveau PASS : trace de vie placée automatiquement (premier emplacement prévu)', () => {
    getPlayer(game, P1).aiDifficulty = 'PASS';
    const res = resolve(game, [{ type: 'PLACING_LIFE_TRACE', color: LifeTraceType.RED }]);
    const traces = res.updatedGame.board.alienBoards.flatMap(b => b.lifeTraces.filter(t => t.playerId === P1));
    expect(traces).toEqual([expect.objectContaining({ type: LifeTraceType.RED })]);
  });

  test('Observation III : défausse la première carte pour un signal', () => {
    const card = CardSystem.getHandCards(getPlayer(game, P1))[0];
    const res = resolve(game, [{ type: 'CHOOSING_OBS3_ACTION' }]);
    expect(res.updatedGame.decks.discardPile.map(c => c.id)).toContain(card.id);
  });

  test('interaction que le robot ne sait pas résoudre : signalée dans l\'historique', () => {
    const res = resolve(game, [{ type: 'ANALYZING' }]);
    expect(res.historyEntries.map(e => e.message)).toContain("AI ne peut pas gérer l'interaction: ANALYZING");
    expect(res.updatedGame.players).toEqual(game.players);
  });

  test('AITurn.playStep, niveau PASS : le robot passe en gardant 4 cartes au plus', () => {
    const player = getPlayer(game, P1);
    player.aiDifficulty = 'PASS';
    let step = AITurn.playStep(game);
    for (let i = 0; i < 10 && step.kind === 'UPDATED'; i++) step = AITurn.playStep(step.updatedGame);
    expect(step.kind).toBe('PASS');
    if (step.kind === 'PASS') expect(step.cardsToKeep.length).toBe(Math.min(4, CardSystem.getHandCards(player).length));
  });
});
