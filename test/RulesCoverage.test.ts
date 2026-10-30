import { ResourceSystem } from '../src/systems/ResourceSystem';
import { SpeciesSystem } from '../src/systems/SpeciesSystem';
import { TechnologySystem } from '../src/systems/TechnologySystem';
import { ScoreManager } from '../src/core/ScoreManager';
import { InteractionChoices } from '../src/core/InteractionChoices';
import { AlienBoardType, Bonus, CardType, Game, GAME_CONSTANTS, getInteractionLabel, InteractionState, LifeTraceLocation, LifeTraceType, Mission, Probe, ProbeState, SectorType, TechnologyCategory } from '../src/core/types';
import { createTestGame, getPlayer, makeCard } from './helpers/gameFixture';

const P1 = 'player_0';
const P2 = 'player_1';

const probe = (id: string, ownerId: string, state: ProbeState, planetId?: string): Probe => ({
  id, ownerId, position: { x: 0, y: 0 }, solarPosition: { disk: 'B', sector: 1, level: 2 }, state, isOrbiter: state === ProbeState.IN_ORBIT, isLander: state === ProbeState.LANDED, planetId,
});

/** Mission « déclenchable » du joueur, avec son buff permanent */
function addTriggeredMission(game: Game, buffType: string): void {
  const player = getPlayer(game, P1);
  player.missions.push({ id: 'm', cardId: 'c', name: 'Mission test', description: '', ownerId: P1, requirements: [{ id: 'r', type: buffType, value: `${buffType}:pv:1` }], completedRequirementIds: [], fulfillableRequirementIds: [], completed: false } as Mission);
  player.permanentBuffs.push({ type: buffType, value: `${buffType}:pv:1`, id: 'r', source: 'Mission test' });
}

