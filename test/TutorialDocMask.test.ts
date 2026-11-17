import * as fs from 'fs';
import * as path from 'path';
import { hideLockedSpecies, LOCKED_SPECIES_ANCHOR } from '../src/tutorial/docMask';
import { slugify } from '../src/ui/components/markdown';
import { AlienBoardType } from '../src/core/types';

const SAMPLE = [
  '## 3. Les espèces Alien',
  '### 3.1 Découverte',
  'Règle générale.',
  '<!-- espece:Mascamites -->',
  '### 3.2 Mascamites',
  'Spécimens.',
  '#### Détail',
  'Capsules.',
  '<!-- espece:Anomalies -->',
  '### 3.3 Anomalies',
  'Jetons.',
  '## 4. Les interactions',
  'Tableau.',
].join('\n');

describe('règles des espèces masquées dans la documentation', () => {
  test('espèces non débloquées : sections remplacées par un seul encart, sans leur nom', () => {
    const text = hideLockedSpecies(SAMPLE, []);
    expect(text).not.toMatch(/Mascamites|Anomalies|Spécimens|Capsules|Jetons|espece:/);
    expect(text.match(/Espèces encore inconnues/g)).toHaveLength(1);
    expect(text).toContain('### Espèces encore inconnues');
    expect(text).toContain('Règle générale.');
    expect(text).toContain('## 4. Les interactions');
    expect(slugify('Espèces encore inconnues')).toBe(LOCKED_SPECIES_ANCHOR);
  });

  test('espèce débloquée : sa section entière reste (marqueur retiré), les autres sont masquées', () => {
    const text = hideLockedSpecies(SAMPLE, [AlienBoardType.MASCAMITES]);
    expect(text).toContain('### 3.2 Mascamites\nSpécimens.\n#### Détail\nCapsules.');
    expect(text).not.toMatch(/Anomalies|Jetons|espece:/);
    expect(text).toContain('Espèces encore inconnues');
  });

  test('toutes débloquées : texte inchangé hors marqueurs', () => {
    const text = hideLockedSpecies(SAMPLE, [AlienBoardType.MASCAMITES, AlienBoardType.ANOMALIES]);
    expect(text).toBe(SAMPLE.split('\n').filter(line => !line.startsWith('<!-- espece:')).join('\n'));
  });

  test('vraie documentation : les cinq espèces sont marquées et masquées sans rien d\'autre perdre', () => {
    const source = fs.readFileSync(path.join(__dirname, '../public/docs/documentation.md'), 'utf8');
    const text = hideLockedSpecies(source, []);
    for (const name of Object.values(AlienBoardType)) expect(source).toContain(`<!-- espece:${name} -->`);
    expect(text).not.toMatch(/^#### (Mascamites|Anomalies|Oumuamua|Centauriens|Exertiens)$/m);
    expect(text).not.toContain('{{symboles-espece:');
    expect(text).toContain('#### Espèces encore inconnues');
    expect(text).toContain('### 2.7 Traces de vie et espèces');
    expect(text).toContain('### 3.5 Aliens');
  });
});
