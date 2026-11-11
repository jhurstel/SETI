/**
 * Rendu Markdown minimal pour la documentation du jeu (public/docs/documentation.md) :
 * titres, paragraphes, listes, tableaux, blocs de code, gras, code, images et liens.
 * Une ligne `{{nom}}` devient un emplacement (`<div data-doc-component="nom">`) où l'interface insère un composant
 * (glossaire des symboles, avec les icônes du jeu).
 * Le texte est échappé : seul le balisage ci-dessus produit du HTML.
 */

export interface TocEntry {
  id: string;
  level: number;
  title: string;
}

const escapeHtml = (text: string) =>
  text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** Identifiant d'ancre d'un titre (sans accents ni ponctuation) */
export const slugify = (text: string) =>
  text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

/** Adresse relative (ex. docs/regles.pdf) : résolue depuis la base de l'application */
const resolve = (href: string, baseUrl: string) => (/^(https?:|#)/.test(href) ? href : `${baseUrl}${href}`);

/** Image `![légende](adresse)` (capture d'écran), puis lien `[texte](adresse)`, ouvert dans un nouvel onglet */
const inline = (text: string, baseUrl: string) =>
  escapeHtml(text)
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/!\[([^\]]*)\]\(([^)\s]+)\)/g, (_m, alt: string, src: string) =>
      `<img class="seti-doc-image" src="${resolve(src, baseUrl)}" alt="${alt}" loading="lazy">`)
    .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_m, label: string, href: string) =>
      `<a href="${resolve(href, baseUrl)}" target="_blank" rel="noopener noreferrer">${label}</a>`);

const tableCells = (line: string) => line.trim().replace(/^\||\|$/g, '').split('|').map(cell => cell.trim());

export function renderMarkdown(source: string, baseUrl = ''): { html: string; toc: TocEntry[] } {
  const lines = source.replace(/\r\n/g, '\n').split('\n');
  const html: string[] = [];
  const toc: TocEntry[] = [];
  let paragraph: string[] = [];
  let list: string[] = [];

  const flush = () => {
    if (paragraph.length) html.push(`<p>${inline(paragraph.join(' '), baseUrl)}</p>`);
    if (list.length) html.push(`<ul>${list.map(item => `<li>${inline(item, baseUrl)}</li>`).join('')}</ul>`);
    paragraph = [];
    list = [];
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const heading = /^(#{1,4})\s+(.*)$/.exec(line);
    const component = /^\{\{([a-z-]+)\}\}$/.exec(line.trim());
    if (component) {
      flush();
      html.push(`<div data-doc-component="${component[1]}"></div>`);
    } else if (line.startsWith('```')) {
      flush();
      const code: string[] = [];
      for (i++; i < lines.length && !lines[i].startsWith('```'); i++) code.push(lines[i]);
      html.push(`<pre><code>${escapeHtml(code.join('\n'))}</code></pre>`);
    } else if (heading) {
      flush();
      const level = heading[1].length;
      const title = heading[2].trim();
      const id = slugify(title);
      if (level > 1) toc.push({ id, level, title: title.replace(/[`*]/g, '') });
      html.push(`<h${level} id="${id}">${inline(title, baseUrl)}</h${level}>`);
    } else if (line.trim().startsWith('|') && /^\s*\|[\s:|-]+\|\s*$/.test(lines[i + 1] ?? '')) {
      flush();
      const header = tableCells(line);
      const rows: string[][] = [];
      for (i += 2; i < lines.length && lines[i].trim().startsWith('|'); i++) rows.push(tableCells(lines[i]));
      i--;
      html.push(`<table><thead><tr>${header.map(c => `<th>${inline(c, baseUrl)}</th>`).join('')}</tr></thead><tbody>${
        rows.map(row => `<tr>${row.map(c => `<td>${inline(c, baseUrl)}</td>`).join('')}</tr>`).join('')}</tbody></table>`);
    } else if (/^\s*-\s+/.test(line)) {
      if (paragraph.length) { html.push(`<p>${inline(paragraph.join(' '), baseUrl)}</p>`); paragraph = []; }
      list.push(line.replace(/^\s*-\s+/, ''));
    } else if (line.trim() === '') {
      flush();
    } else if (list.length) {
      list[list.length - 1] += ` ${line.trim()}`;
    } else {
      paragraph.push(line.trim());
    }
  }
  flush();
  return { html: html.join('\n'), toc };
}
