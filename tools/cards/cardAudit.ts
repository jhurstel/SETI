// Audit du visuel des cartes : écrit la section « Visuel des cartes » de docs/etat-des-lieux-cartes.md
// (effets sans symbole, cartes sans photo dans la FAQ, cartes de la FAQ absentes du jeu, écarts de nom).
// Usage : npm run cards:audit (relevé de la FAQ : node tools/cards/extractFaq.mjs)
import * as fs from 'fs';
import * as path from 'path';
import { DataLoader } from '../../src/core/DataLoader';
import { Card } from '../../src/core/types';
import { buildCardAudit, FaqCards, replaceAuditSection } from './cardAuditReport';

const ROOT = path.resolve(__dirname, '../../..');
const CSVS = ['main', 'mascamites', 'anomalies', 'oumuamua', 'centauriens', 'exertiens'];
DataLoader.setReader(file => fs.promises.readFile(path.join(ROOT, 'public', file), 'utf-8'));

(async () => {
  const cards: Card[] = [];
  for (const name of CSVS) cards.push(...await DataLoader.loadCards(`cards/${name}.csv`));
  const faq: FaqCards = JSON.parse(fs.readFileSync(path.join(ROOT, 'tools/cards/faq-cards.json'), 'utf-8'));
  const docPath = path.join(ROOT, 'docs/etat-des-lieux-cartes.md');
  // Fins de ligne du document gardées (CRLF sous Windows)
  const raw = fs.readFileSync(docPath, 'utf-8');
  const eol = raw.includes('\r\n') ? '\r\n' : '\n';
  const updated = replaceAuditSection(raw.replace(/\r\n/g, '\n'), buildCardAudit(cards, faq));
  fs.writeFileSync(docPath, updated.replace(/\n/g, eol));
  console.log(`${cards.length} cartes, relevé de la FAQ ${faq.version} (${faq.cards.length} cartes) → docs/etat-des-lieux-cartes.md`);
})();
