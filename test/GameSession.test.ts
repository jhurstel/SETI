import { GameSession } from '../src/session/GameSession';
import { InteractionQueue } from '../src/session/InteractionQueue';
import { Command } from '../src/session/commands';
import { GameFactory } from '../src/core/GameFactory';
import { AITurn } from '../src/ai/AITurn';
import { TechnologySystem } from '../src/systems/TechnologySystem';
import { CardSystem } from '../src/systems/CardSystem';
import { Game, GamePhase, InteractionState, Probe, ProbeState, TechnologyCategory } from '../src/core/types';
import { createTestGame, getPlayer, mockFetchFromPublic, TEST_SEED } from './helpers/gameFixture';

const P1 = 'player_0';
const P2 = 'player_1';

const probeAt = (id: string, disk: 'A' | 'B' | 'C' | 'D' | 'E', sector: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8, level: number): Probe => ({
  id, ownerId: P1, position: { x: 0, y: 0 }, solarPosition: { disk, sector, level }, state: ProbeState.IN_SOLAR_SYSTEM, isOrbiter: false, isLander: false,
});

/** Partie en cours, P1 humain et actif, P2 robot ; la session est démarrée */
async function sessionGame(): Promise<Game> {
  const game = await createTestGame();
  game.currentPlayerIndex = 0;
  game.players[1].type = 'robot';
  return GameSession.start(game).game;
}

