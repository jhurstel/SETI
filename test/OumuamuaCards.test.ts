import { DataLoader } from '../src/core/DataLoader';
import { CardSystem } from '../src/systems/CardSystem';
import { ScanSystem } from '../src/systems/ScanSystem';
import { ProbeSystem } from '../src/systems/ProbeSystem';
import { SpeciesSystem } from '../src/systems/SpeciesSystem';
import { InteractionChoices } from '../src/engine/InteractionChoices';
import { AIController } from '../src/ai/AIController';
import { GameSession } from '../src/session/GameSession';
import { AlienBoardType, Card, Game, InteractionState, Probe, ProbeState, SectorType } from '../src/core/types';
import { createTestGame, getPlayer, mockFetchFromPublic } from './helpers/gameFixture';

/**
 * Cartes Oumuamua qui défaussent des tokens (ET.24, ET.25, ET.28) ou qui rapportent un gain
 * pour les signaux marqués sur Oumuamua pendant leur action (ET.21, ET.22).
 */

const P1 = 'player_0';
type TokenDiscard = Extract<InteractionState, { type: 'DISCARDING_TOKEN' }>;

let cards: Card[];
beforeAll(async () => {
  const fetchSpy = mockFetchFromPublic();
  cards = await DataLoader.loadCards('cards/oumuamua.csv');
  fetchSpy.mockRestore();
});

let logSpy: jest.SpyInstance;
beforeEach(() => { logSpy = jest.spyOn(console, 'log').mockImplementation(() => {}); });
afterEach(() => logSpy.mockRestore());

/** Partie où Oumuamua est découvert et où P1 a la carte en main, des ressources et `tokens` tokens */
async function gameWithCard(cardId: string, tokens: number): Promise<Game> {
  const game = await createTestGame(['A', 'B']);
  game.currentPlayerIndex = 0;
  game.board.alienBoards[0].speciesId = AlienBoardType.OUMUAMUA;
  SpeciesSystem['discoverSpecies'](game, 0);
  Object.assign(getPlayer(game, P1), { credits: 10, energy: 10, tokens });
  getPlayer(game, P1).cards.push(structuredClone(cards.find(c => c.id === cardId)!));
  return game;
}

const tokenDiscard = (interactions: InteractionState[]) => interactions.find((i): i is TokenDiscard => i.type === 'DISCARDING_TOKEN');

