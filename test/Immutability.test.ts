import { cloneGame } from '../src/core/cloneGame';
import { GameEngine } from '../src/core/Game';
import { GameFactory } from '../src/core/GameFactory';
import { ComputerSystem } from '../src/systems/ComputerSystem';
import { PassAction } from '../src/actions/PassAction';
import { ResearchTechAction } from '../src/actions/ResearchTechAction';
import { AnalyzeDataAction } from '../src/actions/AnalyzeDataAction';
import { Game, GamePhase } from '../src/core/types';
import { createTestGame, getPlayer, mockFetchFromPublic } from './helpers/gameFixture';

const P1 = 'player_0';

describe('cloneGame', () => {
  let game: Game;

  beforeEach(async () => {
    game = await createTestGame();
  });

  test('copie profonde : modifier la copie ne touche pas l\'original', () => {
    const copy = cloneGame(game);
    copy.players[0].credits += 10;
    copy.players[0].dataComputer.slots['1a'].filled = true;
    copy.board.sectors[0].signals[0].marked = true;
    copy.decks.cards.pop();

    expect(game.players[0].credits).not.toBe(copy.players[0].credits);
    expect(game.players[0].dataComputer.slots['1a'].filled).toBe(false);
    expect(game.board.sectors[0].signals[0].marked).toBe(false);
    expect(game.decks.cards.length).toBe(copy.decks.cards.length + 1);
  });

  test('cartes et technologies : champs variables copiés, effets figés et partagés', () => {
    const copy = cloneGame(game);
    const card = game.players[0].cards[0];
    const cardCopy = copy.players[0].cards[0];
    const tech = game.board.technologyBoard.available[0];
    const techCopy = copy.board.technologyBoard.available[0];

    expect(cardCopy).not.toBe(card);
    expect(cardCopy.immediateEffects).toBe(card.immediateEffects);
    expect(Object.isFrozen(card.immediateEffects)).toBe(true);
    expect(techCopy).not.toBe(tech);
    expect(techCopy.bonus).toBe(tech.bonus);

    cardCopy.ownerId = 'autre';
    cardCopy.isRevealed = !card.isRevealed;
    techCopy.ownerId = 'autre';
    expect(card.ownerId).not.toBe('autre');
    expect(cardCopy.isRevealed).not.toBe(card.isRevealed);
    expect(tech.ownerId).not.toBe('autre');
    expect(() => (cardCopy.immediateEffects as unknown[]).push({})).toThrow(TypeError);
  });

  test('donne le même état que structuredClone', () => {
    expect(cloneGame(game)).toEqual(structuredClone(game));
  });

  test('bonus des emplacements, pistes des espèces et prérequis des missions : figés et partagés, le reste copié', () => {
    const player = getPlayer(game, P1);
    player.missions = [{ id: 'm', cardId: 'c', name: 'M', description: '', ownerId: P1, requirements: [{ type: 'GAIN_IF_PROBES', value: 2 }], completedRequirementIds: [], fulfillableRequirementIds: [], completed: false }];
    const copy = cloneGame(game);
    const planet = game.board.planets.find(p => p.orbitFirstBonus)!;
    const planetCopy = copy.board.planets.find(p => p.id === planet.id)!;
    const sector = game.board.sectors[0];
    const species = game.species[0];

    // Partagés (figés)
    expect(planetCopy.orbitFirstBonus).toBe(planet.orbitFirstBonus);
    expect(planetCopy.orbitSlots).toBe(planet.orbitSlots);
    expect(copy.board.sectors[0].firstBonus).toBe(sector.firstBonus);
    expect(copy.species[0].fixedSlots).toBe(species.fixedSlots);
    expect(getPlayer(copy, P1).missions[0].requirements).toBe(player.missions[0].requirements);
    expect(() => { (planetCopy.orbitFirstBonus as { pv?: number }).pv = 99; }).toThrow(TypeError);
    expect(() => { copy.species[0].fixedSlots.redlifetrace.push({}); }).toThrow(TypeError);

    // Copiés : l'état variable reste indépendant
    expect(planetCopy).not.toBe(planet);
    expect(planetCopy.orbiters).not.toBe(planet.orbiters);
    expect(copy.board.sectors[0].signals).not.toBe(sector.signals);
    expect(getPlayer(copy, P1).missions[0]).not.toBe(player.missions[0]);
    getPlayer(copy, P1).missions[0].completedRequirementIds.push('r1');
    expect(player.missions[0].completedRequirementIds).toEqual([]);
  });
});

describe('ComputerSystem.fillSlot', () => {
  test('ne modifie pas l\'ordinateur de la partie d\'origine (régression)', async () => {
    const game = await createTestGame();
    getPlayer(game, P1).data = 2;

    const { updatedGame } = ComputerSystem.fillSlot(game, P1, '1a');

    expect(getPlayer(updatedGame, P1).dataComputer.slots['1a'].filled).toBe(true);
    expect(getPlayer(updatedGame, P1).data).toBe(1);
    expect(getPlayer(game, P1).dataComputer.slots['1a'].filled).toBe(false);
    expect(getPlayer(game, P1).data).toBe(2);
  });
});

describe('GameFactory.initializeGame', () => {
  test('ne modifie pas la partie passée en entrée', async () => {
    const fetchSpy = mockFetchFromPublic();
    const setup = await GameFactory.createGame(['Alice', 'Bob']);
    fetchSpy.mockRestore();
    const deckSize = setup.decks.cards.length;

    GameFactory.initializeGame(setup);

    expect(setup.decks.cards).toHaveLength(deckSize);
    expect(setup.decks.cardRow).toHaveLength(0);
    expect(setup.players.every(p => p.cards.length === 0)).toBe(true);
  });
});

describe('Actions moteur', () => {
  test.each([
    ['ResearchTechAction', (id: string) => new ResearchTechAction(id)],
    ['AnalyzeDataAction', (id: string) => new AnalyzeDataAction(id)],
  ])('%s.execute ne modifie pas la partie reçue (régression)', async (_name, makeAction) => {
    const game = await createTestGame();
    getPlayer(game, P1).mediaCoverage = 8;
    getPlayer(game, P1).energy = 3;
    const before = JSON.stringify(game);

    makeAction(P1).execute(game);

    expect(JSON.stringify(game)).toBe(before);
  });

  test('GameEngine.executeAction ne modifie pas la partie fournie', async () => {
    const game = await createTestGame();
    game.currentPlayerIndex = 0;
    const before = JSON.stringify(game);
    const engine = new GameEngine(game);
    engine.executeAction(new PassAction(P1, getPlayer(game, P1).cards.slice(0, 4).map(c => c.id)));

    expect(JSON.stringify(game)).toBe(before);
    expect(engine.getState().players[0].hasPassed).toBe(true);
  });

  test('GameEngine.executeAction ne garde pas d\'instantané de la partie (régression : l\'état grossissait à chaque action)', async () => {
    const game = await createTestGame();
    game.currentPlayerIndex = 0;
    game.phase = GamePhase.PLAYING;
    const size = JSON.stringify(game).length;

    const result = new GameEngine(game).executeAction(new PassAction(P1, getPlayer(game, P1).cards.slice(0, 4).map(c => c.id)));

    expect(result.success).toBe(true);
    expect(result.updatedState).not.toHaveProperty('history');
    expect(JSON.stringify(result.updatedState).length).toBeLessThan(size * 1.5);
  });
});
