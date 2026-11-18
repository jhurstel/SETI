import * as fs from 'fs';
import * as path from 'path';
import { DataLoader } from '../src/core/DataLoader';
import { Card } from '../src/core/types';
import { buildCardAudit, currentAuditSection, FaqCards, replaceAuditSection } from '../tools/cards/cardAuditReport';
import { mockFetchFromPublic } from './helpers/gameFixture';

/**
 * Section « Visuel des cartes » de docs/etat-des-lieux-cartes.md : recalculée depuis les CSV et le relevé de la FAQ,
 * elle doit être celle du document (sinon : npm run cards:audit).
 */

const ROOT = path.resolve(__dirname, '..');
const CSVS = ['main', 'mascamites', 'anomalies', 'oumuamua', 'centauriens', 'exertiens'];
let cards: Card[];
let faq: FaqCards;

beforeAll(async () => {
  const fetchSpy = mockFetchFromPublic();
  cards = [];
  for (const name of CSVS) cards.push(...await DataLoader.loadCards(`cards/${name}.csv`));
  fetchSpy.mockRestore();
  faq = JSON.parse(fs.readFileSync(path.join(ROOT, 'tools/cards/faq-cards.json'), 'utf-8'));
});

test('le document est à jour (sinon : npm run cards:audit)', () => {
  const document = fs.readFileSync(path.join(ROOT, 'docs/etat-des-lieux-cartes.md'), 'utf-8').replace(/\r\n/g, '\n');
  expect(currentAuditSection(document)).toBe(buildCardAudit(cards, faq));
});

test('relevé de la FAQ : cartes illustrées et carte promotionnelle', () => {
  const ids = faq.cards.map(card => card.id);
  expect(ids).toEqual(expect.arrayContaining(['1', '2', '3', '4', 'ET.1', 'SE FR 01']));
  expect(faq.version).toMatch(/^BGG \d+\.\d+$/);
});

test('listes : la carte promotionnelle est absente du jeu, une carte sans photo est listée', () => {
  const report = buildCardAudit(cards, faq);
  expect(report).toMatch(/\| SE FR 01 \| Planète naine depuis 2006 \| 30 \|/);
  // Carte 5 : pas de photo dans la FAQ
  expect(report).toMatch(/Paquet de base : 5-8,/);
});

test('remplacement de la section : à sa place, ou ajoutée à la fin', () => {
  const section = buildCardAudit(cards, faq);
  expect(replaceAuditSection('# Titre\n', section)).toBe(`# Titre\n\n${section}\n`);
  const withOld = `# Titre\n\n<!-- cards:audit:start -->\nancien\n<!-- cards:audit:end -->\n\nSuite\n`;
  expect(replaceAuditSection(withOld, section)).toBe(`# Titre\n\n${section}\n\nSuite\n`);
});
