import { GameSession } from '../src/session/GameSession';
import { ResourceSystem } from '../src/systems/ResourceSystem';
import { ScanSystem } from '../src/systems/ScanSystem';
import { Game, ProbeState, SectorType } from '../src/core/types';
import { createTestGame, getPlayer, giveCard } from './helpers/gameFixture';

const P1 = 'player_0';
/** Télescope Spatial Huble : 1 Déplacement, puis 1 Signal dans un secteur où se trouve l'une de vos sondes */
const HUBBLE = '27';

/** Partie où P1 a lancé une sonde (tour encore à jouer), changée en capsule de spécimen si demandé */
function withPiece(game: Game, state: ProbeState | null): Game {
  let g = game;
  if (state) {
    g = GameSession.dispatch(g, P1, { type: 'LAUNCH_PROBE' }).game;
    const probeId = getPlayer(g, P1).probes[0].id;
    for (const probe of [...getPlayer(g, P1).probes, ...g.board.solarSystem.probes].filter(p => p.id === probeId)) probe.state = state;
    getPlayer(g, P1).hasPerformedMainAction = false;
  }
  getPlayer(g, P1).credits = 10;
  giveCard(g, P1, HUBBLE);
  return g;
}

describe('signal « secteur d\'une de vos sondes » : capsules comprises, perdu sans pièce', () => {
  let game: Game;
  beforeEach(async () => {
    game = await createTestGame();
    game.currentPlayerIndex = 0;
  });

  test('capsule seule : pas d\'avertissement, le secteur de la capsule est proposé et accepté', () => {
    const g = withPiece(game, ProbeState.CAPSULE);
    expect(ScanSystem.canPlaceProbeSignal(g, P1)).toBe(true);
    expect(ResourceSystem.lostBonusWarning(g, P1, { movements: 1, signals: [{ amount: 1, scope: SectorType.PROBE }] })).toBeNull();
    const played = GameSession.dispatch(g, P1, { type: 'PLAY_CARD', cardId: HUBBLE });
    expect(played.error).toBeUndefined();
    // Déplacement gratuit (facultatif) puis choix du secteur
    let current = played.game;
    if (current.interaction?.type === 'MOVING_PROBE' || current.interaction?.type === 'CHOOSING_BONUS_ACTION') current = GameSession.dispatch(current, P1, { type: 'SKIP' }).game;
    const interaction = current.interaction ?? current.pendingInteractions?.[0];
    expect(interaction).toMatchObject({ type: 'SELECTING_SCAN_SECTOR', onlyProbes: true });
    const valid = current.board.sectors.filter(s => ScanSystem.validateScanSectorSelection(current, P1, interaction as never, s.id).valid);
    expect(valid).toHaveLength(1);
  });

  test('ni sonde ni capsule : avertissement, puis le signal est perdu et l\'historique le dit', () => {
    const g = withPiece(game, null);
    expect(ScanSystem.canPlaceProbeSignal(g, P1)).toBe(false);
    expect(ResourceSystem.lostBonusWarning(g, P1, { movements: 1, signals: [{ amount: 1, scope: SectorType.PROBE }] }))
      .toBe("Vous n'avez aucune sonde ni capsule dans le système solaire : le déplacement et le signal seront perdus. Voulez-vous continuer ?");
    expect(ResourceSystem.lostBonusWarning(g, P1, { signals: [{ amount: 1, scope: SectorType.PROBE }] })).toContain('le signal sera perdu');
    expect(ResourceSystem.lostBonusWarning(g, P1, { movements: 1 })).toContain('le déplacement sera perdu');
    const played = GameSession.dispatch(g, P1, { type: 'PLAY_CARD', cardId: HUBBLE });
    expect(played.error).toBeUndefined();
    expect(played.game.interaction?.type ?? 'IDLE').not.toBe('SELECTING_SCAN_SECTOR');
    expect(played.game.pendingInteractions ?? []).not.toContainEqual(expect.objectContaining({ type: 'SELECTING_SCAN_SECTOR' }));
    expect(played.entries.map(e => e.message).join('\n')).toContain('perd 1 signal (aucune sonde ni capsule dans le système solaire)');
  });

  test('sonde ordinaire : toujours acceptée', () => {
    const g = withPiece(game, ProbeState.IN_SOLAR_SYSTEM);
    expect(ScanSystem.canPlaceProbeSignal(g, P1)).toBe(true);
    expect(ScanSystem.canPlaceProbeSignal(g, P1, true)).toBe(true);
  });
});
