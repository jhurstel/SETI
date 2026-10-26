import * as fs from 'fs';
import * as path from 'path';
import { DataLoader } from '../src/core/DataLoader';
import { CardSystem } from '../src/systems/CardSystem';
import { ProbeSystem } from '../src/systems/ProbeSystem';
import { AIController } from '../src/ai/AIController';
import { InteractionResolver } from '../src/core/InteractionResolver';
import { AlienBoardType, Card, CardType, Game, LifeTraceLocation, LifeTraceType, ProbeState } from '../src/core/types';
import { createTestGame, getPlayer, mockFetchFromPublic } from './helpers/gameFixture';

/**
 * Catalogue des cartes : chaque carte des CSV est lue, ses effets sont traités par le moteur,
 * et elle peut être jouée par un robot sans erreur. Puis tests ciblés des cartes corrigées.
 */

const ROOT = path.resolve(__dirname, '..');
const CSVS = ['main', 'mascamites', 'anomalies', 'oumuamua', 'centauriens', 'exertiens'];
const P1 = 'player_0';

/** Interactions créées uniquement par l'interface du joueur humain (jamais par le moteur pour un robot) */
const UI_ONLY_INTERACTIONS = ['IDLE', 'ANALYZING', 'DISCARDING_CARD', 'TRADING_CARD', 'SELECTING_MISSION'];

let allCards: Card[];

beforeAll(async () => {
  const fetchSpy = mockFetchFromPublic();
  allCards = [];
  for (const name of CSVS) allCards.push(...await DataLoader.loadCards(`cards/${name}.csv`));
  fetchSpy.mockRestore();
});

const card = (id: string): Card => structuredClone(allCards.find(c => c.id === id)!);

function sourceFiles(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap(e => e.isDirectory() ? sourceFiles(path.join(dir, e.name)) : [path.join(dir, e.name)]);
}

/** Partie où P1 est un robot riche, avec la carte en main */
async function gameWithCard(cardId: string): Promise<Game> {
  const game = await createTestGame(['A', 'B']);
  game.players.forEach(p => (p.type = 'robot'));
  Object.assign(getPlayer(game, P1), { credits: 20, energy: 20, mediaCoverage: 5, data: 3, tokens: 4 });
  getPlayer(game, P1).cards.push(card(cardId));
  return game;
}

