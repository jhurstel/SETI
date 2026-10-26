import { SpeciesSystem } from '../src/systems/SpeciesSystem';
import { CardSystem } from '../src/systems/CardSystem';
import { ScoreManager } from '../src/core/ScoreManager';
import { DataLoader } from '../src/core/DataLoader';
import { deserializeGame, serializeGame } from '../src/core/GamePersistence';
import { AlienBoardType, Card, Game, LifeTraceType, RevenueType } from '../src/core/types';
import { createTestGame, getPlayer, mockFetchFromPublic } from './helpers/gameFixture';

const P1 = 'player_0';
let centaurienCards: Card[];

beforeAll(async () => {
  const fetchSpy = mockFetchFromPublic();
  centaurienCards = await DataLoader.loadCards('cards/centauriens.csv');
  fetchSpy.mockRestore();
});

const card = (id: string): Card => structuredClone(centaurienCards.find(c => c.id === id)!);

/** Joue une carte Centaurien (palier à +15 PV), puis amène le joueur sur ce palier */
function playAndReach(game: Game, cardId: string): Game {
  const player = getPlayer(game, P1);
  player.cards.push(card(cardId));
  player.energy = 5;
  const played = CardSystem.playCard(game, P1, cardId).updatedGame;
  const p = getPlayer(played, P1);
  p.score = p.centaurienMilestones[0].score;
  return played;
}

describe('Centauriens', () => {
  let game: Game;

  beforeEach(async () => {
    game = await createTestGame();
  });

  describe("message de l'espèce", () => {
    test('le palier atteint propose les tuiles Message, et reste sur la piste avec la récompense choisie', () => {
      SpeciesSystem.addCentaurienMarker(getPlayer(game, P1));
      const marker = getPlayer(game, P1).centaurienMilestones[0];
      getPlayer(game, P1).score = marker.score;

      const check = ScoreManager.checkScoreMilestones(game, P1);
      expect(check.newInteraction).toEqual({ type: 'CHOOSING_CENTAURIEN_REWARD', markerId: marker.id });

      const species = game.species.find(s => s.name === AlienBoardType.CENTAURIENS)!;
      const index = species.message!.findIndex(t => t.bonus.media);
      const res = SpeciesSystem.claimCentaurienReward(check.updatedGame, P1, index, marker.id);

      const token = res.updatedGame.species.find(s => s.name === AlienBoardType.CENTAURIENS)!.message![index];
      expect(token).toMatchObject({ isAvailable: false, claimedBy: P1 });
      const kept = getPlayer(res.updatedGame, P1).centaurienMilestones;
      expect(kept).toHaveLength(1);
      expect(kept[0].resolved).toMatch(/^Message décodé : /);
      expect(res.historyEntries[0].message).toMatch(/^déchiffre un message Centaurien et choisit « .+ » : gagne /);
    });

    test('une tuile déjà choisie ne peut pas être reprise', () => {
      SpeciesSystem.addCentaurienMarker(getPlayer(game, P1));
      const first = SpeciesSystem.claimCentaurienReward(game, P1, 0);
      const again = SpeciesSystem.claimCentaurienReward(first.updatedGame, P1, 0);
      expect(again.updatedGame).toBe(first.updatedGame);
    });
  });

  describe('réception des cartes', () => {
    test('« augmentez vos revenus » : la carte passe sous le plateau, +1 revenu Média et 1 Média gagné, sans choix de tuile', () => {
      const played = playAndReach(game, 'ET.33');
      const media = getPlayer(played, P1).mediaCoverage;
      const check = ScoreManager.checkScoreMilestones(played, P1);

      const p = getPlayer(check.updatedGame, P1);
      expect(check.newInteraction).toBeUndefined();
      expect(p.reservedCards.map(c => c.id)).toContain('ET.33');
      expect(p.playedCards.some(c => c.id === 'ET.33')).toBe(false);
      expect(p.revenueMedia).toBe(1);
      expect(p.mediaCoverage).toBe(Math.min(media + 1, 10));
      expect(p.centaurienMilestones[0].resolved).toMatch(/^Réception \(« Graphémie »\) : revenu augmenté de /);
      expect(check.historyEntries.some(e => e.message.startsWith('reçoit le message de la carte « Graphémie »'))).toBe(true);
    });

    test('Réception : 1 trace de vie Rouge à placer', () => {
      const check = ScoreManager.checkScoreMilestones(playAndReach(game, 'ET.34'), P1);
      expect(check.newInteraction).toMatchObject({ type: 'PLACING_LIFE_TRACE', color: LifeTraceType.RED });
    });

    test('Musique des Sphères : 1 Crédit et 1 trace de vie de n\'importe quelle couleur', () => {
      const played = playAndReach(game, 'ET.37');
      const credits = getPlayer(played, P1).credits;
      const check = ScoreManager.checkScoreMilestones(played, P1);
      expect(getPlayer(check.updatedGame, P1).credits).toBe(credits + 1);
      expect(check.newInteraction).toMatchObject({ type: 'PLACING_LIFE_TRACE', color: LifeTraceType.ANY });
    });
  });

  test('les revenus Média et Donnée sont versés en fin de manche', async () => {
    const card33 = card('ET.33');
    expect(card33.revenue).toBe(RevenueType.MEDIA);
    getPlayer(game, P1).cards.push(card33);
    const reserved = CardSystem.reserveCard(game, P1, 'ET.33');
    expect(getPlayer(reserved, P1).revenueMedia).toBe(1);
  });

  test('anciennes sauvegardes : les paliers numériques deviennent des marqueurs', () => {
    const p = getPlayer(game, P1) as unknown as { centaurienMilestones: unknown[] };
    p.centaurienMilestones = [42];
    const restored = deserializeGame(JSON.stringify(serializeGame(game, []))).game;
    expect(getPlayer(restored, P1).centaurienMilestones).toEqual([{ id: `centaurien-${P1}-0`, score: 42 }]);
  });
});
