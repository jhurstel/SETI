import { DataLoader } from '../src/core/DataLoader';
import { CostType } from '../src/core/types';

const HEADER = 'Id;Nom;Type;Texte;Action gratuite;Couleur scan;Revenu;Cout;Gain;Contrainte';

/** Cartes lues depuis un CSV écrit pour le test */
async function load(rows: string[], header = true) {
  DataLoader.setReader(async () => [...(header ? [HEADER] : []), ...rows].join('\n'));
  return DataLoader.loadCards('cards/essai.csv');
}

const allEffects = (card: { immediateEffects: unknown[]; passiveEffects: unknown[]; permanentEffects: unknown[] }) =>
  [...card.immediateEffects, ...card.passiveEffects, ...card.permanentEffects];

describe('DataLoader : lignes mal formées du CSV', () => {
  test('contraintes avec un mauvais nombre de champs : aucun effet (ni effet faux, ni erreur)', async () => {
    // Chaque format de la colonne Contrainte, avec un champ de trop ou de moins
    const malformed = [
      'END_CONDITION:a:b', 'VISIT_PLANET:mars', 'VISIT_UNIQUE:a:b', 'ASTEROID_EXIT_COST:a:b', 'VISIT_ASTEROID:a:b',
      'VISIT_COMET:a:b', 'SAME_DISK_MOVE:a', 'GAIN_LIFETRACE_IF_ASTEROID:a', 'SCORE_PER_MEDIA:a:b', 'SCORE_PER_TECH_TYPE:a:b',
      'MEDIA_IF_SHARED_TECH:a:b', 'SCORE_PER_SECTOR:a', 'GAIN_ON_TOKEN:a', 'SCORE_PER_ORBITER_LANDER:a', 'SCORE_PER_COVERED_SECTOR:a',
      'SCORE_PER_LIFETRACE:a', 'SCORE_PER_SIGNAL:a', 'SCORE_PER_TECH_CATEGORY:a',
      'GAIN_ON_ORBIT:a', 'GAIN_ON_LAND:a', 'GAIN_ON_ORBIT_OR_LAND:a', 'GAIN_ON_LAUNCH:a', 'GAIN_ON_SCAN:a', 'GAIN_ON_SIGNAL:a',
      'GAIN_ON_TECH:a', 'GAIN_ON_LIFETRACE:a', 'GAIN_ON_VISIT:a', 'GAIN_ON_PLAY:a', 'GAIN_ON_DISCARD:a',
    ];
    const [card] = await load([`1;Essai;Action;;;;;2;;${malformed.join(' + ')}`]);
    expect(allEffects(card)).toEqual([]);
  });

  test('cibles sans variante connue : ignorées ; valeurs absentes : 1 par défaut', async () => {
    const [card] = await load([
      '2;Essai;Fin de jeu;;;;;1;;GAIN_ON_TECH:violet:media:1 + GAIN_ON_LIFETRACE:violet:media:1 + GAIN_ON_VISIT:pluton:media:1 + GAIN_ON_PLAY:9:media:1 + GAIN_ON_DISCARD:violet:media:1 + GAIN_LIFETRACE_IF_MEDIA:red:x + SCORE_PER_SPECIES_LIFETRACE:anomalies:x',
    ]);
    expect(card.permanentEffects).toEqual([]);
    expect(card.passiveEffects).toEqual([
      { type: 'GAIN_LIFETRACE_IF_MEDIA', target: 'red', value: 1 },
      { type: 'SCORE_PER_SPECIES_LIFETRACE', target: 'anomalies', value: 1 },
    ]);
  });

  test('variantes rares : toute technologie, toute trace, astéroïde, 3 crédits, défausse pour un déplacement', async () => {
    const [card] = await load([
      '3;Essai;Mission déclenchable;;;;;1;;GAIN_ON_TECH:any:media:1 + GAIN_ON_LIFETRACE:any:media:1 + GAIN_ON_VISIT:asteroid:media:1 + GAIN_ON_PLAY:3:media:1 + GAIN_ON_DISCARD:move:media:1',
    ]);
    expect(card.permanentEffects.map(e => e.type)).toEqual(['GAIN_ON_ANY_TECH', 'GAIN_ON_ANY_LIFETRACE', 'GAIN_ON_VISIT_ASTEROID', 'GAIN_ON_PLAY_3_CREDITS', 'GAIN_ON_DISCARD_MOVE']);
  });

  test('sans en-tête, coût en énergie illisible, gain sans quantité', async () => {
    const [card] = await load(['4;Essai;Action;;;;;energie;Sonde;'], false);
    expect(card.id).toBe('4');
    expect(card.costType).toBe(CostType.ENERGY);
    expect(card.cost).toBe(0);
    expect(card.immediateEffects).toEqual([expect.objectContaining({ value: 1 })]);
  });
});
