// Section « Visuel des cartes » de docs/etat-des-lieux-cartes.md : effets sans symbole, cartes sans photo dans la FAQ,
// cartes de la FAQ absentes du jeu, écarts de nom. Pure (sans lecture de fichier) : partagée par l'outil
// (tools/cards/cardAudit.ts, npm run cards:audit) et par le test qui vérifie que le document est à jour.
import { Card } from '../../src/core/types';
import { describeCard, unsymbolizedParts } from '../../src/ui/components/cardFaceModel';

export interface FaqCards {
  source: string;
  version: string;
  cards: { id: string; name: string; page: number }[];
}

export const AUDIT_START = '<!-- cards:audit:start -->';
export const AUDIT_END = '<!-- cards:audit:end -->';

/** Nom comparable : apostrophes typographiques, casse, accents et ponctuation ignorés */
const normalize = (name: string) => name.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[’']/g, "'").replace(/[^a-z0-9']+/gi, ' ').trim().toLowerCase();

/** Numéro de tri d'une carte (« 12 », « ET.7 ») : paquet de base puis cartes d'espèce */
const order = (id: string) => (id.startsWith('ET.') ? 1000 : 0) + (Number(id.replace(/^ET\./, '')) || 0);

/** Suite de numéros résumée en plages (« 5-8, 10, ET.8-ET.12 ») */
function ranges(ids: string[]): string {
  const sorted = [...ids].sort((a, b) => order(a) - order(b));
  const parts: string[] = [];
  for (let i = 0; i < sorted.length; i++) {
    let j = i;
    while (j + 1 < sorted.length && order(sorted[j + 1]) === order(sorted[j]) + 1) j++;
    parts.push(j > i + 1 ? `${sorted[i]}-${sorted[j]}` : j === i + 1 ? `${sorted[i]}, ${sorted[j]}` : sorted[i]);
    i = j;
  }
  return parts.join(', ');
}

export function buildCardAudit(cards: Card[], faq: FaqCards): string {
  const sorted = [...cards].sort((a, b) => order(a.id) - order(b.id));
  const byId = new Map(sorted.map(card => [card.id, card]));
  const faqIds = new Set(faq.cards.map(card => card.id));

  const unsymbolized = sorted.map(card => ({ card, parts: unsymbolizedParts(describeCard(card)) })).filter(entry => entry.parts.length > 0);
  const withoutPhoto = sorted.filter(card => !faqIds.has(card.id));
  const absent = faq.cards.filter(card => !byId.has(card.id));
  const renamed = faq.cards.filter(card => byId.has(card.id) && normalize(byId.get(card.id)!.name) !== normalize(card.name));

  const lines: string[] = [
    AUDIT_START,
    '## Visuel des cartes',
    '',
    `Section générée par \`npm run cards:audit\` (\`tools/cards/cardAudit.ts\`) à partir des CSV et du relevé de la FAQ (\`tools/cards/faq-cards.json\`, FAQ ${faq.version}) ; \`test/CardAudit.test.ts\` vérifie qu'elle est à jour. Ne pas la modifier à la main.`,
    '',
    `### Effets sans symbole (${unsymbolized.length} cartes)`,
    '',
    'Parties d\'effet que la face d\'une carte (`ui/components/CardFace`) écrit en texte faute de symbole (tables `EFFECT_SYMBOLS` et `TEXT_EFFECTS` de `cardFaceModel.ts`).',
    '',
    '| Carte | Nom | En texte |',
    '|---|---|---|',
    ...unsymbolized.map(({ card, parts }) => `| ${card.id} | ${card.name} | ${parts.join(' ; ')} |`),
    '',
    `### Cartes sans photo dans la FAQ (${withoutPhoto.length} sur ${sorted.length})`,
    '',
    'Aucune image de référence dans la FAQ pour vérifier leur visuel (comparer à une vraie carte) :',
    '',
    `- Paquet de base : ${ranges(withoutPhoto.filter(card => !card.id.startsWith('ET.')).map(card => card.id)) || 'aucune'}`,
    `- Cartes d'espèce : ${ranges(withoutPhoto.filter(card => card.id.startsWith('ET.')).map(card => card.id)) || 'aucune'}`,
    '',
    `### Cartes de la FAQ absentes du jeu (${absent.length})`,
    '',
    ...(absent.length ? ['| Carte | Nom | Page de la FAQ |', '|---|---|---|', ...absent.map(card => `| ${card.id} | ${card.name} | ${card.page} |`)] : ['Aucune.']),
    '',
    `### Écarts de nom entre la FAQ et le jeu (${renamed.length})`,
    '',
    ...(renamed.length ? ['| Carte | FAQ | Jeu |', '|---|---|---|', ...renamed.map(card => `| ${card.id} | ${card.name} | ${byId.get(card.id)!.name} |`)] : ['Aucun.']),
    AUDIT_END,
  ];
  return lines.join('\n');
}

/** Remplace (ou ajoute à la fin) la section générée dans le document */
export function replaceAuditSection(document: string, section: string): string {
  const start = document.indexOf(AUDIT_START);
  const end = document.indexOf(AUDIT_END);
  if (start === -1 || end === -1) return `${document.replace(/\s*$/, '')}\n\n${section}\n`;
  return document.slice(0, start) + section + document.slice(end + AUDIT_END.length);
}

/** Section actuellement écrite dans le document (pour la comparer à celle recalculée) */
export function currentAuditSection(document: string): string | null {
  const start = document.indexOf(AUDIT_START);
  const end = document.indexOf(AUDIT_END);
  return start === -1 || end === -1 ? null : document.slice(start, end + AUDIT_END.length);
}
