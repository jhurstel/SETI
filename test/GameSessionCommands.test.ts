import { GameSession } from '../src/session/GameSession';
import { Command, Choice } from '../src/session/commands';
import { CardSystem } from '../src/systems/CardSystem';
import { ComputerSystem } from '../src/systems/ComputerSystem';
import { TechnologySystem } from '../src/systems/TechnologySystem';
import { FreeActionType, Game, GamePhase, InteractionState, LifeTraceLocation, LifeTraceType, Probe, ProbeState, TechnologyCategory } from '../src/core/types';
import { createTestGame, getPlayer, makeCard } from './helpers/gameFixture';

const P1 = 'player_0';
const P2 = 'player_1';
const WRONG = "Choix sans rapport avec l'action en cours";

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

describe('GameSession : commandes et aiguillage des choix', () => {
  let game: Game;
  let logSpy: jest.SpyInstance;

  beforeEach(async () => {
    logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    game = await sessionGame();
  });
  afterEach(() => logSpy.mockRestore());

  const dispatch = (g: Game, command: Command, playerId = P1) => GameSession.dispatch(g, playerId, command);
  const withInteraction = (interaction: InteractionState) => ({ ...game, interaction, pendingInteractions: [] });

  describe('refus généraux', () => {
    test('partie pas commencée, joueur qui a passé, choix ou abandon sans interaction', () => {
      expect(dispatch({ ...game, phase: GamePhase.SETUP }, { type: 'LAUNCH_PROBE' }).error).toBe("La partie n'a pas commencé");
      getPlayer(game, P1).hasPassed = true;
      expect(dispatch(game, { type: 'LAUNCH_PROBE' }).error).toBe('Vous avez déjà passé ce tour');
      getPlayer(game, P1).hasPassed = false;
      expect(dispatch(game, { type: 'CHOOSE', choice: { kind: 'MENU', index: 0 } }).error).toBe('Aucune interaction en cours');
      expect(dispatch(game, { type: 'SKIP' }).error).toBe('Aucune interaction en cours');
    });

    test('pendant une interaction : seul son joueur répond, et seulement à elle', () => {
      const g = withInteraction({ type: 'PLACING_LIFE_TRACE', color: LifeTraceType.RED });
      expect(dispatch(g, { type: 'LAUNCH_PROBE' }).error).toBe("Terminez d'abord l'action en cours");
      expect(dispatch(g, { type: 'LAUNCH_PROBE' }, P2).error).toBe("Ce n'est pas à vous de jouer");
    });

    test('abandon : possible pour un achat de carte payé, pas pour une carte gratuite ni une trace de vie', () => {
      expect(dispatch(withInteraction({ type: 'ACQUIRING_CARD', count: 1 }), { type: 'SKIP' }).error).toBeUndefined();
      expect(dispatch(withInteraction({ type: 'ACQUIRING_CARD', count: 1, isFree: true }), { type: 'SKIP' }).error).toBe('Cette action ne peut pas être abandonnée');
      expect(dispatch(withInteraction({ type: 'PLACING_LIFE_TRACE', color: LifeTraceType.RED }), { type: 'SKIP' }).error).toBe('Cette action ne peut pas être abandonnée');
    });
  });

  describe('commandes', () => {
    test('orbite et atterrissage : refusés sans sonde sur la planète, possibles avec', () => {
      expect(dispatch(game, { type: 'ORBIT', planetId: 'mars' }).error).toBe('Aucune de vos sondes sur cette planète');
      expect(dispatch(game, { type: 'LAND', planetId: 'mars' }).error).toBe('Aucune de vos sondes sur cette planète');

      const probe = probeAt('p1', 'B', 1, 2);
      getPlayer(game, P1).probes = [probe];
      game.board.solarSystem.probes = [probe];
      Object.assign(getPlayer(game, P1), { credits: 10, energy: 10 });
      const orbit = dispatch(game, { type: 'ORBIT', planetId: 'mars' });
      expect(orbit.error).toBeUndefined();
      expect(orbit.game.board.planets.find(p => p.id === 'mars')!.orbiters).toHaveLength(1);
      const land = dispatch(game, { type: 'LAND', planetId: 'mars' });
      expect(land.error).toBeUndefined();
      expect(land.game.board.planets.find(p => p.id === 'mars')!.landers).toHaveLength(1);
    });

    test('recherche avec la technologie choisie d\'avance : prise aussitôt', () => {
      getPlayer(game, P1).mediaCoverage = 10;
      const techId = TechnologySystem.acquirableTechs(game, P1, { categories: [TechnologyCategory.EXPLORATION] })[0].id;
      const res = dispatch(game, { type: 'RESEARCH_TECH', techId });
      expect(res.error).toBeUndefined();
      expect(getPlayer(res.game, P1).technologies.some(t => t.type === TechnologyCategory.EXPLORATION)).toBe(true);
      expect(res.game.interaction).toBeUndefined();
    });

    test('achat d\'une carte : 3 Médias nécessaires, puis choix de la carte', () => {
      getPlayer(game, P1).mediaCoverage = 2;
      expect(dispatch(game, { type: 'BUY_CARD' }).error).toBe('Couverture médiatique insuffisante');
      getPlayer(game, P1).mediaCoverage = 5;
      expect(dispatch(game, { type: 'BUY_CARD' }).game.interaction).toEqual(expect.objectContaining({ type: 'ACQUIRING_CARD', count: 1 }));
    });

    test('défausse pour l\'action gratuite : carte de la main, effet appliqué', () => {
      expect(dispatch(game, { type: 'DISCARD_FOR_FREE_ACTION', cardId: 'absente' }).error).toBe('Carte absente de votre main');
      getPlayer(game, P1).cards.push(makeCard('media-card', { freeAction: FreeActionType.MEDIA }));
      const media = getPlayer(game, P1).mediaCoverage;
      const res = dispatch(game, { type: 'DISCARD_FOR_FREE_ACTION', cardId: 'media-card' });
      expect(res.error).toBeUndefined();
      expect(getPlayer(res.game, P1).mediaCoverage).toBe(media + 1);
    });

    test('transfert d\'une donnée : refusé sans donnée, possible sinon', () => {
      getPlayer(game, P1).data = 2;
      const slot = Object.keys(getPlayer(game, P1).dataComputer.slots).find(id => ComputerSystem.canFillSlot(getPlayer(game, P1), id))!;
      getPlayer(game, P1).data = 0;
      expect(dispatch(game, { type: 'TRANSFER_DATA', slotId: slot }).error).toBe('Transfert de donnée impossible sur cette case');
      getPlayer(game, P1).data = 2;
      const res = dispatch(game, { type: 'TRANSFER_DATA', slotId: slot });
      expect(res.error).toBeUndefined();
      expect(getPlayer(res.game, P1).data).toBe(1);
    });

    test('réclamer une mission inconnue : rien ne se passe, la partie n\'est pas bloquée', () => {
      const res = dispatch(game, { type: 'CLAIM_MISSION', missionId: 'inconnue', requirementId: 'r' });
      expect(res.error).toBeUndefined();
      expect(res.game.interaction).toBeUndefined();
      expect(getPlayer(res.game, P1).missions).toEqual(getPlayer(game, P1).missions);
    });

    test('échanges : contre une carte (à choisir), entre ressources, et refus faute de ressources', () => {
      Object.assign(getPlayer(game, P1), { credits: 4, energy: 0 });
      expect(dispatch(game, { type: 'TRADE', spend: 'credit', gain: 'card' }).game.interaction?.type).toBe('ACQUIRING_CARD');
      expect(getPlayer(dispatch(game, { type: 'TRADE', spend: 'credit', gain: 'energy' }).game, P1).energy).toBe(1);
      expect(dispatch(game, { type: 'TRADE', spend: 'energy', gain: 'card' }).error).toBeDefined();
      expect(dispatch(game, { type: 'TRADE', spend: 'energy', gain: 'credit' }).error).toBeDefined();
    });
  });

  describe('aiguillage des choix : chaque interaction refuse un choix d\'un autre genre et transmet le sien', () => {
    const anyTech = () => game.board.technologyBoard.categorySlots?.flatMap(s => s.technologies)[0];
    const cases: { interaction: () => InteractionState; wrong: Choice; right: Choice }[] = [
      { interaction: () => ({ type: 'PLACING_LIFE_TRACE', color: LifeTraceType.RED }), wrong: { kind: 'CARD' }, right: { kind: 'LIFE_TRACE', boardIndex: 9, color: LifeTraceType.RED, slotType: LifeTraceLocation.TRIANGLE } },
      { interaction: () => ({ type: 'ACQUIRING_ALIEN_CARD', count: 1, speciesId: 'aucune' }), wrong: { kind: 'CARD' }, right: { kind: 'ALIEN_CARD', cardId: 'deck' } },
      { interaction: () => ({ type: 'PLACING_OBJECTIVE_MARKER', milestone: 25 }), wrong: { kind: 'CARD' }, right: { kind: 'OBJECTIVE', tileId: 'aucune' } },
      { interaction: () => ({ type: 'ACQUIRING_TECH' }), wrong: { kind: 'CARD' }, right: { kind: 'TECH', techId: 'aucune' } },
      { interaction: () => ({ type: 'SELECTING_COMPUTER_SLOT', tech: anyTech()! }), wrong: { kind: 'CARD' }, right: { kind: 'COMPUTER_COLUMN', column: 99 } },
      { interaction: () => ({ type: 'ORBITING_PROBE', count: 1 }), wrong: { kind: 'CARD' }, right: { kind: 'PLANET', planetId: 'aucune' } },
      { interaction: () => ({ type: 'LANDING_PROBE', count: 1 }), wrong: { kind: 'CARD' }, right: { kind: 'PLANET', planetId: 'aucune' } },
      { interaction: () => ({ type: 'REMOVING_ORBITER' }), wrong: { kind: 'CARD' }, right: { kind: 'PLANET', planetId: 'mars' } },
      { interaction: () => ({ type: 'REMOVING_LANDER' }), wrong: { kind: 'CARD' }, right: { kind: 'PLANET', planetId: 'mars' } },
      { interaction: () => ({ type: 'CHOOSING_CENTAURIEN_REWARD' }), wrong: { kind: 'CARD' }, right: { kind: 'CENTAURIEN', tokenIndex: 99 } },
      { interaction: () => ({ type: 'CHOOSING_BONUS_ACTION', bonusesSummary: '', choices: [] }), wrong: { kind: 'CARD' }, right: { kind: 'MENU', index: 3 } },
      { interaction: () => ({ type: 'ACQUIRING_CARD', count: 1 }), wrong: { kind: 'MENU', index: 0 }, right: { kind: 'CARD', cardId: 'aucune' } },
      { interaction: () => ({ type: 'SELECTING_SCAN_CARD' }), wrong: { kind: 'CARD' }, right: { kind: 'CARD', cardId: 'aucune' } },
      { interaction: () => ({ type: 'RESERVING_CARD', count: 1, selectedCards: [] }), wrong: { kind: 'CARD' }, right: { kind: 'CARDS', cardIds: ['aucune'] } },
      { interaction: () => ({ type: 'DISCARDING_DRAWN_CARD', cardIds: ['x'], step: 'FREE_ACTION' }), wrong: { kind: 'CARD' }, right: { kind: 'CARD', cardId: 'aucune' } },
      { interaction: () => ({ type: 'DISCARDING_FOR_SIGNAL', count: 1, selectedCards: [] }), wrong: { kind: 'CARD' }, right: { kind: 'CARDS', cardIds: ['a', 'b'] } },
      { interaction: () => ({ type: 'CHOOSING_MEDIA_OR_MOVE' }), wrong: { kind: 'CARD' }, right: { kind: 'MEDIA_OR_MOVE', choice: 'MEDIA' } },
      { interaction: () => ({ type: 'COLLECTING_SPECIMEN', planetId: 'jupiter' }), wrong: { kind: 'CARD' }, right: { kind: 'SPECIMEN', planetId: 'jupiter', tokenIndex: 0 } },
      { interaction: () => ({ type: 'CONSULTING_SPECIMEN', planetId: 'jupiter' }), wrong: { kind: 'CARD' }, right: { kind: 'SPECIMEN', planetId: 'jupiter', tokenIndex: 0 } },
      { interaction: () => ({ type: 'CHOOSING_EXERTIEN_CARD', milestone: 30 }), wrong: { kind: 'CARD' }, right: { kind: 'EXERTIEN', cardId: 'aucune' } },
      { interaction: () => ({ type: 'CHOOSING_OBS2_ACTION' }), wrong: { kind: 'CARD' }, right: { kind: 'ACCEPT', accepted: false } },
      { interaction: () => ({ type: 'CHOOSING_OBS3_ACTION' }), wrong: { kind: 'CARD' }, right: { kind: 'ACCEPT', accepted: false } },
      { interaction: () => ({ type: 'CHOOSING_OBS4_ACTION' }), wrong: { kind: 'CARD' }, right: { kind: 'OBS4', choice: 'MOVE' } },
      { interaction: () => ({ type: 'SELECTING_SCAN_SECTOR', color: 'Rouge' } as unknown as InteractionState), wrong: { kind: 'CARD' }, right: { kind: 'SECTOR', sectorId: 'aucun' } },
    ];

    test.each(cases.map(c => [c.interaction.toString().match(/type: '(\w+)'/)?.[1], c] as const))('%s', (_name, c) => {
      const g = withInteraction(c.interaction());
      expect(dispatch(g, { type: 'CHOOSE', choice: c.wrong }).error).toBe(WRONG);
      // Le bon genre de choix atteint la règle : accepté, ou refusé par elle (pas par l'aiguillage)
      expect(dispatch(g, { type: 'CHOOSE', choice: c.right }).error).not.toBe(WRONG);
    });

    test('une interaction sans choix (déplacements gratuits) refuse tout choix', () => {
      expect(dispatch(withInteraction({ type: 'MOVING_PROBE', count: 1 }), { type: 'CHOOSE', choice: { kind: 'CARD' } }).error).toBe(WRONG);
    });

    test('menu de gains : le gain choisi devient actif, le menu revient ensuite', () => {
      const life: InteractionState = { type: 'PLACING_LIFE_TRACE', color: LifeTraceType.RED };
      const card: InteractionState = { type: 'ACQUIRING_CARD', count: 1, isFree: true };
      const menu: InteractionState = { type: 'CHOOSING_BONUS_ACTION', bonusesSummary: '', choices: [
        { id: 'a', label: 'Trace', state: life, done: false },
        { id: 'b', label: 'Carte', state: card, done: false },
      ] };
      const res = dispatch(withInteraction(menu), { type: 'CHOOSE', choice: { kind: 'MENU', index: 1 } });
      expect(res.error).toBeUndefined();
      expect(res.game.interaction?.type).toBe('ACQUIRING_CARD');
      expect(res.game.pendingInteractions?.[0]?.type).toBe('CHOOSING_BONUS_ACTION');
    });
  });

  describe('étapes de robot', () => {
    test('attente et fin de tour annoncée : la partie ne change pas', () => {
      expect(GameSession.applyRobotStep(game, { kind: 'WAIT' }).game).toBe(game);
      expect(GameSession.applyRobotStep(game, { kind: 'END_TURN' }).game).toBe(game);
    });

    test('une passe impossible est refusée sans modifier la partie', () => {
      const res = GameSession.applyRobotStep({ ...game, phase: GamePhase.SETUP }, { kind: 'PASS', cardsToKeep: [] });
      expect(res.error).toBeDefined();
    });

    test('passe d\'un robot : la main est réduite à 4 cartes au plus', () => {
      const robotGame = { ...game, currentPlayerIndex: 1 };
      const robot = getPlayer(robotGame, P2);
      const keep = CardSystem.getHandCards(robot).slice(0, 4).map(c => c.id);
      const res = GameSession.applyRobotStep(robotGame, { kind: 'PASS', cardsToKeep: keep });
      expect(res.error).toBeUndefined();
      expect(getPlayer(res.game, P2).hasPassed).toBe(true);
    });
  });
});
