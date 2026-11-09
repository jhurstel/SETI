// Taille (JSON) des parties de l'état, pour savoir quoi partager plutôt que copier (outil de mesure, non publié).
import * as fs from 'fs';
import * as path from 'path';
import { GameFactory } from '../../src/engine/GameFactory';
import { Game } from '../../src/core/types';

const PUBLIC_DIR = path.resolve(__dirname, '../../../public');
(globalThis as { fetch: unknown }).fetch = async (url: string) => {
  const file = path.join(PUBLIC_DIR, url);
  return fs.existsSync(file) ? new Response(fs.readFileSync(file)) : new Response('', { status: 404 });
};
const log = console.log.bind(console);
console.log = () => {};

const size = (v: unknown) => JSON.stringify(v ?? null).length;
const count = (v: unknown): number => (v === null || typeof v !== 'object' ? 0 : 1 + Object.values(v as object).reduce((n: number, x) => n + count(x), 0));

function report(label: string, obj: Record<string, unknown>) {
  const rows = Object.entries(obj).map(([k, v]) => [k, size(v), count(v)] as const).sort((a, b) => b[2] - a[2]).slice(0, 8);
  log(`${label} : ${rows.map(([k, s, c]) => `${k} ${(s / 1024).toFixed(1)} Ko / ${c} obj`).join(', ')}`);
}

(async () => {
  const game: Game = GameFactory.initializeGame(await GameFactory.createGame(['A', 'B'], true, 424242));
  const { board, decks, players, species, ...rest } = game;
  report('partie', { board, decks, players, species, rest } as Record<string, unknown>);
  const { technologyBoard: _t, ...boardRest } = board;
  report('plateau (hors technologies)', boardRest as Record<string, unknown>);
  report('système solaire', board.solarSystem as unknown as Record<string, unknown>);
  const { cards: _c, cardRow: _r, ...speciesRest } = species[0];
  report('espèce (hors cartes)', speciesRest as Record<string, unknown>);
  const { cards: _pc, playedCards: _pp, reservedCards: _pr, technologies: _pt, ...playerRest } = players[0];
  report('joueur (hors cartes et technologies)', playerRest as Record<string, unknown>);
  report('alienBoards[0]', board.alienBoards[0] as unknown as Record<string, unknown>);
})();