describe('GameSession', () => {
  let game: Game;

  beforeEach(async () => {
    game = await sessionGame();
  });

  /** Commande qui doit réussir, sans modifier la partie reçue */
  const run = (g: Game, command: Command, playerId = P1) => {
    const before = JSON.stringify(g);
    const res = GameSession.dispatch(g, playerId, command);
    expect(res.error).toBeUndefined();
    expect(JSON.stringify(g)).toBe(before);
    return res;
  };
  const refused = (g: Game, command: Command, playerId = P1) => {
    const res = GameSession.dispatch(g, playerId, command);
    expect(res.error).toBeDefined();
    expect(res.game).toBe(g);
    return res.error!;
  };

  describe('Mise en place', () => {
    test('le joueur humain réserve une carte, puis le robot', async () => {
      const fetchSpy = mockFetchFromPublic();
      let setup = await GameFactory.createGame(['Humain', 'Robot'], true, TEST_SEED);
      fetchSpy.mockRestore();
      setup.players[1].type = 'robot';
      setup = GameSession.start(GameFactory.initializeGame(setup)).game;

      expect(setup.interaction).toEqual({ type: 'RESERVING_CARD', count: 1, selectedCards: [] });
      const card = getPlayer(setup, P1).cards[0];
      const res = run(setup, { type: 'CHOOSE', choice: { kind: 'CARDS', cardIds: [card.id] } });

      expect(getPlayer(res.game, P1).reservedCards.map(c => c.id)).toEqual([card.id]);
      expect(res.game.currentPlayerIndex).toBe(1);
      expect(res.game.interaction).toBeUndefined();
      expect(GameSession.robotCanPlay(res.game)).toBe(true);
    });
  });

  describe('Qui peut jouer', () => {
    test('pas son tour, partie terminée', () => {
      expect(refused(game, { type: 'LAUNCH_PROBE' }, P2)).toBe("Ce n'est pas votre tour");
      expect(refused({ ...game, phase: GamePhase.FINAL_SCORING }, { type: 'LAUNCH_PROBE' })).toBe('La partie est terminée');
      expect(refused(game, { type: 'CHOOSE', choice: { kind: 'ACCEPT', accepted: true } })).toBe('Aucune interaction en cours');
    });

    test('une interaction en cours : seul son joueur répond, et seulement à elle', () => {
      const pending = InteractionQueue.set(game, { type: 'CHOOSING_OBS2_ACTION', sequenceId: 's' });
      expect(refused(pending, { type: 'LAUNCH_PROBE' })).toBe("Terminez d'abord l'action en cours");
      expect(refused(pending, { type: 'CHOOSE', choice: { kind: 'ACCEPT', accepted: false } }, P2)).toBe("Ce n'est pas à vous de jouer");
      expect(refused(pending, { type: 'CHOOSE', choice: { kind: 'OBS4', choice: 'MOVE' } })).toBe("Choix sans rapport avec l'action en cours");
      expect(refused(pending, { type: 'SKIP' })).toBe('Cette action ne peut pas être abandonnée');

      const answered = run(pending, { type: 'CHOOSE', choice: { kind: 'ACCEPT', accepted: false } });
      expect(answered.game.interaction).toBeUndefined();
    });

    test('interaction destinée à un autre joueur humain : à lui de répondre', () => {
      game.players[1].type = 'human';
      const pending = InteractionQueue.set(game, { type: 'CHOOSING_OBS2_ACTION', playerId: P2 });
      expect(refused(pending, { type: 'CHOOSE', choice: { kind: 'ACCEPT', accepted: false } })).toBe("Ce n'est pas à vous de jouer");
      expect(run(pending, { type: 'CHOOSE', choice: { kind: 'ACCEPT', accepted: false } }, P2).game.interaction).toBeUndefined();
    });
  });

  describe('Actions principales', () => {
    test('lancer une sonde, puis plus d\'autre action principale', () => {
      getPlayer(game, P1).credits = 10;
      const res = run(game, { type: 'LAUNCH_PROBE' });
      expect(getPlayer(res.game, P1).probes).toHaveLength(1);
      expect(res.entries[0].message).toContain('Lancer une sonde');
      expect(refused(res.game, { type: 'LAUNCH_PROBE' })).toContain('action principale');
    });

    test('recherche : technologie Exploration acquise ; Informatique : colonne d\'ordinateur à choisir', () => {
      getPlayer(game, P1).mediaCoverage = 10;
      const exploration = TechnologySystem.acquirableTechs(game, P1, { categories: [TechnologyCategory.EXPLORATION] })[0];
      const res = run(game, { type: 'RESEARCH_TECH', techId: exploration.id });
      expect(getPlayer(res.game, P1).technologies.map(t => t.id)).toEqual([exploration.id]);
      expect(res.game.interaction).toBeUndefined();

      const computing = TechnologySystem.acquirableTechs(game, P1, { categories: [TechnologyCategory.COMPUTING] })[0];
      const step = run(game, { type: 'RESEARCH_TECH', techId: computing.id });
      expect(step.game.interaction).toEqual(expect.objectContaining({ type: 'SELECTING_COMPUTER_SLOT' }));
      const done = run(step.game, { type: 'CHOOSE', choice: { kind: 'COMPUTER_COLUMN', column: 1 } });
      expect(getPlayer(done.game, P1).technologies.map(t => t.id)).toEqual([computing.id]);
    });

    test('recherche sans technologie : le choix reste en cours', () => {
      getPlayer(game, P1).mediaCoverage = 10;
      const res = run(game, { type: 'RESEARCH_TECH' });
      expect(res.game.interaction?.type).toBe('ACQUIRING_TECH');
      expect(refused(res.game, { type: 'CHOOSE', choice: { kind: 'TECH', techId: 'inconnue' } })).toContain('ne peut pas être prise');
    });
  });

  describe('Actions gratuites', () => {
    test('achat de carte : rangée ouverte, abandon possible, ou carte prise', () => {
      getPlayer(game, P1).mediaCoverage = 5;
      const buying = run(game, { type: 'BUY_CARD' });
      expect(buying.game.interaction).toEqual(expect.objectContaining({ type: 'ACQUIRING_CARD', count: 1 }));
      expect(run(buying.game, { type: 'SKIP' }).game.interaction).toBeUndefined();

      const card = game.decks.cardRow[0];
      const bought = run(buying.game, { type: 'CHOOSE', choice: { kind: 'CARD', cardId: card.id } });
      expect(getPlayer(bought.game, P1).cards.map(c => c.id)).toContain(card.id);
      expect(getPlayer(bought.game, P1).mediaCoverage).toBe(2);
      expect(bought.game.decks.cardRow).toHaveLength(3);

      getPlayer(game, P1).mediaCoverage = 2;
      expect(refused(game, { type: 'BUY_CARD' })).toBe('Couverture médiatique insuffisante');
    });

    test('refus : carte hors de la main, transfert sans donnée', () => {
      expect(refused(game, { type: 'DISCARD_FOR_FREE_ACTION', cardId: 'inconnue' })).toBe('Carte absente de votre main');
      getPlayer(game, P1).data = 0;
      expect(refused(game, { type: 'TRANSFER_DATA', slotId: '1a' })).toBe('Transfert de donnée impossible sur cette case');
    });

    test('échange de 2 crédits contre une carte : la rangée s\'ouvre', () => {
      getPlayer(game, P1).credits = 4;
      const res = run(game, { type: 'TRADE', spend: 'credit', gain: 'card' });
      expect(getPlayer(res.game, P1).credits).toBe(2);
      expect(res.game.interaction).toEqual(expect.objectContaining({ type: 'ACQUIRING_CARD', isFree: true }));
    });

    test('déplacements gratuits : consommés pas à pas, puis l\'interaction se termine', () => {
      const player = getPlayer(game, P1);
      player.probes = [probeAt('p1', 'A', 1, 0)];
      game.board.solarSystem.probes = [...player.probes];
      player.energy = 0;
      const moving = InteractionQueue.set(game, { type: 'MOVING_PROBE', count: 2, sequenceId: 's' });

      const first = run(moving, { type: 'MOVE_PROBE', probeId: 'p1', disk: 'A', sector: 2 });
      expect(first.game.interaction).toEqual(expect.objectContaining({ type: 'MOVING_PROBE', count: 1 }));
      const second = run(first.game, { type: 'MOVE_PROBE', probeId: 'p1', disk: 'A', sector: 3 });
      expect(second.game.interaction).toBeUndefined();
      expect(refused(second.game, { type: 'MOVE_PROBE', probeId: 'p1', disk: 'A', sector: 4 })).toBeDefined();
    });
  });

  test('plusieurs gains à choix : menu, l\'action choisie d\'abord, puis le menu revient', () => {
    const gains: InteractionState[] = [{ type: 'CHOOSING_OBS2_ACTION' }, { type: 'CHOOSING_OBS3_ACTION' }];
    const menu = InteractionQueue.enqueue(game, gains, 's');
    expect(menu.interaction?.type).toBe('CHOOSING_BONUS_ACTION');

    const chosen = run(menu, { type: 'CHOOSE', choice: { kind: 'MENU', index: 1 } });
    expect(chosen.game.interaction?.type).toBe('CHOOSING_OBS3_ACTION');
    const after = run(chosen.game, { type: 'CHOOSE', choice: { kind: 'ACCEPT', accepted: false } });
    expect(after.game.interaction?.type).toBe('CHOOSING_BONUS_ACTION');
    expect(run(after.game, { type: 'SKIP' }).game.interaction).toBeUndefined();
  });

  describe('Fin de tour', () => {
    test('refusée tant qu\'une interaction est en cours, puis au joueur suivant', () => {
      const pending = InteractionQueue.set(game, { type: 'CHOOSING_OBS2_ACTION' });
      expect(GameSession.canEndTurn(pending)).toBe(false);
      expect(refused(pending, { type: 'END_TURN' })).toBe("Terminez d'abord l'action en cours");

      expect(GameSession.canEndTurn(game)).toBe(true);
      const res = run(game, { type: 'END_TURN' });
      expect(res.game.currentPlayerIndex).toBe(1);
      expect(res.game.endingTurn).toBe(false);
      expect(res.entries.map(e => e.message)).toContain(`--- Tour de ${game.players[1].name} ---`);
    });

    test('palier de score atteint : marqueur d\'objectif à placer, puis le tour se termine', () => {
      getPlayer(game, P1).score = 30;
      const milestone = run(game, { type: 'END_TURN' });
      expect(milestone.game.interaction?.type).toBe('PLACING_OBJECTIVE_MARKER');
      expect(milestone.game.currentPlayerIndex).toBe(0);

      const tile = game.board.objectiveTiles[0];
      const done = run(milestone.game, { type: 'CHOOSE', choice: { kind: 'OBJECTIVE', tileId: tile.id } });
      expect(done.game.board.objectiveTiles[0].markers).toContain(P1);
      expect(done.game.currentPlayerIndex).toBe(1);
      expect(done.game.endingTurn).toBe(false);
    });

    test('passer : la main garde 4 cartes au plus, et le joueur suivant joue', () => {
      const hand = CardSystem.getHandCards(getPlayer(game, P1));
      const keep = hand.slice(0, Math.min(4, hand.length)).map(c => c.id);
      const passed = run(game, { type: 'PASS', cardsToKeep: keep });
      expect(getPlayer(passed.game, P1).hasPassed).toBe(true);
      expect(passed.game.currentPlayerIndex).toBe(0);
      const res = run(passed.game, { type: 'CHOOSE', choice: { kind: 'CARD', cardId: game.decks.roundDecks[1][0].id } });
      expect(res.game.currentPlayerIndex).toBe(1);
    });

    test('carte de fin de manche : choisie par le joueur qui a passé, pas avant ; le joueur suivant attend', () => {
      const keep = CardSystem.getHandCards(getPlayer(game, P1)).slice(0, 4).map(c => c.id);
      const deck = game.decks.roundDecks[1];
      const passed = run(game, { type: 'PASS', cardsToKeep: keep });
      expect(passed.game.interaction).toEqual(expect.objectContaining({ type: 'CHOOSING_ROUND_CARD', round: 1, playerId: P1 }));
      expect(getPlayer(passed.game, P1).cards.some(c => deck.some(r => r.id === c.id))).toBe(false);

      // Le joueur suivant ne peut pas répondre, ni le joueur passer outre, ni prendre une carte d'ailleurs
      expect(GameSession.dispatch(passed.game, P2, { type: 'CHOOSE', choice: { kind: 'CARD', cardId: deck[0].id } }).error).toBeDefined();
      expect(GameSession.dispatch(passed.game, P1, { type: 'SKIP' }).error).toBeDefined();
      expect(GameSession.dispatch(passed.game, P1, { type: 'CHOOSE', choice: { kind: 'CARD', cardId: 'inconnue' } }).error).toBe('Carte absente de la pile de fin de manche');
      expect(GameSession.dispatch(passed.game, P1, { type: 'CHOOSE', choice: { kind: 'CARD' } }).error).toBeDefined();

      const chosen = run(passed.game, { type: 'CHOOSE', choice: { kind: 'CARD', cardId: deck[2].id } });
      expect(getPlayer(chosen.game, P1).cards.map(c => c.id)).toEqual([...keep, deck[2].id]);
      expect(chosen.game.decks.roundDecks[1].map(c => c.id)).toEqual(deck.filter((_, i) => i !== 2).map(c => c.id));
      expect(chosen.game.interaction).toBeUndefined();
    });
  });

  test('même partie, même commande : même résultat (générateur de la partie)', () => {
    getPlayer(game, P1).credits = 10;
    const a = GameSession.dispatch(game, P1, { type: 'LAUNCH_PROBE' });
    const b = GameSession.dispatch(game, P1, { type: 'LAUNCH_PROBE' });
    expect(b.game.rngState).toBe(a.game.rngState);
    const positions = (g: Game) => getPlayer(g, P1).probes.map(p => p.solarPosition);
    expect(positions(b.game)).toEqual(positions(a.game));
  });

  test('partie complète entre robots par la session (étapes appliquées par applyRobotStep)', async () => {
    const logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    const fetchSpy = mockFetchFromPublic();
    let robots = await GameFactory.createGame(['R1', 'R2'], true, TEST_SEED);
    fetchSpy.mockRestore();
    robots.players.forEach(p => { p.type = 'robot'; p.aiDifficulty = 'EASY'; });
    robots = GameSession.start(GameFactory.initializeGame(robots)).game;

    for (let steps = 0; steps < 5000 && robots.phase !== GamePhase.FINAL_SCORING; steps++) {
      expect(GameSession.robotCanPlay(robots)).toBe(true);
      const step = AITurn.playStep(robots);
      const res = step.kind === 'END_TURN'
        ? GameSession.applyRobotStep(robots, { kind: 'END_TURN_DONE', end: AITurn.endTurn(robots) })
        : GameSession.applyRobotStep(robots, step);
      expect(res.error).toBeUndefined();
      robots = res.game;
    }
    logSpy.mockRestore();
    expect(robots.phase).toBe(GamePhase.FINAL_SCORING);
    expect(robots.finalScores).toHaveLength(2);
  }, 120000);
});
