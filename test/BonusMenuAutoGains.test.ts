import { ResourceSystem } from '../src/systems/ResourceSystem';
import { InteractionQueue } from '../src/session/InteractionQueue';
import { GameSession } from '../src/session/GameSession';
import { cloneGame } from '../src/core/cloneGame';
import { Game, InteractionState, SectorType, TechnologyCategory } from '../src/core/types';
import { createTestGame, getPlayer } from './helpers/gameFixture';

const P1 = 'player_0';

describe('Menu des récompenses : gains appliqués d\'office', () => {
  let game: Game;

  beforeEach(async () => {
    game = await createTestGame();
    game.currentPlayerIndex = 0;
  });

  test('processBonuses : les choix créés portent les gains déjà appliqués (ressources, signal à secteur imposé)', () => {
    // processBonuses travaille sur la copie que lui passe l'opération appelante
    const res = ResourceSystem.processBonuses({
      pv: 2, media: 1,
      signals: [{ amount: 1, scope: SectorType.MARS }, { amount: 1, scope: SectorType.YELLOW }],
      technologies: [{ amount: 1, scope: TechnologyCategory.ANY }],
    }, cloneGame(game), P1, 'carte', 'seq');

    expect(res.newPendingInteractions.length).toBeGreaterThan(1);
    // Le signal jaune est à choisir : seul celui de Mars est automatique
    res.newPendingInteractions.forEach(i => expect(i.autoGains).toEqual({ pv: 2, media: 1, signals: [{ amount: 1, scope: SectorType.MARS }] }));
  });

  test('processBonuses : rien d\'automatique, ou un seul choix (pas de menu) : aucun gain attaché', () => {
    const onlyChoices = ResourceSystem.processBonuses({ technologies: [{ amount: 2, scope: TechnologyCategory.ANY }] }, cloneGame(game), P1, 'carte', 'seq');
    onlyChoices.newPendingInteractions.forEach(i => expect(i.autoGains).toBeUndefined());
    const single = ResourceSystem.processBonuses({ pv: 1, technologies: [{ amount: 1, scope: TechnologyCategory.ANY }] }, cloneGame(game), P1, 'carte', 'seq');
    expect(single.newPendingInteractions).toHaveLength(1);
    expect(single.newPendingInteractions[0].autoGains).toBeUndefined();
    expect(ResourceSystem.automaticGains({ anycard: 1 }, [])).toBeUndefined();
  });

  test('enqueue : le menu reprend les gains automatiques, une fois par bonus d\'origine', () => {
    const autoA = { pv: 2 };
    const autoB = { media: 1, pv: 1 };
    const gains: InteractionState[] = [
      { type: 'CHOOSING_OBS2_ACTION', autoGains: autoA },
      { type: 'CHOOSING_OBS3_ACTION', autoGains: autoA },
      { type: 'ACQUIRING_TECH', isBonus: true, autoGains: autoB },
    ];
    const menu = InteractionQueue.enqueue(game, gains, 's');
    expect(menu.interaction).toEqual(expect.objectContaining({ type: 'CHOOSING_BONUS_ACTION', autoGains: { pv: 3, media: 1 } }));
    expect(autoA).toEqual({ pv: 2 });

    // Sans gain automatique : pas de champ
    const plain = InteractionQueue.enqueue(game, [{ type: 'CHOOSING_OBS2_ACTION' }, { type: 'CHOOSING_OBS3_ACTION' }], 's');
    expect(plain.interaction && 'autoGains' in plain.interaction).toBe(false);
  });

  test('« Ne rien faire d\'autre » : renoncer au menu abandonne les récompenses restantes', () => {
    const menu = InteractionQueue.enqueue(game, [{ type: 'CHOOSING_OBS2_ACTION', autoGains: { pv: 1 } }, { type: 'CHOOSING_OBS3_ACTION' }], 's');
    const skipped = GameSession.dispatch(menu, P1, { type: 'SKIP' });
    expect(skipped.error).toBeUndefined();
    expect(skipped.game.interaction).toBeUndefined();
    expect(getPlayer(skipped.game, P1).score).toBe(getPlayer(game, P1).score);
  });
});
