import * as fs from 'fs';
import * as path from 'path';
import { GameFactory } from '../../src/core/GameFactory';
import { Game, GamePhase, Player, Card, CardType, CostType, FreeActionType, RevenueType, SectorType } from '../../src/core/types';

const PUBLIC_DIR = path.resolve(__dirname, '../../public');

/**
 * Remplace `fetch` pour servir les fichiers de `public/` comme le ferait Vite.
 * On renvoie une vraie `Response` afin de reproduire le décodage UTF-8 du navigateur (BOM inclus).
 */
export function mockFetchFromPublic(): jest.SpyInstance {
  return jest.spyOn(global, 'fetch').mockImplementation(async (input: string | URL | Request) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    const filePath = path.join(PUBLIC_DIR, url);
    if (!fs.existsSync(filePath)) {
      return new Response('', { status: 404, statusText: 'Not Found' });
    }
    return new Response(fs.readFileSync(filePath));
  });
}

/** Graine des parties de test (core/random.ts) */
export const TEST_SEED = 20261030;

/**
 * Crée une vraie partie (cartes chargées depuis public/cards) prête à jouer :
 * phase PLAYING, mains distribuées, rangée remplie.
 * Graine fixe par défaut : la même partie à chaque exécution des tests.
 */
export async function createTestGame(playerNames: string[] = ['Alice', 'Bob'], seed: number = TEST_SEED): Promise<Game> {
  const fetchSpy = mockFetchFromPublic();
  try {
    const game = await GameFactory.createGame(playerNames, true, seed);
    const initialized = GameFactory.initializeGame(game);
    initialized.phase = GamePhase.PLAYING;
    return initialized;
  } finally {
    fetchSpy.mockRestore();
  }
}

/**
 * Carte minimale pour les tests unitaires.
 */
export function makeCard(id: string, overrides: Partial<Card> = {}): Card {
  return {
    id,
    name: `Carte ${id}`,
    description: '',
    type: CardType.ACTION,
    cost: 1,
    costType: CostType.CREDIT,
    freeAction: FreeActionType.MEDIA,
    scanSector: SectorType.BLUE,
    revenue: RevenueType.CREDIT,
    ownerId: '',
    immediateEffects: [],
    passiveEffects: [],
    permanentEffects: [],
    isRevealed: false,
    ...overrides,
  };
}

export function getPlayer(game: Game, playerId: string): Player {
  const player = game.players.find(p => p.id === playerId);
  if (!player) throw new Error(`Joueur ${playerId} introuvable`);
  return player;
}

/**
 * Met une vraie carte (chargée depuis les CSV) dans la main d'un joueur, où qu'elle soit
 * (pioche, rangée, défausse, paquets de fin de manche, mains et réserves).
 */
export function giveCard(game: Game, playerId: string, cardId: string): Card {
  const pools: Card[][] = [
    game.decks.cards, game.decks.cardRow, game.decks.discardPile || [],
    ...Object.values(game.decks.roundDecks || {}),
    ...game.players.flatMap(p => [p.cards, p.reservedCards]),
  ];
  let card: Card | undefined;
  for (const pool of pools) {
    const index = pool.findIndex(c => c.id === cardId);
    if (index !== -1) card = pool.splice(index, 1)[0];
  }
  if (!card) throw new Error(`Carte ${cardId} introuvable`);
  getPlayer(game, playerId).cards.push(card);
  return card;
}
