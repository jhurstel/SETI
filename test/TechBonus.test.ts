import { hasExtraTechPv } from '../src/ui/techBonus';

describe('bonus de 2 PV des tuiles de technologie', () => {
  test('reconnu avec chaque gain de pile, carte au choix comprise (Observation III)', () => {
    expect(hasExtraTechPv({ pv: 5 })).toBe(true);
    expect(hasExtraTechPv({ pv: 2, media: 1 })).toBe(true);
    expect(hasExtraTechPv({ pv: 2, anycard: 1 })).toBe(true);
    expect(hasExtraTechPv({ pv: 2, energy: 1 })).toBe(true);
    expect(hasExtraTechPv({ pv: 3 })).toBe(false);
    expect(hasExtraTechPv({ anycard: 1 })).toBe(false);
  });
});
