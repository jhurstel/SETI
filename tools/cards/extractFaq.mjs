// Relevé des cartes illustrées dans la FAQ (entrées « #N Nom » des pages « FAQ cartes ») : tools/cards/faq-cards.json,
// lu par l'audit des cartes (tools/cards/cardAudit.ts). Demande pdftotext (fourni avec Git pour Windows, poppler-utils ailleurs) ;
// absent de la CI : le relevé est commité, à régénérer quand la FAQ change.
// Usage : node tools/cards/extractFaq.mjs [public/docs/SETI-FAQ-FR.pdf]
import { execFileSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const pdf = process.argv[2] ?? path.join(root, 'public/docs/SETI-FAQ-FR.pdf');
const text = execFileSync('pdftotext', ['-enc', 'UTF-8', pdf, '-'], { maxBuffer: 64 * 1024 * 1024 }).toString('utf8');

const version = text.match(/VERSION BGG ([\d.]+)/)?.[1] ?? '';
const pages = text.split('\f');
const cards = [];
pages.forEach((pageText, index) => {
  const lines = pageText.split(/\r?\n/).map(line => line.trim());
  for (let i = 0; i < lines.length; i++) {
    if (!lines[i].startsWith('#')) continue;
    // Titre sur deux lignes : la suite ne commence pas par « # » mais contient l'entrée suivante ou finit le nom
    let heading = lines[i];
    while (/\/\s*$/.test(heading) || (lines[i + 1] && !lines[i + 1].startsWith('#') && /\/\s*#/.test(lines[i + 1]))) {
      i++;
      heading = `${heading} ${lines[i]}`;
      if (!lines[i]) break;
    }
    for (const entry of heading.split(/\s*\/\s*(?=#)/)) {
      const match = entry.match(/^#((?:ET\.\d+)|(?:SE FR \d+)|\d+)\s*[­–-]?\s*(.+?)\s*\/?$/);
      if (!match) continue;
      const id = match[1];
      // Nom collé à son numéro par la mise en page (« Planétaire112 ») : numéro retiré ;
      // titre suivi du paragraphe sur la même ligne (#103) : coupé avant la première phrase
      const name = match[2]
        .replace(new RegExp(`(?<=\\p{L})${id.replace('.', '\\.')}$`, 'u'), '')
        .replace(/^(.{12,}?)\s+(?:La|Le|Les|Vous|Il|Elle|Si|Cette|Ce|Lorsque)\s.*$/, '$1')
        .trim();
      if (!cards.some(card => card.id === id)) cards.push({ id, name, page: index + 1 });
    }
  }
});

const out = path.join(root, 'tools/cards/faq-cards.json');
fs.writeFileSync(out, `${JSON.stringify({ source: 'public/docs/SETI-FAQ-FR.pdf', version: `BGG ${version}`, cards }, null, 2)}\n`);
console.log(`${cards.length} cartes illustrées (FAQ ${version}) → ${path.relative(root, out)}`);
