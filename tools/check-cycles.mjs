// Contrôle des cycles d'import du code (npm run check:cycles, lancé par npm run check et la CI).
//
// Graphe des imports relatifs exécutés (les `import type` sont ignorés : ils disparaissent à la compilation).
// Un seul cycle est admis : les systèmes de règles listés ci-dessous, mutuellement récursifs par nature
// (un bonus peut lancer un scan ou une sonde qui rapporte un bonus : ResourceSystem.processBonuses).
// Le contrôle échoue si un autre cycle apparaît, ou si un module rejoint ce groupe : la géométrie,
// le modèle (core/), l'IA, la session et l'interface doivent rester hors de tout cycle.
import { readdirSync, readFileSync, statSync, existsSync } from 'node:fs';
import { dirname, join, normalize, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SOURCES = ['src', 'server'];

/** Systèmes de règles mutuellement récursifs (seul cycle admis) */
const ALLOWED_CYCLE = new Set([
  'src/systems/CardSystem.ts',
  'src/systems/PlayCardEffects.ts',
  'src/systems/ProbeSystem.ts',
  'src/systems/ResourceSystem.ts',
  'src/systems/RotationSystem.ts',
  'src/systems/ScanSystem.ts',
  'src/systems/SpeciesSystem.ts',
  'src/systems/TechnologySystem.ts',
]);

const rel = file => relative(ROOT, file).split(sep).join('/');

function listFiles(dir) {
  const files = [];
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) {
      if (name !== 'build' && name !== 'node_modules') files.push(...listFiles(path));
    } else if (/\.tsx?$/.test(name) && !name.endsWith('.d.ts')) {
      files.push(normalize(path));
    }
  }
  return files;
}

const files = SOURCES.map(dir => join(ROOT, dir)).filter(existsSync).flatMap(listFiles);
const known = new Set(files);

function resolve(from, spec) {
  if (!spec.startsWith('.')) return null;
  const base = normalize(join(dirname(from), spec));
  for (const candidate of [`${base}.ts`, `${base}.tsx`, join(base, 'index.ts')]) {
    if (known.has(candidate)) return candidate;
  }
  return null;
}

// Imports exécutés : `import … from '…'` et `export … from '…'`, sauf `import type` / `export type`
const IMPORT = /^\s*(?:import|export)\s+(type\s+)?[^;]*?\bfrom\s+['"]([^'"]+)['"]/gm;
const graph = new Map();
for (const file of files) {
  const targets = new Set();
  for (const match of readFileSync(file, 'utf-8').matchAll(IMPORT)) {
    if (match[1]) continue;
    const target = resolve(file, match[2]);
    if (target) targets.add(target);
  }
  graph.set(file, targets);
}

// Composantes fortement connexes (Tarjan, itératif)
function stronglyConnected() {
  let counter = 0;
  const index = new Map();
  const low = new Map();
  const stack = [];
  const onStack = new Set();
  const components = [];
  for (const root of graph.keys()) {
    if (index.has(root)) continue;
    const work = [[root, [...graph.get(root)], 0]];
    index.set(root, counter); low.set(root, counter); counter++;
    stack.push(root); onStack.add(root);
    while (work.length > 0) {
      const frame = work[work.length - 1];
      const [node, targets] = frame;
      if (frame[2] < targets.length) {
        const next = targets[frame[2]++];
        if (!index.has(next)) {
          index.set(next, counter); low.set(next, counter); counter++;
          stack.push(next); onStack.add(next);
          work.push([next, [...graph.get(next)], 0]);
        } else if (onStack.has(next)) {
          low.set(node, Math.min(low.get(node), index.get(next)));
        }
        continue;
      }
      work.pop();
      if (work.length > 0) {
        const parent = work[work.length - 1][0];
        low.set(parent, Math.min(low.get(parent), low.get(node)));
      }
      if (low.get(node) === index.get(node)) {
        const component = [];
        let member;
        do {
          member = stack.pop();
          onStack.delete(member);
          component.push(member);
        } while (member !== node);
        const selfLoop = component.length === 1 && graph.get(node).has(node);
        if (component.length > 1 || selfLoop) components.push(component.map(rel).sort());
      }
    }
  }
  return components;
}

const problems = [];
for (const component of stronglyConnected()) {
  const outside = component.filter(file => !ALLOWED_CYCLE.has(file));
  if (outside.length > 0) problems.push(`Cycle d'import non admis :\n  ${component.join('\n  ')}\n  (hors des systèmes de règles : ${outside.join(', ')})`);
}

if (problems.length > 0) {
  console.error(problems.join('\n\n'));
  console.error('\nCasser le cycle (déplacer la fonction partagée dans un module sans dépendance), voir tools/check-cycles.mjs.');
  process.exit(1);
}
console.log(`Cycles d'import : aucun hors des ${ALLOWED_CYCLE.size} systèmes de règles admis (${files.length} fichiers analysés).`);
