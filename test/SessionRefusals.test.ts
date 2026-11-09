import { GameSession } from '../src/session/GameSession';
import { Command } from '../src/session/commands';
import { InteractionResolver } from '../src/engine/InteractionResolver';
import { FreeActionType, Game, GAME_CONSTANTS, GamePhase, InteractionState, Probe, ProbeState, SectorType } from '../src/core/types';
import { createTestGame, getPlayer, makeCard } from './helpers/gameFixture';

const P1 = 'player_0';
const P2 = 'player_1';

const probeAt = (id: string, disk: 'A' | 'B' | 'C' | 'D' | 'E', sector: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8, level: number): Probe => ({
  id, ownerId: P1, position: { x: 0, y: 0 }, solarPosition: { disk, sector, level }, state: ProbeState.IN_SOLAR_SYSTEM, isOrbiter: false, isLander: false,
});

/** Partie en cours, P1 humain et actif, P2 robot ; la session est démarrée */
async function sessionGame(): Promise<Game> {
  const game = await createTestGame();
  game.phase = GamePhase.PLAYING;
  game.currentPlayerIndex = 0;
  game.players[1].type = 'robot';
  return GameSession.start(game).game;
}

describe('GameSession : refus des règles et suites des choix', () => {
  let game: Game;
  let logSpy: jest.SpyInstance;

  beforeEach(async () => {
    logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    game = await sessionGame();
  });
  afterEach(() => logSpy.mockRestore());

  const dispatch = (g: Game, command: Command, playerId = P1) => GameSession.dispatch(g, playerId, command);
  const withInteraction = (interaction: InteractionState, pending: InteractionState[] = []) => ({ ...game, interaction, pendingInteractions: pending });

  test('actions principales refusées par leur règle : le joueur lit la raison donnée par la règle', () => {
    Object.assign(getPlayer(game, P1), { credits: 0, energy: 0, mediaCoverage: 0 });
    const refusals: [Command, RegExp][] = [
      [{ type: 'LAUNCH_PROBE' }, /crédit/i],
      [{ type: 'SCAN' }, /crédit|énergie/i],
      [{ type: 'ANALYZE' }, /./],
      [{ type: 'RESEARCH_TECH' }, /Couverture médiatique insuffisante/],
      [{ type: 'PLAY_CARD', cardId: 'absente' }, /Carte non trouvée/],
    ];
    for (const [command, reason] of refusals) {
      const res = dispatch(game, command);
      expect(res.error).toMatch(reason);
      expect(res.game).toBe(game);
    }

    const probe = probeAt('p1', 'B', 1, 2);
    getPlayer(game, P1).probes = [probe];
    game.board.solarSystem.probes = [probe];
    expect(dispatch(game, { type: 'ORBIT', planetId: 'mars' }).error).toMatch(/crédit|énergie/i);
    expect(dispatch(game, { type: 'LAND', planetId: 'mars' }).error).toMatch(/crédit|énergie/i);
  });

  test("défausse pour l'action gratuite : refusée sans action gratuite ou quand le gain serait perdu", () => {
    getPlayer(game, P1).cards.push(makeCard('sans-action', { freeAction: FreeActionType.UNDEFINED }), makeCard('media', { freeAction: FreeActionType.MEDIA }));
    expect(dispatch(game, { type: 'DISCARD_FOR_FREE_ACTION', cardId: 'sans-action' }).error).toBe("Cette carte n'a pas d'action gratuite");
    getPlayer(game, P1).mediaCoverage = GAME_CONSTANTS.MAX_MEDIA_COVERAGE;
    expect(dispatch(game, { type: 'DISCARD_FOR_FREE_ACTION', cardId: 'media' }).error).toBe('Média au maximum');
  });

  test('mission déclenchée : un autre genre de choix est refusé', () => {
    const g = withInteraction({ type: 'CHOOSING_MISSION_REQUIREMENT', options: [] });
    expect(dispatch(g, { type: 'CHOOSE', choice: { kind: 'CARD' } }).error).toBe("Choix sans rapport avec l'action en cours");
  });

  test('un choix qui laisse une suite la remet en tête de file (réservation de 2 cartes, une à la fois)', () => {
    const hand = getPlayer(game, P1).cards.slice(0, 2).map(c => c.id);
    const g = withInteraction({ type: 'RESERVING_CARD', count: 2, selectedCards: [] }, [{ type: 'ACQUIRING_CARD', count: 1, isFree: true }]);
    const res = dispatch(g, { type: 'CHOOSE', choice: { kind: 'CARDS', cardIds: [hand[0]] } });
    expect(res.error).toBeUndefined();
    expect(res.game.interaction).toEqual(expect.objectContaining({ type: 'RESERVING_CARD', count: 1 }));
    expect(res.game.pendingInteractions?.[0]?.type).toBe('ACQUIRING_CARD');
  });

  test('scan : le secteur choisi reçoit le signal du joueur', () => {
    const sector = game.board.sectors.find(s => s.color === SectorType.RED)!;
    const g = withInteraction({ type: 'SELECTING_SCAN_SECTOR', color: SectorType.RED, sequenceId: 'scan-1' });
    const res = dispatch(g, { type: 'CHOOSE', choice: { kind: 'SECTOR', sectorId: sector.id } });
    expect(res.error).toBeUndefined();
    const after = res.game.board.sectors.find(s => s.id === sector.id)!;
    expect(after.signals.filter(s => s.markedBy === P1).length).toBe(sector.signals.filter(s => s.markedBy === P1).length + 1);
    expect(res.entries.every(e => e.sequenceId === 'scan-1')).toBe(true);
  });

  test("une mission déjà proposée à un joueur ne lui est pas proposée une deuxième fois", () => {
    const offer: InteractionState = { type: 'CHOOSING_MISSION_REQUIREMENT', playerId: P2, options: [{ missionId: 'm', requirementId: 'r' }] };
    getPlayer(game, P2).type = 'human';
    const g = withInteraction({ type: 'ACQUIRING_CARD', count: 1 }, [offer]);
    const res = dispatch(g, { type: 'SKIP' });
    expect(res.error).toBeUndefined();
    expect([res.game.interaction, ...(res.game.pendingInteractions ?? [])].filter(i => i?.type === 'CHOOSING_MISSION_REQUIREMENT')).toHaveLength(1);
  });

  test('interactions automatiques qui ne finissent jamais : la commande est refusée, la partie ne change pas', () => {
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    const loop: InteractionState = { type: 'DRAW_AND_SCAN' } as InteractionState;
    const resolve = jest.spyOn(InteractionResolver, 'resolve').mockImplementation(g => ({ updatedGame: g, historyEntries: [], newInteractions: [loop] }));
    try {
      const res = dispatch(withInteraction({ type: 'ACQUIRING_CARD', count: 1 }, [loop]), { type: 'SKIP' });
      expect(res.error).toBe('Interactions en boucle');
    } finally {
      resolve.mockRestore();
      errorSpy.mockRestore();
    }
  });
});
