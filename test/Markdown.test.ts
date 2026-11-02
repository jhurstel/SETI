import * as fs from 'fs';
import * as path from 'path';
import { renderMarkdown, slugify } from '../src/ui/components/markdown';

describe('renderMarkdown (documentation du jeu)', () => {
  test('titres, sommaire, listes, tableaux, code et liens', () => {
    const { html, toc } = renderMarkdown([
      '# Titre',
      '## 1. Règles appliquées',
      '- **gras** et `code`',
      '- [PDF](docs/regles.pdf)',
      '',
      '| A | B |',
      '|---|---|',
      '| 1 | 2 |',
      '',
      '```',
      'x < y',
      '```',
    ].join('\n'), './');

    expect(toc).toEqual([{ id: '1-regles-appliquees', level: 2, title: '1. Règles appliquées' }]);
    expect(html).toContain('<h2 id="1-regles-appliquees">');
    expect(html).toContain('<li><strong>gras</strong> et <code>code</code></li>');
    expect(html).toContain('<a href="./docs/regles.pdf" target="_blank"');
    expect(html).toContain('<thead><tr><th>A</th><th>B</th></tr></thead><tbody><tr><td>1</td><td>2</td></tr></tbody>');
    expect(html).toContain('<pre><code>x &lt; y</code></pre>');
  });

  test('une ligne {{nom}} devient un emplacement de composant', () => {
    expect(renderMarkdown('Avant\n\n{{glossaire}}\n\nAprès').html).toBe('<p>Avant</p>\n<div data-doc-component="glossaire"></div>\n<p>Après</p>');
  });

  test('le texte est échappé', () => {
    expect(renderMarkdown('<script>alert(1)</script>').html).toBe('<p>&lt;script&gt;alert(1)&lt;/script&gt;</p>');
  });

  test('la documentation du jeu se lit et lie les règles et la FAQ, présentes dans public/docs', () => {
    const docs = path.join(__dirname, '..', 'public', 'docs');
    const { html, toc } = renderMarkdown(fs.readFileSync(path.join(docs, 'documentation.md'), 'utf-8'));
    expect(toc.length).toBeGreaterThan(20);
    expect(new Set(toc.map(t => t.id)).size).toBe(toc.length);
    ['seti-rules-fr.pdf', 'SETI-FAQ-FR.pdf'].forEach(file => {
      expect(html).toContain(`docs/${file}`);
      expect(fs.existsSync(path.join(docs, file))).toBe(true);
    });
    expect(slugify('3.6 Exertiens')).toBe('3-6-exertiens');
  });
});
