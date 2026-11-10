import { CardSystem } from '../src/systems/CardSystem';
import { Game, Mission } from '../src/core/types';
import { createTestGame, getPlayer } from './helpers/gameFixture';

const P1 = 'player_0';

function addMission(game: Game, requirements: { id: string; type: string; value: string }[]): Mission {
  const mission = { id: `m-${requirements[0].id}`, cardId: 'c', name: 'Mission test', description: '', ownerId: P1, requirements, completedRequirementIds: [], fulfillableRequirementIds: [], completed: false } as Mission;
  getPlayer(game, P1).missions.push(mission);
  return mission;
}

describe('Objectifs de mission à valider avant de finir son tour ou de passer', () => {
  let game: Game;
  beforeEach(async () => {
    game = await createTestGame();
  });

  test('rien à valider : pas d\'avertissement', () => {
    addMission(game, [{ id: 'r', type: 'GAIN_ON_LAUNCH', value: 'GAIN_ON_LAUNCH:pv:1' }]);
    expect(CardSystem.claimableRequirements(game, P1)).toEqual([]);
    expect(CardSystem.unclaimedMissionWarning(game, P1, 'END_TURN')).toBeNull();
  });

  test('mission déclenchable : un cercle déclenché, puis recouvert', () => {
    const mission = addMission(game, [{ id: 'r', type: 'GAIN_ON_LAUNCH', value: 'GAIN_ON_LAUNCH:pv:1' }]);
    mission.fulfillableRequirementIds.push('r');
    expect(CardSystem.claimableRequirements(game, P1)).toEqual([{ missionId: mission.id, requirementId: 'r' }]);
    expect(CardSystem.unclaimedMissionWarning(game, P1, 'END_TURN')).toBe(
      'Un objectif de mission peut être validé ("Mission test") : cliquez sur le cercle qui clignote pour en recevoir la récompense. Terminer le tour sans le faire ?');

    mission.completedRequirementIds.push('r');
    expect(CardSystem.isRequirementClaimable(game, P1, mission, 'r')).toBe(false);
    expect(CardSystem.unclaimedMissionWarning(game, P1, 'PASS')).toBeNull();
  });

  test('mission conditionnelle : condition remplie (orbiteur sur Vénus) ; plusieurs objectifs à la passe', () => {
    const conditional = addMission(game, [{ id: 'c1', type: 'GAIN_IF_ORBITER_OR_LANDER', value: 'GAIN_IF_ORBITER_OR_LANDER:venus:pv:7:media:1' }]);
    expect(CardSystem.isRequirementClaimable(game, P1, conditional, 'c1')).toBe(false);
    game.board.planets.find(p => p.id === 'venus')!.orbiters.push({ id: 'o', ownerId: P1 } as never);
    expect(CardSystem.isRequirementClaimable(game, P1, conditional, 'c1')).toBe(true);
    // Cercle inconnu de la mission : rien à recouvrir
    expect(CardSystem.isRequirementClaimable(game, P1, conditional, 'inconnu')).toBe(false);

    const triggered = addMission(game, [{ id: 't1', type: 'GAIN_ON_LAUNCH', value: 'GAIN_ON_LAUNCH:pv:1' }]);
    triggered.name = 'Autre mission';
    triggered.fulfillableRequirementIds.push('t1');
    expect(CardSystem.unclaimedMissionWarning(game, P1, 'PASS')).toBe(
      '2 objectifs de mission peuvent être validés ("Mission test", "Autre mission") : cliquez sur le cercle qui clignote pour en recevoir la récompense. Passer sans le faire ?');
  });
});
