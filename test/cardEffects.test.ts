import { effectAmount, effectBonus, effectNumber, effectString } from '../src/core/cardEffects';
import { SectorType } from '../src/core/types';

describe('accesseurs de CardEffect.value', () => {
  test('effectNumber : nombre, sinon 0', () => {
    expect(effectNumber({ type: 'GAIN', value: 3 })).toBe(3);
    expect(effectNumber({ type: 'X', value: true })).toBe(0);
    expect(effectNumber({ type: 'X', value: 'GAIN_IF_COVERED:red:pv:4' })).toBe(0);
  });

  test('effectString : chaîne de mission, sinon chaîne vide', () => {
    expect(effectString({ type: 'GAIN_IF_COVERED', value: 'GAIN_IF_COVERED:red:pv:4' })).toBe('GAIN_IF_COVERED:red:pv:4');
    expect(effectString({ type: 'GAIN', value: 2 })).toBe('');
  });

  test('effectAmount : quantité + portée, ou quantité seule pour une valeur numérique', () => {
    expect(effectAmount<SectorType>({ type: 'ACTION', value: { amount: 2, scope: SectorType.YELLOW } })).toEqual({ amount: 2, scope: SectorType.YELLOW });
    expect(effectAmount({ type: 'ACTION', value: 1 })).toEqual({ amount: 1, scope: undefined });
  });

  test('effectBonus : gains multiples, sinon objet vide', () => {
    expect(effectBonus({ type: 'SAME_DISK_MOVE', value: { pv: 2, media: 1 } })).toEqual({ pv: 2, media: 1 });
    expect(effectBonus({ type: 'ACTION', value: { amount: 2, scope: 'x' } })).toEqual({});
    expect(effectBonus({ type: 'GAIN', value: 4 })).toEqual({});
  });
});
