import { GameSession } from '../src/session/GameSession';
import { TechnologySystem } from '../src/systems/TechnologySystem';
import { TechnologyCategory } from '../src/core/types';
import { createTestGame, getPlayer } from './helpers/gameFixture';

const P1 = 'player_0';

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