describe('Cartes Oumuamua : défausse de tokens', () => {
  test('les effets sont lus comme des effets de la carte, pas comme des cercles de mission', () => {
    const effectTypes = (id: string) => cards.find(c => c.id === id)!.passiveEffects.map(e => e.type);
    expect(effectTypes('ET.24')).toContain('DISCARD_TOKEN_FOR');
    expect(effectTypes('ET.28')).toContain('DISCARD_TOKEN_FOR');
    expect(effectTypes('ET.25')).toContain('DISCARD_TOKENS_THEN_LAND');
    expect(effectTypes('ET.21')).toContain('OUMUAMUA_SIGNAL_BONUS');
    expect(effectTypes('ET.22')).toContain('OUMUAMUA_SIGNAL_BONUS');
    for (const id of ['ET.21', 'ET.22', 'ET.24', 'ET.25', 'ET.28']) {
      expect(cards.find(c => c.id === id)!.permanentEffects.every(e => e.type.startsWith('GAIN_IF_'))).toBe(true);
    }
  });

  test('ET.28 : défausser 1 token pour 1 Donnée, une seule fois ; renoncer ne change rien', async () => {
    const game = await gameWithCard('ET.28', 2);
    const played = CardSystem.playCard(game, P1, 'ET.28');
    const interaction = tokenDiscard(played.newPendingInteractions)!;
    expect(interaction).toEqual(expect.objectContaining({ reward: { data: 1 }, cardName: 'Echantillons d\'Exofossiles' }));
    expect(interaction.repeat).toBeUndefined();

    const before = structuredClone(played.updatedGame);
    const data = getPlayer(played.updatedGame, P1).data;
    const accepted = InteractionChoices.discardToken(played.updatedGame, P1, interaction, true);
    expect(getPlayer(accepted.updatedGame, P1).tokens).toBe(1);
    expect(getPlayer(accepted.updatedGame, P1).data).toBe(data + 1);
    expect(accepted.nextInteraction).toBeUndefined();
    expect(accepted.historyEntries[0].message).toBe('défausse 1 Token pour gagner 1 Donnée ("Echantillons d\'Exofossiles")');
    expect(played.updatedGame).toEqual(before);

    const refusedChoice = InteractionChoices.discardToken(played.updatedGame, P1, interaction, false);
    expect(getPlayer(refusedChoice.updatedGame, P1).tokens).toBe(2);
    expect(refusedChoice.newPendingInteractions).toEqual([]);
  });

  test('sans token, la défausse n\'est pas proposée, et elle est refusée', async () => {
    const game = await gameWithCard('ET.28', 0);
    const played = CardSystem.playCard(game, P1, 'ET.28');
    expect(tokenDiscard(played.newPendingInteractions)).toBeUndefined();
    const interaction: TokenDiscard = { type: 'DISCARDING_TOKEN', reward: { data: 1 }, rewardText: '1 Donnée', cardId: 'ET.28', cardName: 'X' };
    expect(InteractionChoices.discardToken(game, P1, interaction, true).error).toBe('Aucun token à défausser');
  });

  test('ET.24 : le token défaussé donne un signal dans n\'importe quel secteur', async () => {
    const game = await gameWithCard('ET.24', 1);
    const interaction = tokenDiscard(CardSystem.playCard(game, P1, 'ET.24').newPendingInteractions)!;
    const res = InteractionChoices.discardToken(game, P1, interaction, true);
    expect(res.newPendingInteractions).toContainEqual(expect.objectContaining({ type: 'SELECTING_SCAN_SECTOR', color: SectorType.ANY }));
  });

  test('ET.25 : 2 déplacements par token, autant de fois que voulu, puis 1 atterrissage', async () => {
    const game = await gameWithCard('ET.25', 2);
    const played = CardSystem.playCard(game, P1, 'ET.25');
    const interaction = tokenDiscard(played.newPendingInteractions)!;
    expect(interaction).toEqual(expect.objectContaining({ reward: { movements: 2 }, repeat: true, then: { landing: 1 } }));
    expect(played.newPendingInteractions.some(i => i.type === 'LANDING_PROBE')).toBe(false);

    // 1er token : 2 déplacements, la question revient
    const first = InteractionChoices.discardToken(played.updatedGame, P1, interaction, true);
    expect(first.newPendingInteractions).toEqual([expect.objectContaining({ type: 'MOVING_PROBE', count: 2 })]);
    expect(first.nextInteraction).toEqual(interaction);
    // 2e token : plus de token, l'atterrissage suit
    const second = InteractionChoices.discardToken(first.updatedGame, P1, interaction, true);
    expect(getPlayer(second.updatedGame, P1).tokens).toBe(0);
    expect(second.nextInteraction).toBeUndefined();
    expect(second.newPendingInteractions.map(i => i.type)).toEqual(['MOVING_PROBE', 'LANDING_PROBE']);
    expect(second.newPendingInteractions[1]).toEqual(expect.objectContaining({ source: 'ET.25' }));

    // Arrêter : l'atterrissage tout de suite
    const stop = InteractionChoices.discardToken(first.updatedGame, P1, interaction, false);
    expect(stop.newPendingInteractions).toEqual([expect.objectContaining({ type: 'LANDING_PROBE', count: 1 })]);
    expect(getPlayer(stop.updatedGame, P1).tokens).toBe(1);
  });

  test('ET.25 sans token : seulement l\'atterrissage', async () => {
    const game = await gameWithCard('ET.25', 0);
    const played = CardSystem.playCard(game, P1, 'ET.25');
    expect(tokenDiscard(played.newPendingInteractions)).toBeUndefined();
    expect(played.newPendingInteractions).toContainEqual(expect.objectContaining({ type: 'LANDING_PROBE', count: 1 }));
  });

  test('session : le joueur humain défausse ses tokens, puis renonce', async () => {
    const game = await gameWithCard('ET.25', 2);
    game.players.forEach(p => (p.type = 'human'));
    const played = GameSession.dispatch(game, P1, { type: 'PLAY_CARD', cardId: 'ET.25' });
    expect(played.error).toBeUndefined();
    expect(played.game.interaction).toEqual(expect.objectContaining({ type: 'DISCARDING_TOKEN' }));
    expect(GameSession.dispatch(played.game, P1, { type: 'CHOOSE', choice: { kind: 'CARD', cardId: 'x' } }).error).toBeDefined();

    const discarded = GameSession.dispatch(played.game, P1, { type: 'CHOOSE', choice: { kind: 'ACCEPT', accepted: true } });
    expect(discarded.error).toBeUndefined();
    expect(getPlayer(discarded.game, P1).tokens).toBe(1);
    // Les déplacements d'abord, puis la même question
    expect(discarded.game.interaction).toEqual(expect.objectContaining({ type: 'MOVING_PROBE', count: 2 }));
    expect(discarded.game.pendingInteractions![0]).toEqual(expect.objectContaining({ type: 'DISCARDING_TOKEN' }));
  });

  test('robot : la défausse est simulée et résolue sans erreur', async () => {
    for (const id of ['ET.24', 'ET.25', 'ET.28']) {
      const game = await gameWithCard(id, 2);
      game.players.forEach(p => (p.type = 'robot'));
      const played = CardSystem.playCard(game, P1, id);
      const res = AIController.processInteractionQueue(played.updatedGame, played.newPendingInteractions, 'seq', getPlayer(played.updatedGame, P1));
      expect(res.newPendingInteractions.some(i => i.type === 'DISCARDING_TOKEN')).toBe(false);
      expect(getPlayer(res.updatedGame, P1).tokens).toBeLessThanOrEqual(2);
    }
  });
});