describe('Catalogue des cartes', () => {
  test('chaque élément des colonnes Gain et Contrainte est lu, et chaque effet est traité par le moteur', () => {
    const loader = DataLoader as unknown as Record<string, (s: string) => unknown>;
    const engineSrc = sourceFiles(path.join(ROOT, 'src'))
      .filter(f => /\.(ts|tsx)$/.test(f) && !f.endsWith('DataLoader.ts') && !f.endsWith('types.ts'))
      .map(f => fs.readFileSync(f, 'utf-8')).join('\n');
    const problems: string[] = [];

    for (const name of CSVS) {
      const lines = fs.readFileSync(path.join(ROOT, 'public/cards', `${name}.csv`), 'utf-8').replace(/^\uFEFF/, '').split(/\r?\n/).slice(1).filter(l => l.trim());
      for (const line of lines) {
        const [id, , , , , , , , gain = '', contrainte = ''] = line.split(';');
        if (!gain.trim() && !contrainte.trim()) problems.push(`${id} : aucun effet codé`);
        gain.split('+').map(p => p.trim()).filter(Boolean).forEach(part => {
          if ((loader.parseImmediateEffects.call(DataLoader, part) as unknown[]).length === 0) problems.push(`${id} : gain non lu « ${part} »`);
        });
        contrainte.split('+').map(p => p.trim()).filter(Boolean).forEach(token => {
          const effects = [
            ...(loader.parsePassiveEffects.call(DataLoader, token) as { type: string }[]),
            ...(loader.parsePermanentEffects.call(DataLoader, token) as { type: string }[]),
          ];
          if (effects.length === 0 && loader.parseDanger.call(DataLoader, token) === undefined) problems.push(`${id} : contrainte non lue « ${token} »`);
          effects
            .filter(e => !e.type.startsWith('GAIN_ON_') && e.type !== 'END_CONDITION')
            .filter(e => !engineSrc.includes(`'${e.type}'`))
            .forEach(e => problems.push(`${id} : effet non traité ${e.type}`));
        });
      }
    }
    expect(problems).toEqual([]);
  });

  test("chaque carte (hors Exertiens) se joue et ses interactions sont résolues par un robot, sans erreur", async () => {
    const logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    const base = await createTestGame(['A', 'B']);
    base.players.forEach(p => (p.type = 'robot'));
    base.board.alienBoards.forEach(b => (b.isDiscovered = true));
    const failures: string[] = [];

    for (const c of allCards.filter(c => c.type !== CardType.EXERTIEN)) {
      const game = structuredClone(base);
      Object.assign(getPlayer(game, P1), { credits: 20, energy: 20, mediaCoverage: 8, data: 3, tokens: 4 });
      getPlayer(game, P1).cards.push(structuredClone(c));
      try {
        const played = CardSystem.playCard(game, P1, c.id);
        const resolved = AIController.processInteractionQueue(played.updatedGame, played.newPendingInteractions, 'seq', getPlayer(played.updatedGame, P1));
        resolved.historyEntries.filter(e => e.message.startsWith('AI ne peut pas gérer')).forEach(e => failures.push(`${c.id} : ${e.message}`));
      } catch (error) {
        failures.push(`${c.id} : ${error}`);
      }
    }
    logSpy.mockRestore();
    expect(failures).toEqual([]);
  }, 120000);

  test('les robots savent résoudre toutes les interactions que le moteur peut leur confier', () => {
    const types = fs.readFileSync(path.join(ROOT, 'src/core/types.ts'), 'utf-8');
    const union = types.slice(types.indexOf('export type InteractionState'), types.indexOf('export const getInteractionLabel'));
    const interactionTypes = [...union.matchAll(/\{\s*type:\s*'([A-Z_0-9]+)'/g)].map(m => m[1]);
    const controller = fs.readFileSync(path.join(ROOT, 'src/ai/AIController.ts'), 'utf-8');
    const handled = new Set([...controller.matchAll(/case '([A-Z_0-9]+)'/g)].map(m => m[1]));

    expect(interactionTypes.filter(t => !handled.has(t) && !UI_ONLY_INTERACTIONS.includes(t))).toEqual([]);
  });
});

describe('Cartes corrigées', () => {
  test('100 Supercalculateur Exascale : trace Bleue seulement sur une espèce où le joueur en a déjà une', async () => {
    const game = await gameWithCard('100');
    expect(CardSystem.playCard(structuredClone(game), P1, '100').newPendingInteractions).toEqual([]);

    game.board.alienBoards[1].lifeTraces.push({ id: 't', type: LifeTraceType.BLUE, playerId: P1, location: LifeTraceLocation.TRIANGLE });
    const res = CardSystem.playCard(game, P1, '100');
    expect(res.newPendingInteractions).toEqual([expect.objectContaining({ type: 'PLACING_LIFE_TRACE', color: LifeTraceType.BLUE, boardIndices: [1] })]);

    const resolved = AIController.processInteractionQueue(res.updatedGame, res.newPendingInteractions, 'seq', getPlayer(res.updatedGame, P1));
    expect(resolved.updatedGame.board.alienBoards[1].lifeTraces.filter(t => t.playerId === P1)).toHaveLength(2);
    expect(resolved.updatedGame.board.alienBoards[0].lifeTraces.some(t => t.playerId === P1)).toBe(false);
  });

  test('108 SETI@home : trace Rouge avec au moins 8 Médias', async () => {
    const game = await gameWithCard('108');
    expect(CardSystem.playCard(structuredClone(game), P1, '108').newPendingInteractions).toEqual([]);
    getPlayer(game, P1).mediaCoverage = 8;
    expect(CardSystem.playCard(game, P1, '108').newPendingInteractions).toEqual([expect.objectContaining({ type: 'PLACING_LIFE_TRACE', color: LifeTraceType.RED })]);
  });

  test("ET.16 Saturation de l'Espace Médiatique : les cartes de la rangée vont en main", async () => {
    const game = await gameWithCard('ET.16');
    const row = game.decks.cardRow.map(c => c.id);
    const res = CardSystem.playCard(game, P1, 'ET.16');
    expect(res.updatedGame.decks.cardRow).toEqual([]);
    expect(getPlayer(res.updatedGame, P1).cards.map(c => c.id)).toEqual(expect.arrayContaining(row));
  });

  test('ET.26 Course contre la Montre : gagne 1 Token', async () => {
    const game = await gameWithCard('ET.26');
    const tokens = getPlayer(game, P1).tokens!;
    expect(getPlayer(CardSystem.playCard(game, P1, 'ET.26').updatedGame, P1).tokens).toBe(tokens + 1);
  });

  test("ET.1 Exploration en Rover : l'atterrissage sur une lune de Jupiter propose un spécimen", async () => {
    const game = await gameWithCard('ET.1');
    expect(card('ET.1').passiveEffects.map(e => e.type)).toContain('GAIN_SATELLITE_LANDING_AND_SPECIMEN');
    const played = CardSystem.playCard(game, P1, 'ET.1');
    expect(played.newPendingInteractions).toContainEqual(expect.objectContaining({ type: 'LANDING_PROBE', ignoreSatelliteLimit: true }));
    const moonId = game.board.planets.find(p => p.id === 'jupiter')!.satellites![0].id;
    played.updatedGame.board.planets.find(p => p.id === 'jupiter')!.mascamiteTokens = [{ bonus: { pv: 3 } }];
    expect(ProbeSystem.shouldCollectSpecimen(played.updatedGame, moonId, 'ET.1')).toBe(true);
  });

  describe('missions Oumuamua', () => {
    const claim = (game: Game, cardId: string) => {
      const mission = getPlayer(game, P1).missions.find(m => m.cardId === cardId)!;
      const requirement = mission.requirements.find(r => r.type.startsWith('GAIN_IF_'))!;
      return InteractionResolver.resolve(game, P1, { type: 'CLAIMING_MISSION_REQUIREMENT', missionId: mission.id, requirementId: requirement.id!, sequenceId: 'seq' });
    };

    test("ET.23 jouée avec 3 Tokens : la mission est accomplie aussitôt et les 2 Tokens sont payés", async () => {
      const start = await gameWithCard('ET.23');
      getPlayer(start, P1).tokens = 3;
      const res = CardSystem.playCard(start, P1, 'ET.23');
      expect(getPlayer(res.updatedGame, P1).tokens).toBe(1);
      expect(getPlayer(res.updatedGame, P1).missions.find(m => m.cardId === 'ET.23')!.completed).toBe(true);
    });

    test("ET.23 Découverte d'Exofossiles : avec 3 Tokens, en défausse 2 et gagne 11 PV", async () => {
      const start = await gameWithCard('ET.23');
      getPlayer(start, P1).tokens = 2; // condition non remplie en jouant la carte
      const game = CardSystem.playCard(start, P1, 'ET.23').updatedGame;
      expect(claim(game, 'ET.23').error).toBeDefined();
      getPlayer(game, P1).tokens = 3;
      const score = getPlayer(game, P1).score;
      const res = claim(game, 'ET.23');
      expect(getPlayer(res.updatedGame, P1).tokens).toBe(1);
      expect(getPlayer(res.updatedGame, P1).score).toBe(score + 11);
    });

    test('ET.22 Modification de Trajectoire : 4 PV avec un atterrisseur sur Oumuamua', async () => {
      const game = CardSystem.playCard(await gameWithCard('ET.22'), P1, 'ET.22').updatedGame;
      expect(claim(game, 'ET.22').error).toBeDefined();
      const oumuamua = game.species.find(s => s.name === AlienBoardType.OUMUAMUA)!;
      oumuamua.planet = { ...(oumuamua.planet ?? game.board.planets[0]), landers: [{ id: 'l', ownerId: P1, position: { x: 0, y: 0 }, solarPosition: { disk: 'A', sector: 1, level: 0 }, state: ProbeState.LANDED, isOrbiter: false, isLander: true }] };
      expect(claim(game, 'ET.22').error).toBeUndefined();
    });

    test('ET.30 Rover d\'Excavation : 1 Token avec une trace de chaque couleur pour Oumuamua', async () => {
      const game = CardSystem.playCard(await gameWithCard('ET.30'), P1, 'ET.30').updatedGame;
      const board = game.board.alienBoards[0];
      board.speciesId = AlienBoardType.OUMUAMUA;
      board.lifeTraces = [LifeTraceType.RED, LifeTraceType.YELLOW].map((type, i) => ({ id: `t${i}`, type, playerId: P1, location: LifeTraceLocation.TRIANGLE }));
      expect(claim(game, 'ET.30').error).toBeDefined();
      board.lifeTraces.push({ id: 't2', type: LifeTraceType.BLUE, playerId: P1, location: LifeTraceLocation.TRIANGLE });
      expect(claim(game, 'ET.30').error).toBeUndefined();
    });
  });

  test('robots : défausser des cartes pour leurs signaux (cartes 67 et 114)', async () => {
    const game = await gameWithCard('114');
    const hand = getPlayer(game, P1).cards.length;
    let discarded = 0;
    for (let i = 0; i < 10 && discarded === 0; i++) {
      const res = AIController.processInteractionQueue(game, [{ type: 'DISCARDING_FOR_SIGNAL', count: 2, selectedCards: [] }], 'seq', getPlayer(game, P1));
      discarded = hand - getPlayer(res.updatedGame, P1).cards.length;
      expect(res.historyEntries.some(e => e.message.startsWith('AI ne peut pas gérer'))).toBe(false);
    }
    expect(discarded).toBeGreaterThan(0);
  });
});
