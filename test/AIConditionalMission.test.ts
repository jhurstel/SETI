import { AITurn } from '../src/ai/AITurn';
import { AIEvaluator } from '../src/ai/AIEvaluator';
import { CardSystem } from '../src/systems/CardSystem';
import { Game } from '../src/core/types';
import { createTestGame, getPlayer } from './helpers/gameFixture';

const P1 = 'player_0';
/** Découverte d'Exofossiles : mission conditionnelle, 11 PV contre 2 Tokens quand on en a 3 */
const ET23 = 'ET.23';

/** Robot Expert qui a joué ET.23 avec sa condition remplie (mission à réclamer), action principale faite */
async function robotWithClaimableMission(): Promise<Game> {
  const game = await createTestGame(['A', 'B']);
  game.players.forEach(p => { p.type = 'robot'; p.aiDifficulty = 'EXPERT'; });
  game.currentPlayerIndex = 0;
  Object.assign(getPlayer(game, P1), { credits: 10, tokens: 3, data: 0 });
  // Carte de la pioche d'Oumuamua (les cinq espèces existent toujours dans la partie)
  const species = game.species.find(sp => sp.cards.some(c => c.id === ET23))!;
  getPlayer(game, P1).cards.push(species.cards.find(c => c.id === ET23)!);
  const played = CardSystem.playCard(game, P1, ET23).updatedGame;
  getPlayer(played, P1).hasPerformedMainAction = true;
  return played;
}

const mission = (game: Game) => getPlayer(game, P1).missions.find(m => m.cardId === ET23)!;

describe('robot et mission conditionnelle remplie : il choisit le moment, comme le joueur', () => {
  afterEach(() => jest.restoreAllMocks());

  test('la réclamer améliore sa position : il la réclame en action gratuite', async () => {
    const game = await robotWithClaimableMission();
    expect(mission(game).completed).toBe(false);
    const step = AITurn.playStep(game);
    expect(step.kind).toBe('UPDATED');
    if (step.kind === 'UPDATED') expect(mission(step.updatedGame).completed).toBe(true);
  });

  test('la réclamer maintenant lui ferait perdre : il attend', async () => {
    const game = await robotWithClaimableMission();
    const evaluate = AIEvaluator.evaluate.bind(AIEvaluator);
    jest.spyOn(AIEvaluator, 'evaluate').mockImplementation((g, playerId) => evaluate(g, playerId) - (mission(g).completed ? 1000 : 0));
    const step = AITurn.playStep(game);
    if (step.kind === 'UPDATED') expect(mission(step.updatedGame).completed).toBe(false);
    else expect(step.kind).toBe('END_TURN');
  });
});
