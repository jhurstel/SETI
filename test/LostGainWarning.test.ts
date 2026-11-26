import { CardSystem } from '../src/systems/CardSystem';
import { ResourceSystem } from '../src/systems/ResourceSystem';
import { SpeciesSystem } from '../src/systems/SpeciesSystem';
import { Game, LifeTraceLocation, LifeTraceType, Mission } from '../src/core/types';
import { createTestGame, getPlayer } from './helpers/gameFixture';

/** Gains perdus (données au maximum…) : récompense prévue par le moteur avant chaque clic du joueur qui en donne */

const P1 = 'player_0';

function addMission(game: Game, requirements: { id: string; type: string; value: string }[]): Mission {
  const mission = { id: `m-${requirements[0].id}`, cardId: 'c', name: 'Mission test', description: '', ownerId: P1, requirements, completedRequirementIds: [], fulfillableRequirementIds: [], completed: false } as Mission;
  getPlayer(game, P1).missions.push(mission);
  return mission;
}

describe('Avertissement de gain perdu', () => {
  let game: Game;
  beforeEach(async () => {
    game = await createTestGame();
  });

  test('objectif de mission rapportant une donnée : avertissement à 6 données (non-régression)', () => {
    const triggered = addMission(game, [{ id: 't', type: 'GAIN_ON_LAUNCH', value: 'GAIN_ON_LAUNCH:data:1:pv:2' }]);
    const conditional = addMission(game, [{ id: 'c', type: 'GAIN_IF_ORBITER_OR_LANDER', value: 'GAIN_IF_ORBITER_OR_LANDER:venus:data:2' }]);
    getPlayer(game, P1).data = 6;
    const before = JSON.stringify(game);

    const triggeredBonus = CardSystem.missionRequirementBonus(game, P1, triggered.id, 't');
    expect(triggeredBonus).toMatchObject({ data: 1, pv: 2 });
    expect(ResourceSystem.lostBonusWarning(game, P1, triggeredBonus!)).toContain('limite de données');
    // Condition non remplie : la récompense est tout de même connue (le moteur refusera la validation)
    expect(CardSystem.missionRequirementBonus(game, P1, conditional.id, 'c')).toMatchObject({ data: 2 });
    expect(CardSystem.missionRequirementBonus(game, P1, triggered.id, 'inconnu')).toBeUndefined();
    expect(JSON.stringify(game)).toBe(before);

    getPlayer(game, P1).data = 5;
    expect(ResourceSystem.lostBonusWarning(game, P1, triggeredBonus!)).toBeNull();
  });

  test('donnée ou média à payer (récompense négative) : pas d\'avertissement de limite', () => {
    const player = getPlayer(game, P1);
    player.data = 6;
    player.mediaCoverage = 10;
    expect(ResourceSystem.lostBonusWarning(game, P1, { pv: 15, data: -3 })).toBeNull();
    expect(ResourceSystem.lostBonusWarning(game, P1, { pv: 3, media: -1 })).toBeNull();
  });

  test('emplacement de trace de vie : bonus du triangle (découverte puis suivant), rien sur une piste non découverte', () => {
    const board = game.board.alienBoards[0];
    const before = JSON.stringify(game);
    expect(SpeciesSystem.lifeTraceSlotBonus(game, 0, LifeTraceType.RED, LifeTraceLocation.TRIANGLE)).toBe(board.firstBonus);
    expect(SpeciesSystem.lifeTraceSlotBonus(game, 0, LifeTraceType.RED, LifeTraceLocation.SPECIES, 0)).toBeUndefined();
    expect(SpeciesSystem.lifeTraceSlotBonus(game, 99, LifeTraceType.RED, LifeTraceLocation.TRIANGLE)).toBeUndefined();
    expect(JSON.stringify(game)).toBe(before);

    // La trace posée prend bien le bonus annoncé, la suivante le bonus suivant
    const placed = SpeciesSystem.placeLifeTrace(game, 0, LifeTraceType.RED, P1, 'seq', LifeTraceLocation.TRIANGLE);
    expect(SpeciesSystem.lifeTraceSlotBonus(placed.updatedGame, 0, LifeTraceType.RED, LifeTraceLocation.TRIANGLE)).toEqual(board.nextBonus);
  });

  test('tuile Message des Centauriens : récompense si disponible', () => {
    const species = game.species.find(s => s.message?.length);
    if (!species) {
      expect(SpeciesSystem.centaurienRewardBonus(game, 0)).toBeUndefined();
      return;
    }
    const token = species.message![0];
    expect(SpeciesSystem.centaurienRewardBonus(game, 0)).toBe(token.isAvailable ? token.bonus : undefined);
  });
});
