import { AIController } from '../src/ai/AIController';
import { InteractionChoices } from '../src/engine/InteractionChoices';
import { ProbeSystem } from '../src/systems/ProbeSystem';
import { Game, Probe, ProbeState } from '../src/core/types';
import { createTestGame, getPlayer } from './helpers/gameFixture';

/** Carte 84 (Retour d'échantillons) : retirer un de ses atterrisseurs d'une planète ou d'une lune pour 1 trace de vie jaune */
describe("Retour d'échantillons (carte 84)", () => {
  let game: Game;
  let P1: string;
  let P2: string;

  const lander = (id: string, ownerId: string, planetId: string, planetSlotIndex: number): Probe => ({
    id, ownerId, position: { x: 0, y: 0 }, solarPosition: { disk: 'B', sector: 1, level: 2 }, state: ProbeState.LANDED, isOrbiter: false, isLander: true, planetId, planetSlotIndex,
  });
  const planet = (g: Game, id: string) => g.board.planets.find(p => p.id === id)!;
  const moon = (g: Game, id: string) => g.board.planets.flatMap(p => p.satellites || []).find(s => s.id === id)!;
  const interaction = { type: 'REMOVING_LANDER' as const, sequenceId: 'card-84' };

  beforeEach(async () => {
    game = await createTestGame();
    P1 = game.players[0].id;
    P2 = game.players[1].id;
    // Mars : un atterrisseur adverse (case 0) puis le mien (case 2) ; Europe : le mien
    const mine = lander('m1', P1, 'mars', 2);
    const onMoon = lander('m2', P1, 'europa', 0);
    planet(game, 'mars').landers = [lander('o1', P2, 'mars', 0), mine];
    moon(game, 'europa').landers = [onMoon];
    getPlayer(game, P1).probes = [mine, onMoon];
  });

  test('les corps où le joueur a un atterrisseur, lunes comprises', () => {
    expect(ProbeSystem.landerBodies(game, P1).sort()).toEqual(['europa', 'mars']);
    expect(ProbeSystem.landerBodies(game, P2)).toEqual(['mars']);
  });

  test("la case cliquée désigne l'atterrisseur, quelle que soit sa place dans la liste", () => {
    const res = InteractionChoices.removeProbe(game, P1, interaction, 'mars', 2);

    expect(res.error).toBeUndefined();
    expect(planet(res.updatedGame, 'mars').landers.map(l => l.id)).toEqual(['o1']);
    expect(getPlayer(res.updatedGame, P1).probes.map(p => p.id)).toEqual(['m2']);
    // La partie reçue n'est pas modifiée
    expect(planet(game, 'mars').landers).toHaveLength(2);
    // Case d'un adversaire ou case vide : refusé
    expect(InteractionChoices.removeProbe(game, P1, interaction, 'mars', 0).error).toBeDefined();
    expect(InteractionChoices.removeProbe(game, P1, interaction, 'mars', 1).error).toBeDefined();
  });

  test("retrait d'un atterrisseur posé sur une lune", () => {
    const res = InteractionChoices.removeProbe(game, P1, interaction, 'europa', 0);

    expect(res.error).toBeUndefined();
    expect(moon(res.updatedGame, 'europa').landers).toHaveLength(0);
    expect(res.newPendingInteractions).toEqual([expect.objectContaining({ type: 'PLACING_LIFE_TRACE' })]);
  });

  test("le retrait et son gain forment une seule ligne d'historique", () => {
    const res = InteractionChoices.removeProbe(game, P1, interaction, 'mars');

    expect(res.historyEntries[0].message).toMatch(/^retire un atterrisseur de Mars et gagne /);
    expect(res.historyEntries.filter(e => e.message.startsWith('gagne '))).toHaveLength(0);
    expect(res.historyEntries.every(e => e.sequenceId === 'card-84')).toBe(true);
  });

  test("robot : retire un atterrisseur posé sur une lune", () => {
    planet(game, 'mars').landers = [];
    getPlayer(game, P1).probes = getPlayer(game, P1).probes.filter(p => p.id === 'm2');

    const res = AIController.processInteractionQueue(game, [interaction], 'seq', getPlayer(game, P1));

    expect(moon(res.updatedGame, 'europa').landers).toHaveLength(0);
    expect(res.historyEntries[0].message).toMatch(/^retire un atterrisseur de Europe et gagne /);
  });
});
