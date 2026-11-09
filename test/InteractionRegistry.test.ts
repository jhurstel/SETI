import { acceptsChoice, INTERACTIONS, InteractionState, isAutomaticInteraction, isSkippable, LifeTraceType } from '../src/core/types';

describe('Registre des interactions (INTERACTIONS)', () => {
  test('chaque interaction a une résolution et ses genres de choix', () => {
    for (const descriptor of Object.values(INTERACTIONS)) {
      expect(['choice', 'automatic', 'local']).toContain(descriptor.resolution);
      // Seule une interaction à choix accepte des commandes CHOOSE
      if (descriptor.resolution !== 'choice') expect(descriptor.choices).toEqual([]);
    }
  });

  test('renoncement : déplacements gratuits, menu des bonus, achat de carte, mais pas une carte gagnée en bonus', () => {
    expect(isSkippable({ type: 'MOVING_PROBE', count: 1 })).toBe(true);
    expect(isSkippable({ type: 'CHOOSING_BONUS_ACTION', bonusesSummary: '', choices: [] })).toBe(true);
    expect(isSkippable({ type: 'ACQUIRING_CARD', count: 1 })).toBe(true);
    expect(isSkippable({ type: 'ACQUIRING_CARD', count: 1, isFree: true })).toBe(false);
    expect(isSkippable({ type: 'PLACING_LIFE_TRACE', color: LifeTraceType.RED })).toBe(false);
    // Interaction d'une sauvegarde plus ancienne, inconnue du registre
    expect(isSkippable({ type: 'ANCIENNE' } as unknown as InteractionState)).toBe(false);
  });

  test('genres de choix acceptés', () => {
    const scanCard: InteractionState = { type: 'SELECTING_SCAN_CARD' };
    expect(acceptsChoice(scanCard, { kind: 'CARD', cardId: '1' })).toBe(true);
    expect(acceptsChoice(scanCard, { kind: 'SECTOR', sectorId: 's' })).toBe(false);
    // Déplacements gratuits : réponse par l'action MOVE_PROBE, pas par un choix
    expect(acceptsChoice({ type: 'MOVING_PROBE', count: 1 }, { kind: 'CARD' })).toBe(false);
    expect(acceptsChoice({ type: 'RESOLVING_SECTOR', sectorId: 's' }, { kind: 'SECTOR', sectorId: 's' })).toBe(false);
    expect(acceptsChoice({ type: 'ANCIENNE' } as unknown as InteractionState, { kind: 'CARD' })).toBe(false);
  });

  test('interactions automatiques', () => {
    expect(Object.keys(INTERACTIONS).filter(type => isAutomaticInteraction({ type } as InteractionState)).sort())
      .toEqual(['CLAIMING_MISSION_REQUIREMENT', 'DRAW_AND_SCAN', 'RESOLVING_SECTOR', 'TRIGGER_CARD_EFFECT']);
    expect(isAutomaticInteraction({ type: 'ANCIENNE' } as unknown as InteractionState)).toBe(false);
  });
});
