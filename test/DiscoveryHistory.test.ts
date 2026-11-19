import { SpeciesSystem, DISCOVERY_MESSAGE, DISCOVERY_PENDING_LOG } from '../src/systems/SpeciesSystem';
import { InteractionChoices } from '../src/engine/InteractionChoices';
import { AlienBoardType, Game, LifeTraceLocation, LifeTraceType } from '../src/core/types';
import { createTestGame } from './helpers/gameFixture';

const P1 = 'player_0';
const P2 = 'player_1';

/**
 * Historique d'une découverte d'espèce, dans l'ordre du jeu : la trace qui remplit le dernier triangle et l'annonce
 * (pendant le tour) ; à la fin du tour, l'espèce révélée, sa mise en jeu, puis les cartes Alien distribuées.
 */
describe("Historique d'une découverte d'espèce", () => {
  let game: Game;

  beforeEach(async () => {
    game = await createTestGame();
    game.currentPlayerIndex = 0;
  });

  /** Deux triangles remplis (rouge par P2, jaune par P1) : la trace bleue de P1 découvre l'espèce */
  function almostDiscovered(species: AlienBoardType): Game {
    game.board.alienBoards[0].speciesId = species;
    let g = SpeciesSystem.placeLifeTrace(game, 0, LifeTraceType.RED, P2, 'a', LifeTraceLocation.TRIANGLE).updatedGame;
    g = SpeciesSystem.placeLifeTrace(g, 0, LifeTraceType.YELLOW, P1, 'b', LifeTraceLocation.TRIANGLE).updatedGame;
    expect(g.board.alienBoards[0].isDiscovered).toBeFalsy();
    return g;
  }

  test('trace placée et découverte annoncée ; à la fin du tour, espèce révélée et mise en jeu, puis cartes Alien distribuées', () => {
    const before = almostDiscovered(AlienBoardType.ANOMALIES);
    const placed = SpeciesSystem.placeLifeTrace(before, 0, LifeTraceType.BLUE, P1, 'seq', LifeTraceLocation.TRIANGLE);
    expect(placed.historyEntries.map(e => e.message).slice(1)).toEqual([DISCOVERY_MESSAGE, DISCOVERY_PENDING_LOG]);
    expect(placed.historyEntries.every(e => e.sequenceId === 'seq')).toBe(true);
    expect(placed.updatedGame.board.alienBoards[0].isDiscovered).toBeFalsy();

    const res = SpeciesSystem.resolvePendingDiscoveries(placed.updatedGame, P1);
    const messages = res.historyEntries.map(e => e.message);
    expect(res.updatedGame.board.alienBoards[0].isDiscovered).toBe(true);
    expect(placed.updatedGame.board.alienBoards[0].isDiscovered).toBeFalsy();
    expect(messages[0]).toBe("révèle l'espèce découverte : Anomalies !");
    const cards = messages.map((m, i) => (/carte.* Alien .*\(Découverte\)/.test(m) ? i : -1)).filter(i => i !== -1);
    // Une carte pour chacun des deux joueurs (premiers marqueurs de chaque couleur), annoncées en dernier
    expect(cards).toHaveLength(2);
    const setup = messages.findIndex((m, i) => i > 0 && /anomalie/i.test(m));
    expect(setup).toBeGreaterThan(0);
    expect(Math.min(...cards)).toBeGreaterThan(setup);
    // Une même séquence pour toute la découverte
    expect(new Set(res.historyEntries.map(e => e.sequenceId)).size).toBe(1);
  });

  test("choix d'une trace par le joueur : une seule annonce de découverte, à sa place", () => {
    const before = almostDiscovered(AlienBoardType.CENTAURIENS);
    const res = InteractionChoices.placeLifeTrace(before, P1, { type: 'PLACING_LIFE_TRACE', color: LifeTraceType.BLUE, sequenceId: 't' }, 0, LifeTraceType.BLUE, LifeTraceLocation.TRIANGLE);
    const messages = res.historyEntries.map(e => e.message);

    expect(res.error).toBeUndefined();
    expect(messages.filter(m => m === DISCOVERY_MESSAGE)).toHaveLength(1);
    expect(messages.indexOf(DISCOVERY_MESSAGE)).toBe(1);
    expect(messages[2]).toBe(DISCOVERY_PENDING_LOG);
  });

  test('sans découverte : pas d\'annonce', () => {
    game.board.alienBoards[0].speciesId = AlienBoardType.ANOMALIES;
    const res = SpeciesSystem.placeLifeTrace(game, 0, LifeTraceType.RED, P1, 's', LifeTraceLocation.TRIANGLE);
    expect(res.historyEntries.map(e => e.message)).not.toContain(DISCOVERY_MESSAGE);
  });
});
