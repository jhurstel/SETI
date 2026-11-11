// Réglage SPSA des poids d'AIEvaluator par parties entre robots Experts, un jeu de poids par nombre de joueurs
// (voir tools/spsa/README.md).
// Usage : npm run tune:ai -- tune <joueurs> <itérations>
//         npm run tune:ai -- compare <joueurs> <fichierA.json|default> <fichierB.json|default> <graines>
//         npm run tune:ai -- levels <joueurs> <graines> [A] [B]  (niveaux, par défaut EXPERT contre MEDIUM ; NIVEAU@température, NIVEAU+anticipation, NIVEAU*suites pour en essayer d'autres)
const { fork, execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

// Le moteur est compilé par esbuild dans build/ (npm run tune:ai le fait) ; les résultats vont dans out/
// SPSA_BUILD : autre dossier de compilation (pour mesurer pendant qu'un réglage tourne sur build/)
const BUILD = process.env.SPSA_BUILD ? path.resolve(process.env.SPSA_BUILD) : path.join(__dirname, 'build');
const OUT = path.join(__dirname, 'out');
fs.mkdirSync(OUT, { recursive: true });
const CURRENT = JSON.parse(execFileSync(process.execPath, [path.join(BUILD, 'defaults.js')], { encoding: 'utf8' }));
const currentWeights = players => CURRENT.byCount[players] || CURRENT.base;

// Paramètres réglés (endGameLastRound reste à 1 : l'Expert compte tout le décompte pendant la dernière manche)
// SPSA_KEYS (liste séparée par des virgules ou préfixes terminés par *) : ne régler que ces paramètres, les autres restent fixes
const FIXED = new Set(['endGameLastRound']);
const ONLY = (process.env.SPSA_KEYS || '').split(',').map(s => s.trim()).filter(Boolean);
const selected = k => ONLY.length === 0 || ONLY.some(o => (o.endsWith('*') ? k.startsWith(o.slice(0, -1)) : k === o));
const KEYS = Object.keys(CURRENT.base).filter(k => !FIXED.has(k) && selected(k));
const BOUNDS = {
  lastRoundFactor: [0.01, 1], exertienStepChance: [0.01, 1], dangerMarginDecay: [0.01, 1], lastRoundPassFactor: [0.01, 1],
  endGameRound1: [0.01, 1], endGameRound2: [0.01, 1], endGameRound3: [0.01, 1], endGameRound4: [0.01, 1],
  resourceRound1: [0.05, 5], resourceRound2: [0.05, 5], resourceRound3: [0.05, 5], resourceRound4: [0.05, 5],
  boardRound1: [0.05, 5], boardRound2: [0.05, 5], boardRound3: [0.05, 5], boardRound4: [0.05, 5],
  maxUsefulCards: [2, 12], minPointsPerRound: [3, 40], passCost: [0.01, 10], cardQuality: [0.02, 3], missionChance: [0.02, 1],
};
// SPSA_START='cardQuality=0.3,…' : valeur de départ d'un paramètre (utile pour un poids nul, réglé en logarithme)
const START = Object.fromEntries((process.env.SPSA_START || '').split(',').filter(Boolean).map(s => s.split('=')).map(([k, v]) => [k.trim(), Number(v)]));
// (un poids nul part de sa borne basse : le réglage se fait en logarithme)
const clamp = (k, v) => Math.min((BOUNDS[k] || [0.01, 50])[1], Math.max((BOUNDS[k] || [0.01, 50])[0], v));
const toWeights = (base, x) => {
  const w = { ...base };
  KEYS.forEach(k => { w[k] = +clamp(k, Math.exp(x[k])).toFixed(4); });
  return w;
};

let logFile = path.join(OUT, 'spsa.log');
const log = msg => { const line = `[${new Date().toISOString().slice(0, 19).replace('T', ' ')}] ${msg}`; console.log(line); fs.appendFileSync(logFile, line + '\n'); };

// --- Pool de workers ---
const WORKERS = Math.max(1, Number(process.env.SPSA_WORKERS) || os.cpus().length - 1);
function runGames(jobs) {
  return new Promise((resolve, reject) => {
    const results = new Array(jobs.length);
    let next = 0, done = 0;
    const pool = Array.from({ length: Math.min(WORKERS, jobs.length) }, () => fork(path.join(BUILD, 'worker.js')));
    const feed = w => {
      if (next >= jobs.length) { w.kill(); return; }
      const id = next++;
      w.send({ id, seed: jobs[id].seed, weights: jobs[id].weights, levels: jobs[id].levels, temperatures: jobs[id].temperatures, lookaheads: jobs[id].lookaheads, rollouts: jobs[id].rollouts });
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
 * Répartitions des sièges entre A et B, en miroir : à 2 joueurs, les 2 ordres ; à 3, les 6 répartitions
 * de 1 contre 2 ; à 4, les 6 répartitions de 2 contre 2. Chaque côté occupe autant de fois chaque siège.
 */
const ARRANGEMENTS = {
  2: [['A', 'B'], ['B', 'A']],
  3: [['A', 'B', 'B'], ['B', 'A', 'B'], ['B', 'B', 'A'], ['B', 'A', 'A'], ['A', 'B', 'A'], ['A', 'A', 'B']],
  4: [['A', 'A', 'B', 'B'], ['A', 'B', 'A', 'B'], ['A', 'B', 'B', 'A'], ['B', 'A', 'A', 'B'], ['B', 'A', 'B', 'A'], ['B', 'B', 'A', 'A']],
};

/**
 * Parties A contre B en miroir (mêmes graines, sièges échangés). sideA et sideB : { weights (null = poids du jeu), level }.
 * Renvoie, par partie, l'écart moyen de score (sièges A − sièges B) et le vainqueur.
 */
async function match(players, sideA, sideB, seeds) {
  const jobs = [];
  for (const seed of seeds) {
    for (const seats of ARRANGEMENTS[players]) {
      const side = s => (s === 'A' ? sideA : sideB);
      jobs.push({
        seed, seats, weights: seats.map(s => side(s).weights), levels: seats.map(s => side(s).level || 'EXPERT'),
        temperatures: seats.map(s => side(s).temperature ?? null), lookaheads: seats.map(s => side(s).lookahead ?? null),
        rollouts: seats.map(s => side(s).rollouts ?? null),
      });
    }
  }
  const results = await runGames(jobs);
  return results.map((scores, i) => {
    const seats = jobs[i].seats;
    const mean = side => { const v = scores.filter((_, j) => seats[j] === side); return v.reduce((a, b) => a + b, 0) / v.length; };
    const best = Math.max(...scores);
    const winners = new Set(seats.filter((_, j) => scores[j] === best));
    return { diff: mean('A') - mean('B'), win: winners.size === 1 ? [...winners][0] : 'tie', scoreA: mean('A'), scoreB: mean('B') };
  });
}

const summary = games => {
  const diffs = games.map(g => g.diff);
  const mean = diffs.reduce((a, b) => a + b, 0) / diffs.length;
  const sd = Math.sqrt(diffs.reduce((a, b) => a + (b - mean) ** 2, 0) / (diffs.length - 1));
  const avg = k => games.reduce((s, g) => s + g[k], 0) / games.length;
  return { mean, se: sd / Math.sqrt(diffs.length), winsA: games.filter(g => g.win === 'A').length, winsB: games.filter(g => g.win === 'B').length, n: games.length, scoreA: avg('scoreA'), scoreB: avg('scoreB') };
};

const checkPlayers = players => {
  if (!ARRANGEMENTS[players]) throw new Error(`nombre de joueurs non pris en charge : ${players} (2, 3 ou 4)`);
  return players;
};

// --- SPSA ---
async function tune(players, iterations) {
  // SPSA_TAG : réglage distinct (out/p<joueurs>-<tag>), sans reprendre l'état d'un autre réglage
  const dir = path.join(OUT, `p${players}${process.env.SPSA_TAG ? `-${process.env.SPSA_TAG}` : ''}`);
  fs.mkdirSync(dir, { recursive: true });
  logFile = path.join(dir, 'spsa.log');
  const stateFile = path.join(dir, 'state.json');
  const base = currentWeights(players);
  const state = fs.existsSync(stateFile)
    ? JSON.parse(fs.readFileSync(stateFile, 'utf8'))
    : { k: 0, x: Object.fromEntries(KEYS.map(k => [k, Math.log(clamp(k, START[k] ?? base[k]))])), history: [], seedBase: players * 100000 + 1000 };
  log(`${players} joueurs, paramètres réglés : ${KEYS.join(', ')}`);
  const a = 0.02, c = 0.15, A = 10;
  // 48 parties par itération : 24 graines à 2 joueurs, 8 graines à 3 ou 4 joueurs (6 répartitions)
  const seedsPerIteration = 48 / ARRANGEMENTS[players].length;
  for (; state.k < iterations; state.k++) {
    const k = state.k;
    const ak = a / Math.pow(k + 1 + A, 0.602);
    const ck = c / Math.pow(k + 1, 0.101);
    const delta = Object.fromEntries(KEYS.map(key => [key, Math.random() < 0.5 ? -1 : 1]));
    const plus = Object.fromEntries(KEYS.map(key => [key, state.x[key] + ck * delta[key]]));
    const minus = Object.fromEntries(KEYS.map(key => [key, state.x[key] - ck * delta[key]]));
    const seeds = Array.from({ length: seedsPerIteration }, (_, i) => state.seedBase + k * 100 + i);
    const t0 = Date.now();
    const s = summary(await match(players, { weights: toWeights(base, plus) }, { weights: toWeights(base, minus) }, seeds));
    // Montée de gradient sur l'écart de score (θ+ − θ−), estimé par SPSA
    KEYS.forEach(key => {
      const g = (s.mean / (2 * ck)) * delta[key];
      state.x[key] = Math.log(clamp(key, Math.exp(state.x[key] + ak * g)));
    });
    state.history.push({ k, diff: +s.mean.toFixed(2), se: +s.se.toFixed(2), x: { ...state.x } });
    fs.writeFileSync(stateFile, JSON.stringify(state));
    log(`${players} joueurs, itération ${k + 1}/${iterations} : écart θ+−θ− ${s.mean.toFixed(2)} ± ${s.se.toFixed(2)} (${s.n} parties, ${((Date.now() - t0) / 1000).toFixed(0)} s)`);
  }
  // Moyenne de Polyak sur la dernière moitié des itérations
  const tail = state.history.slice(Math.floor(state.history.length / 2));
  const avg = Object.fromEntries(KEYS.map(key => [key, tail.reduce((sum, h) => sum + h.x[key], 0) / tail.length]));
  const weights = toWeights(base, avg);
  fs.writeFileSync(path.join(dir, 'tuned.json'), JSON.stringify(weights, null, 2));
  log(`${players} joueurs, poids réglés : ${JSON.stringify(weights)}`);
}

/** Graines de validation, jamais utilisées par le réglage : 900000 + 10000 × joueurs */
const validationSeeds = (players, n) => Array.from({ length: n }, (_, i) => 900000 + players * 10000 + i);

const report = (players, nameA, nameB, games, t0) => {
  const s = summary(games);
  log(`${players} joueurs : ${nameA} − ${nameB} = ${s.mean.toFixed(2)} ± ${s.se.toFixed(2)} PV (scores moyens ${s.scoreA.toFixed(1)} / ${s.scoreB.toFixed(1)}), victoires ${s.winsA} / ${s.winsB} (${s.n} parties, ${((Date.now() - t0) / 60000).toFixed(1)} min)`);
};

async function compare(players, fileA, fileB, nSeeds) {
  logFile = path.join(OUT, 'compare.log');
  // Un fichier peut ne donner que quelques poids : les autres sont ceux en place
  const load = f => (f === 'default' ? currentWeights(players) : { ...currentWeights(players), ...JSON.parse(fs.readFileSync(path.join(OUT, f), 'utf8')) });
  const t0 = Date.now();
  const games = await match(players, { weights: load(fileA) }, { weights: load(fileB) }, validationSeeds(players, nSeeds));
  report(players, fileA, fileB, games, t0);
}

// Niveau d'un côté : EASY, MEDIUM ou EXPERT, avec une température (MEDIUM@2.5), une anticipation (EXPERT+0) ou des suites jouées (EXPERT*4) imposées
const parseLevel = spec => {
  const m = /^(EASY|MEDIUM|EXPERT)(?:@([\d.]+))?(?:\+(\d+))?(?:\*(\d+))?$/.exec(spec);
  if (!m) throw new Error(`niveau inconnu : ${spec} (EASY, MEDIUM, EXPERT, NIVEAU@température, NIVEAU+anticipation, NIVEAU*suites)`);
  return { weights: null, level: m[1], temperature: m[2] === undefined ? null : Number(m[2]), lookahead: m[3] === undefined ? null : Number(m[3]), rollouts: m[4] === undefined ? null : Number(m[4]) };
};

async function levels(players, nSeeds, a = 'EXPERT', b = 'MEDIUM') {
  logFile = path.join(OUT, 'levels.log');
  const t0 = Date.now();
  const games = await match(players, parseLevel(a), parseLevel(b), validationSeeds(players, nSeeds));
  report(players, a, b, games, t0);
}

const [mode, ...args] = process.argv.slice(2);
const run = {
  tune: () => tune(checkPlayers(Number(args[0])), Number(args[1] || 60)),
  compare: () => compare(checkPlayers(Number(args[0])), args[1], args[2], Number(args[3] || 50)),
  levels: () => levels(checkPlayers(Number(args[0])), Number(args[1] || 25), args[2], args[3]),
}[mode];
if (!run) { console.error('usage : tune <joueurs> <itérations> | compare <joueurs> <a> <b> <graines> | levels <joueurs> <graines> [A] [B]'); process.exit(1); }
run().catch(error => { log(`ERREUR ${error.stack || error}`); process.exit(1); });