describe('Cartes Oumuamua : signaux marqués sur Oumuamua', () => {
  test('ET.21 : 2 PV pour chaque signal sur Oumuamua pendant l\'action de la carte, pas ensuite', async () => {
    const game = await gameWithCard('ET.21', 0);
    const played = CardSystem.playCard(game, P1, 'ET.21');
    const sequenceId = played.newPendingInteractions[0].sequenceId!;
    const score = (g: Game) => getPlayer(g, P1).score;

    // Même signal hors de l'action de la carte : seulement les gains de l'emplacement
    const plain1 = ScanSystem.performSignalAndCover(played.updatedGame, P1, 'oumuamua', [], false, 'autre');
    const plain2 = ScanSystem.performSignalAndCover(plain1.updatedGame, P1, 'oumuamua', [], false, 'autre');
    const first = ScanSystem.performSignalAndCover(played.updatedGame, P1, 'oumuamua', [], false, sequenceId);
    expect(score(first.updatedGame) - score(plain1.updatedGame)).toBe(2);
    expect(first.historyEntries.map(e => e.message)).toContain('gagne 2 PV ("Visiteur Céleste")');
    const second = ScanSystem.performSignalAndCover(first.updatedGame, P1, 'oumuamua', [], false, sequenceId);
    expect(score(second.updatedGame) - score(plain2.updatedGame)).toBe(4);

    // Autre secteur : rien de la carte
    const sector = ScanSystem.performSignalAndCover(played.updatedGame, P1, 'sector_1', [], false, sequenceId);
    expect(sector.historyEntries.map(e => e.message)).not.toContain('gagne 2 PV ("Visiteur Céleste")');
  });

  test('ET.22 : 1 token pour le premier signal sur Oumuamua seulement', async () => {
    const game = await gameWithCard('ET.22', 0);
    const played = CardSystem.playCard(game, P1, 'ET.22');
    const sequenceId = played.newPendingInteractions[0].sequenceId!;
    const tokens = getPlayer(played.updatedGame, P1).tokens || 0;

    const first = ScanSystem.performSignalAndCover(played.updatedGame, P1, 'oumuamua', [], false, sequenceId);
    // + 1 token de la carte (les autres gains du signal sur Oumuamua sont communs à toutes les cartes)
    const plain = ScanSystem.performSignalAndCover(played.updatedGame, P1, 'oumuamua', [], false, 'autre');
    expect((getPlayer(first.updatedGame, P1).tokens || 0) - (getPlayer(plain.updatedGame, P1).tokens || 0)).toBe(1);
    expect(getPlayer(first.updatedGame, P1).activeBuffs.some(b => b.type === 'OUMUAMUA_SIGNAL_BONUS')).toBe(false);
    expect(getPlayer(played.updatedGame, P1).tokens || 0).toBe(tokens);
  });
});

describe('Cartes Oumuamua : visite', () => {
  test('ET.27 : visiter Oumuamua ce tour-ci donne 1 Token, une seule fois (bonus du tour, pas un cercle de mission)', async () => {
    const game = await gameWithCard('ET.27', 0);
    const solarSystem = game.board.solarSystem;
    solarSystem.rotationAngleLevel1 = 0;
    solarSystem.rotationAngleLevel2 = 0;
    solarSystem.rotationAngleLevel3 = 0;
    const played = CardSystem.playCard(game, P1, 'ET.27').updatedGame;
    // Sonde sur la case voisine d'Oumuamua (C3, anneau 1)
    const probe: Probe = { id: 'p', ownerId: P1, position: { x: 0, y: 0 }, solarPosition: { disk: 'C', sector: 2, level: 1 }, state: ProbeState.IN_SOLAR_SYSTEM, isOrbiter: false, isLander: false };
    getPlayer(played, P1).probes = [probe];
    played.board.solarSystem.probes = [structuredClone(probe)];

    const tokens = getPlayer(played, P1).tokens || 0;

    const moved = ProbeSystem.moveProbe(played, P1, 'p', 'C', 3, 1, 'seq');
    expect(getPlayer(moved.updatedGame, P1).tokens).toBe(tokens + 1);
    expect(moved.historyEntries.map(e => e.message).join()).toContain('1 Token ("Synchronisation Parfaite")');
    expect(getPlayer(moved.updatedGame, P1).missions.find(m => m.cardId === 'ET.27')!.fulfillableRequirementIds).toEqual([]);

    // Revenir sur Oumuamua le même tour ne redonne rien
    const away = ProbeSystem.moveProbe(moved.updatedGame, P1, 'p', 'C', 2, 1, 'seq');
    const back = ProbeSystem.moveProbe(away.updatedGame, P1, 'p', 'C', 3, 1, 'seq');
    expect(getPlayer(back.updatedGame, P1).tokens).toBe(tokens + 1);
  });
});
