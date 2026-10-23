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

/**
 * Crée une vraie partie (cartes chargées depuis public/cards) prête à jouer :
 * phase PLAYING, mains distribuées, rangée remplie.
 */
export async function createTestGame(playerNames: string[] = ['Alice', 'Bob']): Promise<Game> {
  const fetchSpy = mockFetchFromPublic();
  try {
    const game = await GameFactory.createGame(playerNames);
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
