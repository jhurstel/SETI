import { InteractionResolver, isAutomaticInteraction } from '../src/core/InteractionResolver';
import { AIController } from '../src/ai/AIController';
import { ResourceSystem } from '../src/systems/ResourceSystem';
import { Game, LifeTraceType, Mission, Sector } from '../src/core/types';
import { createTestGame, getPlayer } from './helpers/gameFixture';

const P1 = 'player_0';
const P2 = 'player_1';

function markSignals(sector: Sector, playerIds: string[]): void {
  playerIds.forEach((id, i) => {
    sector.signals[i].marked = true;
    sector.signals[i].markedBy = id;
  });
}

const mission = (requirementValue: string, fulfillable: boolean, requirementCount = 2): Mission => ({
  id: 'm1',
  cardId: 'c1',
  name: 'Mission test',
  description: '',
  ownerId: P1,
  requirements: Array.from({ length: requirementCount }, (_, i) => ({ id: `r${i + 1}`, type: requirementValue.split(':')[0], value: requirementValue })),
  completedRequirementIds: [],
  fulfillableRequirementIds: fulfillable ? ['r1'] : [],
  completed: false,
});

describe('InteractionResolver', () => {
  let game: Game;

  beforeEach(async () => {
    game = await createTestGame();
    game.currentPlayerIndex = 0;
  });

  test('isAutomaticInteraction', () => {
    expect(isAutomaticInteraction({ type: 'RESOLVING_SECTOR', sectorId: 's' })).toBe(true);
    expect(isAutomaticInteraction({ type: 'DRAW_AND_SCAN', count: 1 })).toBe(true);
    expect(isAutomaticInteraction({ type: 'IDLE' })).toBe(false);
    expect(isAutomaticInteraction({ type: 'PLACING_LIFE_TRACE', color: LifeTraceType.RED })).toBe(false);
  });

  describe('TRIGGER_CARD_EFFECT (PIXL)', () => {
    test('rapporte des PV par média', () => {
      getPlayer(game, P1).mediaCoverage = 4;
      const scoreBefore = getPlayer(game, P1).score;
      const res = InteractionResolver.resolve(game, P1, { type: 'TRIGGER_CARD_EFFECT', effectType: 'SCORE_PER_MEDIA', value: 2, sequenceId: 'seq' });

      expect(getPlayer(res.updatedGame, P1).score).toBe(scoreBefore + 8);
      expect(res.historyEntries).toEqual([{ message: 'gagne 8 PV (Bonus PIXL)', playerId: P1, sequenceId: 'seq' }]);
      expect(getPlayer(game, P1).score).toBe(scoreBefore);
    });
  });

  describe('RESOLVING_SECTOR', () => {
    let sector: Sector;

    beforeEach(() => {
      sector = game.board.sectors[0];
      sector.firstBonus = { pv: 3 };
      sector.nextBonus = { pv: 5 };
    });

    test('couvre le secteur et applique le bonus au gagnant', () => {
      markSignals(sector, [P1, P2, P1]);
      const scoreBefore = getPlayer(game, P1).score;
      const res = InteractionResolver.resolve(game, P1, { type: 'RESOLVING_SECTOR', sectorId: sector.id, sequenceId: 'seq' });

      expect(res.updatedGame.board.sectors[0].isCovered).toBe(true);
      expect(getPlayer(res.updatedGame, P1).score).toBe(scoreBefore + 3);
      expect(res.summary).toMatch(/^Secteur résolu\. couvre le secteur/);
      expect(res.historyEntries.every(e => e.sequenceId === 'seq')).toBe(true);
    });

    test("l'historique sépare les gains du gagnant de ceux communs aux joueurs présents", () => {
      markSignals(sector, [P1, P2, P1]);
      const res = InteractionResolver.resolve(game, P1, { type: 'RESOLVING_SECTOR', sectorId: sector.id, sequenceId: 'seq' });
      const message = res.historyEntries.find(e => e.message.startsWith('couvre le secteur'))!.message;
      expect(message).toMatch(new RegExp(`^couvre le secteur ${sector.name} et gagne .+ ; les joueurs présents \\(.+ et .+\\) gagnent chacun`));
    });

    test('gagnant humain d\'une autre couleur : son interaction lui est adressée (playerId)', () => {
      sector.firstBonus = { lifetraces: [{ amount: 1, scope: LifeTraceType.RED }] };
      markSignals(sector, [P2, P2, P1]);
      const res = InteractionResolver.resolve(game, P1, { type: 'RESOLVING_SECTOR', sectorId: sector.id, sequenceId: 'seq' });

      expect(res.newInteractions).toContainEqual(expect.objectContaining({ type: 'PLACING_LIFE_TRACE', playerId: P2, sequenceId: 'seq' }));
    });

    test("gain d'une carte par le gagnant humain pendant le tour d'un autre joueur : l'interaction lui est adressée (régression)", () => {
      sector.firstBonus = { anycard: 1 };
      markSignals(sector, [P2, P2, P1]);
      const res = InteractionResolver.resolve(game, P1, { type: 'RESOLVING_SECTOR', sectorId: sector.id, sequenceId: 'seq' });

      expect(res.newInteractions).toContainEqual(expect.objectContaining({ type: 'ACQUIRING_CARD', playerId: P2 }));
    });

    test("bonus d'une trace de vie posée pendant le tour d'un autre joueur (carte Alien…) : interactions adressées au poseur", () => {
      const res = ResourceSystem.processBonuses({ anycard: 1, revealAndTriggerFreeAction: true }, game, P2, 'lifetrace', 'seq');
      expect(res.newPendingInteractions.length).toBeGreaterThan(0);
      expect(res.newPendingInteractions.every(i => i.playerId === P2)).toBe(true);
    });

    test('gagnant robot : sa trace de vie est placée automatiquement', () => {
      sector.firstBonus = { lifetraces: [{ amount: 1, scope: LifeTraceType.RED }] };
      getPlayer(game, P2).type = 'robot';
      markSignals(sector, [P2, P2, P1]);
      const res = InteractionResolver.resolve(game, P1, { type: 'RESOLVING_SECTOR', sectorId: sector.id, sequenceId: 'seq' });

      expect(res.newInteractions.some(i => 'playerId' in i && i.playerId === P2)).toBe(false);
      expect(res.updatedGame.board.alienBoards[0].lifeTraces.some(t => t.playerId === P2)).toBe(true);
    });
  });

  describe('DRAW_AND_SCAN', () => {
    test('révèle la carte du dessus et demande un signal de sa couleur', () => {
      const top = game.decks.cards[0];
      const res = InteractionResolver.resolve(game, P1, { type: 'DRAW_AND_SCAN', count: 1, sequenceId: 'seq' });

      expect(res.updatedGame.decks.discardPile.map(c => c.id)).toContain(top.id);
      expect(res.newInteractions).toEqual([expect.objectContaining({ type: 'SELECTING_SCAN_SECTOR', color: top.scanSector, cardId: top.id })]);
      expect(res.forceStacking).toBe(true);
      expect(game.decks.cards[0].id).toBe(top.id);
    });

    test('pioche vide : rien ne se passe', () => {
      game.decks.cards = [];
      const res = InteractionResolver.resolve(game, P1, { type: 'DRAW_AND_SCAN', count: 1 });
      expect(res.updatedGame).toBe(game);
      expect(res.newInteractions).toEqual([]);
    });
  });

  describe('CLAIMING_MISSION_REQUIREMENT', () => {
    test('valide un prérequis réalisable et donne sa récompense', () => {
      getPlayer(game, P1).missions = [mission('GAIN_ON_VISIT:jupiter:pv:4', true)];
      const scoreBefore = getPlayer(game, P1).score;
      const res = InteractionResolver.resolve(game, P1, { type: 'CLAIMING_MISSION_REQUIREMENT', missionId: 'm1', requirementId: 'r1', sequenceId: 'seq' });
      const m = getPlayer(res.updatedGame, P1).missions[0];

      expect(m.completedRequirementIds).toEqual(['r1']);
      expect(m.completed).toBe(false);
      expect(m.fulfillableRequirementIds).toEqual([]);
      expect(getPlayer(res.updatedGame, P1).score).toBe(scoreBefore + 4);
      expect(res.historyEntries[0].message).toContain('valide un objectif de la mission "Mission test"');
    });

    test('le dernier prérequis accomplit la mission', () => {
      getPlayer(game, P1).missions = [mission('GAIN_ON_VISIT:jupiter:pv:4', true, 1)];
      const res = InteractionResolver.resolve(game, P1, { type: 'CLAIMING_MISSION_REQUIREMENT', missionId: 'm1', requirementId: 'r1' });
      expect(getPlayer(res.updatedGame, P1).missions[0].completed).toBe(true);
      expect(res.historyEntries[0].message).toContain('accomplit la mission');
    });

    test('conditions non remplies : erreur et état inchangé', () => {
      getPlayer(game, P1).missions = [mission('GAIN_IF_ORBITER_OR_LANDER:venus:pv:7', false)];
      const res = InteractionResolver.resolve(game, P1, { type: 'CLAIMING_MISSION_REQUIREMENT', missionId: 'm1', requirementId: 'r1' });
      expect(res.error).toBe('Conditions non remplies.');
      expect(res.updatedGame).toBe(game);
    });
  });

  describe('via AIController (robot)', () => {
    test('PIXL est désormais appliqué pour un robot (régression)', () => {
      const player = getPlayer(game, P1);
      player.mediaCoverage = 3;
      const scoreBefore = player.score;
      const res = AIController.processInteractionQueue(game, [{ type: 'TRIGGER_CARD_EFFECT', effectType: 'SCORE_PER_MEDIA', value: 1 }], 'seq', player);

      expect(getPlayer(res.updatedGame, P1).score).toBe(scoreBefore + 3);
      expect(res.historyEntries.some(e => e.message.includes('ne peut pas gérer'))).toBe(false);
    });

    test('l\'interaction du gagnant humain d\'un secteur couvert par un robot est transmise à l\'interface', () => {
      const robot = getPlayer(game, P1);
      robot.type = 'robot';
      const sector = game.board.sectors[0];
      sector.firstBonus = { lifetraces: [{ amount: 1, scope: LifeTraceType.RED }] };
      markSignals(sector, [P2, P2, P1]);

      const res = AIController.processInteractionQueue(game, [{ type: 'RESOLVING_SECTOR', sectorId: sector.id }], 'seq', robot);

      expect(res.newPendingInteractions).toContainEqual(expect.objectContaining({ type: 'PLACING_LIFE_TRACE', playerId: P2 }));
      expect(res.updatedGame.board.alienBoards[0].lifeTraces.some(t => t.playerId === P2)).toBe(false);
    });
  });
});
