// Réglage SPSA des poids d'AIEvaluator par parties entre robots Experts (voir tools/spsa/README.md).
// Usage : npm run tune:ai -- tune <itérations>
//         npm run tune:ai -- compare <fichierA.json|default> <fichierB.json|default> <graines>
const { fork, execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

// Le moteur est compilé par esbuild dans build/ (npm run tune:ai le fait) ; les résultats vont dans out/
const BUILD = path.join(__dirname, 'build');
const DIR = path.join(__dirname, 'out');
fs.mkdirSync(DIR, { recursive: true });
const DEFAULTS = JSON.parse(execFileSync(process.execPath, [path.join(BUILD, 'defaults.js')], { encoding: 'utf8' }));
const STATE_FILE = path.join(DIR, 'state.json');
const LOG_FILE = path.join(DIR, 'spsa.log');

// Paramètres réglés (endGameLastRound reste à 1 : l'Expert compte tout le décompte pendant la dernière manche)
const FIXED = new Set(['endGameLastRound']);
const KEYS = Object.keys(DEFAULTS).filter(k => !FIXED.has(k));
const BOUNDS = {
  endGameBefore: [0.01, 1], lastRoundFactor: [0.01, 1], exertienStepChance: [0.01, 1], dangerMarginDecay: [0.01, 1],
  maxUsefulCards: [2, 12], minPointsPerRound: [3, 40],
};
const clamp = (k, v) => Math.min((BOUNDS[k] || [0.01, 50])[1], Math.max((BOUNDS[k] || [0.01, 50])[0], v));
const toWeights = x => {
  const w = { ...DEFAULTS };
  KEYS.forEach(k => { w[k] = +clamp(k, Math.exp(x[k])).toFixed(4); });
  return w;
};

const log = msg => { const line = `[${new Date().toISOString().slice(11, 19)}] ${msg}`; console.log(line); fs.appendFileSync(LOG_FILE, line + '\n'); };

// --- Pool de workers ---
const WORKERS = Math.max(1, os.cpus().length - 1);
function runGames(jobs) {
  return new Promise((resolve, reject) => {
    const results = new Array(jobs.length);
    let next = 0, done = 0;
    const pool = Array.from({ length: Math.min(WORKERS, jobs.length) }, () => fork(path.join(BUILD, 'worker.js')));
    const feed = w => {
      if (next >= jobs.length) { w.kill(); return; }
      const id = next++;
      w.send({ id, seed: jobs[id].seed, weights: jobs[id].weights });
    };
    pool.forEach(w => {
      w.on('message', m => {
        if (m.error) { pool.forEach(p => p.kill()); reject(new Error(`partie ${m.id} : ${m.error}`)); return; }
        results[m.id] = m.scores;
        if (++done === jobs.length) resolve(results);
        feed(w);
      });
      feed(w);
    });
  });
}

/**
 * Parties A contre B en miroir (mêmes graines, sièges échangés), à 2 et 3 joueurs.
 * Renvoie, par partie, l'écart moyen de score (sièges A − sièges B) et le vainqueur.
 */
const ARRANGEMENTS = { 2: [['A', 'B'], ['B', 'A']], 3: [['A', 'B', 'B'], ['B', 'A', 'B'], ['B', 'B', 'A'], ['B', 'A', 'A'], ['A', 'B', 'A'], ['A', 'A', 'B']] };
async function match(wA, wB, seeds2, seeds3) {
  const jobs = [];
  for (const [players, seeds] of [[2, seeds2], [3, seeds3]]) {
    for (const seed of seeds) {
      for (const seats of ARRANGEMENTS[players]) jobs.push({ seed, seats, weights: seats.map(s => (s === 'A' ? wA : wB)) });
    }
  }
  const results = await runGames(jobs);
  return results.map((scores, i) => {
    const seats = jobs[i].seats;
    const mean = side => { const v = scores.filter((_, j) => seats[j] === side); return v.reduce((a, b) => a + b, 0) / v.length; };
    const best = Math.max(...scores);
    const winners = new Set(seats.filter((_, j) => scores[j] === best));
    return { diff: mean('A') - mean('B'), win: winners.size === 1 ? [...winners][0] : 'tie' };
  });
}

const summary = games => {
  const diffs = games.map(g => g.diff);
  const mean = diffs.reduce((a, b) => a + b, 0) / diffs.length;
  const sd = Math.sqrt(diffs.reduce((a, b) => a + (b - mean) ** 2, 0) / (diffs.length - 1));
  return { mean, se: sd / Math.sqrt(diffs.length), winsA: games.filter(g => g.win === 'A').length, winsB: games.filter(g => g.win === 'B').length, n: games.length };
};

// --- SPSA ---
async function tune(iterations) {
  const state = fs.existsSync(STATE_FILE)
    ? JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'))
    : { k: 0, x: Object.fromEntries(KEYS.map(k => [k, Math.log(DEFAULTS[k])])), history: [], seedBase: 1000 };
  const a = 0.02, c = 0.15, A = 10;
  for (; state.k < iterations; state.k++) {
    const k = state.k;
    const ak = a / Math.pow(k + 1 + A, 0.602);
    const ck = c / Math.pow(k + 1, 0.101);
    const delta = Object.fromEntries(KEYS.map(key => [key, Math.random() < 0.5 ? -1 : 1]));
    const plus = Object.fromEntries(KEYS.map(key => [key, state.x[key] + ck * delta[key]]));
    const minus = Object.fromEntries(KEYS.map(key => [key, state.x[key] - ck * delta[key]]));
    // 12 graines à 2 joueurs (24 parties) et 4 graines à 3 joueurs (24 parties)
    const base = state.seedBase + k * 100;
    const seeds2 = Array.from({ length: 12 }, (_, i) => base + i);
    const seeds3 = Array.from({ length: 4 }, (_, i) => base + 50 + i);
    const t0 = Date.now();
    const s = summary(await match(toWeights(plus), toWeights(minus), seeds2, seeds3));
    // Montée de gradient sur l'écart de score (θ+ − θ−), estimé par SPSA
    KEYS.forEach(key => {
      const g = (s.mean / (2 * ck)) * delta[key];
      state.x[key] = Math.log(clamp(key, Math.exp(state.x[key] + ak * g)));
    });
    state.history.push({ k, diff: +s.mean.toFixed(2), se: +s.se.toFixed(2), x: { ...state.x } });
    fs.writeFileSync(STATE_FILE, JSON.stringify(state));
    log(`itération ${k + 1}/${iterations} : écart θ+−θ− ${s.mean.toFixed(2)} ± ${s.se.toFixed(2)} (${s.n} parties, ${((Date.now() - t0) / 1000).toFixed(0)} s)`);
  }
  // Moyenne de Polyak sur la dernière moitié des itérations
  const tail = state.history.slice(Math.floor(state.history.length / 2));
  const avg = Object.fromEntries(KEYS.map(key => [key, tail.reduce((sum, h) => sum + h.x[key], 0) / tail.length]));
  const weights = toWeights(avg);
  fs.writeFileSync(path.join(DIR, 'tuned.json'), JSON.stringify(weights, null, 2));
  log(`poids réglés : ${JSON.stringify(weights)}`);
}

async function compare(fileA, fileB, nSeeds) {
  const load = f => (f === 'default' ? DEFAULTS : JSON.parse(fs.readFileSync(path.join(DIR, f), 'utf8')));
  // Graines jamais utilisées pendant le réglage
  const seeds2 = Array.from({ length: nSeeds }, (_, i) => 900000 + i);
  const seeds3 = Array.from({ length: Math.ceil(nSeeds / 3) }, (_, i) => 950000 + i);
  const t0 = Date.now();
  const games = await match(load(fileA), load(fileB), seeds2, seeds3);
  const half = nSeeds * 2;
  const report = (name, g) => { const s = summary(g); log(`${name} : ${fileA} − ${fileB} = ${s.mean.toFixed(2)} ± ${s.se.toFixed(2)} PV, victoires ${s.winsA} / ${s.winsB} (${s.n} parties)`); };
  report('2 joueurs', games.slice(0, half));
  report('3 joueurs', games.slice(half));
  report('total', games);
  log(`durée ${((Date.now() - t0) / 60000).toFixed(1)} min`);
}

const [mode, ...args] = process.argv.slice(2);
(mode === 'tune' ? tune(Number(args[0] || 60)) : compare(args[0], args[1], Number(args[2] || 50)))
  .catch(error => { log(`ERREUR ${error.stack || error}`); process.exit(1); });