describe('Règles du moteur peu couvertes', () => {
  let game: Game;

  beforeEach(async () => {
    game = await createTestGame();
    game.currentPlayerIndex = 0;
  });

  describe('ResourceSystem', () => {
    test('formatBonus : chaque gain a son libellé', () => {
      const bonus: Bonus = {
        pv: 2, credits: 1, energy: 1, media: 1, card: 2, data: 1, scan: 1, revenue: 1, anycard: 1, probe: 1, orbiting: 1, landing: 1, movements: 2, token: 1,
        signals: [{ amount: 1, scope: SectorType.RED }],
        technologies: [{ amount: 1, scope: [TechnologyCategory.EXPLORATION, TechnologyCategory.OBSERVATION] as never }],
      };
      const labels = ResourceSystem.formatBonus(bonus)!;
      ['2 Pioche', '1 Donnée', '1 Signal (Rouge)', '1 Scan', '1 Réservation', '1 Carte', '1 Tech Exploration ou Observation', '1 Sonde', '1 Orbiteur', '1 Atterrisseur', '2 Déplacement', '1 Token']
        .forEach(label => expect(labels).toContain(label));
      expect(ResourceSystem.formatBonus(undefined as unknown as Bonus)).toBeNull();
    });

    test('lostBonusWarning : avertit quand un gain serait perdu', () => {
      const player = getPlayer(game, P1);
      const warn = (bonus: Bonus) => ResourceSystem.lostBonusWarning(game, P1, bonus);

      player.mediaCoverage = GAME_CONSTANTS.MAX_MEDIA_COVERAGE;
      expect(warn({ media: 1 })).toContain('couverture médiatique');
      player.mediaCoverage = 0;
      expect(warn({ media: 1 })).toBeNull();

      player.cards = [];
      expect(warn({ revenue: 1 })).toContain('aucune carte en main');

      player.probes = [];
      expect(warn({ movements: 1 })).not.toBeNull();
      expect(warn({ movements: 1, probe: 1 })).toBeNull();
      expect(warn({ landing: 1 })).toContain("aucune sonde sur une planète");
      expect(warn({ atmosphericEntry: true })).toContain('aucun orbiteur');
      expect(warn({ sampleReturn: true })).toContain('aucun atterrisseur');

      const computing = game.board.technologyBoard.categorySlots!.find(s => s.category === TechnologyCategory.COMPUTING)!;
      player.technologies = [...computing.technologies];
      expect(warn({ technologies: [{ amount: 1, scope: TechnologyCategory.COMPUTING }] })).toContain('toutes les technologies');
      expect(warn({ technologies: [{ amount: 1, scope: TechnologyCategory.ANY }] })).toBeNull();
      expect(ResourceSystem.lostBonusWarning(game, 'inconnu', { media: 1 })).toBeNull();
    });

    test('échanges : 2 cartes exactement, ressource valide, assez de crédits ou d\'énergie', () => {
      const player = getPlayer(game, P1);
      const ids = player.cards.map(c => c.id);
      expect(ResourceSystem.tradeResources(game, P1, 'card', 'credit', [ids[0]]).error).toBeDefined();
      expect(ResourceSystem.tradeResources(game, P1, 'card', 'inconnu', ids.slice(0, 2)).error).toBe('Type de ressource à recevoir invalide');
      expect(ResourceSystem.tradeResources(game, 'inconnu', 'card', 'credit', ids.slice(0, 2)).error).toBe('Joueur non trouvé');

      const traded = ResourceSystem.tradeResources(game, P1, 'card', 'credit', ids.slice(0, 2));
      expect(traded.error).toBeUndefined();
      expect(traded.updatedGame.decks.discardPile.map(c => c.id)).toEqual(expect.arrayContaining(ids.slice(0, 2)));

      player.credits = 1;
      player.energy = 2;
      expect(ResourceSystem.tradeForCard(game, P1, 'credit').error).toBe('Pas assez de crédits');
      const energy = ResourceSystem.tradeForCard(game, P1, 'energy');
      expect(getPlayer(energy.updatedGame, P1).energy).toBe(0);
      expect(energy.newPendingInteractions).toEqual([expect.objectContaining({ type: 'ACQUIRING_CARD', isFree: true })]);
    });
  });

  describe('Conditions des cartes Exertiens', () => {
    const progress = (condition: string, target: string) =>
      ScoreManager.exertienCardProgress(game, getPlayer(game, P1), makeCard('ex', { type: CardType.EXERTIEN, passiveEffects: [{ type: 'END_CONDITION', target, value: condition }] }))!;

    test('orbiteurs, atterrisseurs (lunes comprises), même planète, cartes réservées, missions accomplies', () => {
      const mars = game.board.planets.find(p => p.id === 'mars')!;
      const jupiter = game.board.planets.find(p => p.id === 'jupiter')!;
      mars.orbiters = [probe('o1', P1, ProbeState.IN_ORBIT), probe('o2', P2, ProbeState.IN_ORBIT)];
      mars.landers = [probe('l1', P1, ProbeState.LANDED)];
      jupiter.satellites![0].landers = [probe('l2', P1, ProbeState.LANDED)];
      getPlayer(game, P1).missions = [{ completed: true } as Mission, { completed: false } as Mission];

      expect(progress('x:2:5', 'ORBITERS')).toEqual({ value: 1, threshold: 2, points: 5 });
      expect(progress('x:2:5', 'LANDERS').value).toBe(2);
      expect(progress('x:2:5', 'SAME_PLANET').value).toBe(2);
      expect(progress('x:2:5', 'RESERVED').value).toBe(getPlayer(game, P1).reservedCards.length);
      expect(progress('x:2:5', 'MISSIONS').value).toBe(1);
      expect(progress('x:2:5', 'INCONNU').value).toBe(0);
      expect(ScoreManager.exertienCardProgress(game, getPlayer(game, P1), makeCard('none'))).toBeNull();
    });
  });

  describe('SpeciesSystem.placeLifeTrace', () => {
    test('piste d\'espèce avant la découverte, ou emplacement déjà occupé : refusé', () => {
      const before = SpeciesSystem.placeLifeTrace(game, 0, LifeTraceType.RED, P1, 's', LifeTraceLocation.SPECIES, 0);
      expect(before.updatedGame).toBe(game);
      expect(before.historyEntries[0].message).toContain('avant sa découverte');

      game.board.alienBoards[0].isDiscovered = true;
      game.board.alienBoards[0].speciesId = AlienBoardType.ANOMALIES;
      const first = SpeciesSystem.placeLifeTrace(game, 0, LifeTraceType.RED, P1, 's', LifeTraceLocation.SPECIES, 0).updatedGame;
      const again = SpeciesSystem.placeLifeTrace(first, 0, LifeTraceType.RED, P2, 's', LifeTraceLocation.SPECIES, 0);
      expect(again.updatedGame).toBe(first);
      expect(again.historyEntries[0].message).toBe('Emplacement déjà occupé.');
    });

    const discover = (species: AlienBoardType) => {
      game.board.alienBoards[0].speciesId = species;
      let g = game;
      for (const color of [LifeTraceType.RED, LifeTraceType.YELLOW, LifeTraceType.BLUE]) {
        g = SpeciesSystem.placeLifeTrace(g, 0, color, P1, 's', LifeTraceLocation.TRIANGLE).updatedGame;
      }
      return g;
    };

    test('découverte des Centauriens : un palier de message à +15 PV pour chaque joueur', () => {
      const scores = game.players.map(p => p.score);
      const g = discover(AlienBoardType.CENTAURIENS);
      g.players.forEach((p, i) => {
        expect(p.centaurienMilestones).toHaveLength(1);
        expect(p.centaurienMilestones[0].score).toBeGreaterThanOrEqual(scores[i] + 15);
      });
    });

    test('découverte des Exertiens : paliers à +20 et +40 PV du meilleur score', () => {
      const best = Math.max(...game.players.map(p => p.score));
      const [first, second] = discover(AlienBoardType.EXERTIENS).exertienMilestones!;
      expect(first).toBeGreaterThanOrEqual(best + 20);
      expect(second).toBe(first + 20);
    });

    test('mission « trace de vie rouge » : signalée comme à recouvrir', () => {
      addTriggeredMission(game, 'GAIN_ON_RED_LIFETRACE');
      const res = SpeciesSystem.placeLifeTrace(game, 0, LifeTraceType.RED, P1, 's', LifeTraceLocation.TRIANGLE);
      expect(res.historyEntries.some(e => e.message === 'déclenche une mission à recouvrir')).toBe(true);
    });
  });

  describe('TechnologySystem.acquireTechnology', () => {
    const techWith = (test: (bonus: Bonus) => boolean) => game.board.technologyBoard.available.find(t => test(t.bonus))!;

    test('bonus de tuile en crédits', () => {
      const tech = { ...techWith(() => true), bonus: { credits: 2 } };
      const credits = getPlayer(game, P1).credits;
      const res = TechnologySystem.acquireTechnology(game, P1, tech);
      expect(getPlayer(res.updatedGame, P1).credits).toBe(credits + tech.bonus.credits!);
    });

    test('mission « technologie Exploration » et points par type de technologie', () => {
      addTriggeredMission(game, 'GAIN_ON_YELLOW_TECH');
      const player = getPlayer(game, P1);
      player.activeBuffs.push({ type: 'SCORE_PER_TECH_TYPE', value: 2, source: 'Carte' });
      const tech = game.board.technologyBoard.available.find(t => t.type === TechnologyCategory.EXPLORATION && !t.bonus.pv)!;
      const score = player.score;

      const res = TechnologySystem.acquireTechnology(game, P1, tech);

      expect(res.historyEntries.some(e => e.message === 'déclenche une mission à recouvrir')).toBe(true);
      expect(getPlayer(res.updatedGame, P1).score).toBe(score + 2 + (tech.bonus.pv ?? 0));
      expect(getPlayer(res.updatedGame, P1).activeBuffs.some(b => b.type === 'SCORE_PER_TECH_TYPE')).toBe(false);
    });

    test('Média si un adversaire a déjà la même technologie', () => {
      const tech = game.board.technologyBoard.available.find(t => t.type === TechnologyCategory.OBSERVATION && !t.bonus.media)!;
      const other = game.board.technologyBoard.available.find(t => t !== tech && TechnologySystem.stackId(t) === TechnologySystem.stackId(tech))!;
      getPlayer(game, P2).technologies.push(other);
      const player = getPlayer(game, P1);
      player.mediaCoverage = 0;
      player.activeBuffs.push({ type: 'MEDIA_IF_SHARED_TECH', value: 1, source: 'Carte' });

      const res = TechnologySystem.acquireTechnology(game, P1, tech);

      expect(getPlayer(res.updatedGame, P1).mediaCoverage).toBe(1);
    });
  });

  test('retrait d\'un atterrisseur (carte 84)', () => {
    const mars = game.board.planets.find(p => p.id === 'mars')!;
    const lander = probe('l1', P1, ProbeState.LANDED, 'mars');
    mars.landers = [lander];
    getPlayer(game, P1).probes = [lander];

    const res = InteractionChoices.removeProbe(game, P1, { type: 'REMOVING_LANDER', sequenceId: 's' }, 'mars');

    expect(res.error).toBeUndefined();
    expect(res.updatedGame.board.planets.find(p => p.id === 'mars')!.landers).toHaveLength(0);
    expect(getPlayer(res.updatedGame, P1).probes.some(p => p.id === 'l1')).toBe(false);
  });

  test('getInteractionLabel : un libellé pour chaque interaction', () => {
    const sample = { count: 2, color: LifeTraceType.RED, milestone: 25, tech: { shorttext: 'Tech' }, categories: [TechnologyCategory.EXPLORATION], targetGain: 'credit', value: 1, effectType: 'X', choices: [], selectedCards: [] };
    const types: InteractionState['type'][] = ['IDLE', 'RESERVING_CARD', 'DISCARDING_CARD', 'TRADING_CARD', 'ACQUIRING_CARD', 'MOVING_PROBE', 'ORBITING_PROBE', 'LANDING_PROBE',
      'ACQUIRING_TECH', 'SELECTING_COMPUTER_SLOT', 'ANALYZING', 'PLACING_LIFE_TRACE', 'PLACING_OBJECTIVE_MARKER', 'SELECTING_SCAN_CARD', 'SELECTING_SCAN_SECTOR',
      'CHOOSING_MEDIA_OR_MOVE', 'CHOOSING_OBS2_ACTION', 'CHOOSING_OBS3_ACTION', 'CHOOSING_OBS4_ACTION', 'DISCARDING_FOR_SIGNAL', 'REMOVING_ORBITER', 'REMOVING_LANDER',
      'CHOOSING_BONUS_ACTION', 'RESOLVING_SECTOR', 'TRIGGER_CARD_EFFECT', 'DRAW_AND_SCAN', 'CLAIMING_MISSION_REQUIREMENT', 'ACQUIRING_ALIEN_CARD',
      'CHOOSING_CENTAURIEN_REWARD', 'COLLECTING_SPECIMEN', 'CONSULTING_SPECIMEN', 'CHOOSING_EXERTIEN_CARD', 'SELECTING_MISSION'];

    types.forEach(type => {
      const label = getInteractionLabel({ ...sample, type } as unknown as InteractionState);
      expect(typeof label).toBe('string');
      expect(label).not.toContain('undefined');
    });
    // Variantes : achat / gain gratuit, scan bonus, technologie bonus
    expect(getInteractionLabel({ type: 'ACQUIRING_CARD', count: 1, isFree: true })).not.toBe(getInteractionLabel({ type: 'ACQUIRING_CARD', count: 1 }));
    expect(getInteractionLabel({ type: 'ACQUIRING_TECH', isBonus: true })).not.toBe(getInteractionLabel({ type: 'ACQUIRING_TECH' }));
  });
});
