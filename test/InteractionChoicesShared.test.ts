import { InteractionChoices } from '../src/core/InteractionChoices';
import { CardSystem } from '../src/systems/CardSystem';
import { AIController } from '../src/ai/AIController';
import { DiskName, Game, InteractionState, Probe, ProbeState, SectorNumber } from '../src/core/types';
import { createTestGame, getPlayer } from './helpers/gameFixture';

const P1 = 'player_0';
const P2 = 'player_1';

type Interaction<T extends InteractionState['type']> = Extract<InteractionState, { type: T }>;

const probeAt = (id: string, ownerId: string, disk: DiskName, sector: SectorNumber, level: number, state = ProbeState.IN_SOLAR_SYSTEM): Probe => ({
  id, ownerId, position: { x: 0, y: 0 }, solarPosition: { disk, sector, level }, state, isOrbiter: false, isLander: false,
});

/**
 * Choix des interactions passés par InteractionChoices (joueur humain et robots) :
 * chaque fonction donne le bon résultat et ne modifie jamais la partie reçue.
 */
describe('InteractionChoices : choix communs (cartes, signaux, spécimens, retraits, observations)', () => {
  let game: Game;
  let before: string;

  beforeEach(async () => {
    game = await createTestGame();
    game.currentPlayerIndex = 0;
  });

  const freeze = () => { before = JSON.stringify(game); };
  const unchanged = () => expect(JSON.stringify(game)).toBe(before);

  describe('acquireCard', () => {
    test('carte de la rangée, puis la même interaction pour la suivante', () => {
      const card = game.decks.cardRow[0];
      const handSize = getPlayer(game, P1).cards.length;
      const interaction: Interaction<'ACQUIRING_CARD'> = { type: 'ACQUIRING_CARD', count: 2, isFree: true, sequenceId: 's' };
      freeze();

      const res = InteractionChoices.acquireCard(game, P1, interaction, card.id);

      expect(getPlayer(res.updatedGame, P1).cards).toHaveLength(handSize + 1);
      expect(getPlayer(res.updatedGame, P1).cards.map(c => c.id)).toContain(card.id);
      expect(res.nextInteraction).toEqual({ ...interaction, count: 1 });
      unchanged();
    });

    test('dernière carte : plus d\'interaction ; achat impossible : refusé', () => {
      expect(InteractionChoices.acquireCard(game, P1, { type: 'ACQUIRING_CARD', count: 1, isFree: true }).nextInteraction).toBeUndefined();

      getPlayer(game, P1).mediaCoverage = 0;
      freeze();
      const refused = InteractionChoices.acquireCard(game, P1, { type: 'ACQUIRING_CARD', count: 1 }, game.decks.cardRow[0].id);
      expect(refused.error).toBeDefined();
      expect(refused.updatedGame).toBe(game);
      unchanged();
    });
  });

  test('selectScanCard : carte défaussée de la rangée, secteur de sa couleur à choisir', () => {
    const card = game.decks.cardRow[0];
    freeze();

    const res = InteractionChoices.selectScanCard(game, { type: 'SELECTING_SCAN_CARD', sequenceId: 's' }, card.id);

    expect(res.updatedGame.decks.cardRow.map(c => c.id)).not.toContain(card.id);
    expect(res.updatedGame.decks.discardPile.map(c => c.id)).toContain(card.id);
    expect(res.newPendingInteractions).toEqual([expect.objectContaining({ type: 'SELECTING_SCAN_SECTOR', color: card.scanSector, cardId: card.id, cardProcessed: true, sequenceId: 's' })]);
    expect(InteractionChoices.selectScanCard(game, { type: 'SELECTING_SCAN_CARD' }, 'inconnue').error).toBeDefined();
    unchanged();
  });

  test('reserveCards : réservation, reste à réserver, sélection vide ou trop grande refusée', () => {
    const hand = CardSystem.getHandCards(getPlayer(game, P1));
    const interaction: Interaction<'RESERVING_CARD'> = { type: 'RESERVING_CARD', count: 2, selectedCards: [], sequenceId: 's' };
    freeze();

    const res = InteractionChoices.reserveCards(game, P1, interaction, [hand[0].id]);

    expect(getPlayer(res.updatedGame, P1).reservedCards.map(c => c.id)).toContain(hand[0].id);
    expect(res.nextInteraction).toEqual({ type: 'RESERVING_CARD', count: 1, selectedCards: [], sequenceId: 's' });
    expect(InteractionChoices.reserveCards(game, P1, interaction, []).error).toBeDefined();
    expect(InteractionChoices.reserveCards(game, P1, { ...interaction, count: 1 }, [hand[0].id, hand[1].id]).error).toBeDefined();
    unchanged();
  });

  test('discardForSignals : un signal par carte, pas plus de cartes que demandé', () => {
    const hand = CardSystem.getHandCards(getPlayer(game, P1));
    const interaction: Interaction<'DISCARDING_FOR_SIGNAL'> = { type: 'DISCARDING_FOR_SIGNAL', count: 1, selectedCards: [], sequenceId: 's' };
    freeze();

    const res = InteractionChoices.discardForSignals(game, P1, interaction, [hand[0].id]);

    expect(res.newPendingInteractions).toEqual([{ type: 'SELECTING_SCAN_SECTOR', color: hand[0].scanSector, cardId: hand[0].id, sequenceId: 's' }]);
    expect(InteractionChoices.discardForSignals(game, P1, interaction, [hand[0].id, hand[1].id]).error).toBeDefined();
    unchanged();
  });

  test('chooseMediaOrMove : 1 Média et les déplacements restants, ou 1 déplacement de plus', () => {
    getPlayer(game, P1).mediaCoverage = 2;
    const interaction: Interaction<'CHOOSING_MEDIA_OR_MOVE'> = { type: 'CHOOSING_MEDIA_OR_MOVE', remainingMoves: 1, sequenceId: 's' };
    freeze();

    const media = InteractionChoices.chooseMediaOrMove(game, P1, interaction, 'MEDIA');
    expect(getPlayer(media.updatedGame, P1).mediaCoverage).toBe(3);
    expect(media.nextInteraction).toEqual({ type: 'MOVING_PROBE', count: 1, sequenceId: 's' });

    const move = InteractionChoices.chooseMediaOrMove(game, P1, interaction, 'MOVE');
    expect(move.nextInteraction).toEqual({ type: 'MOVING_PROBE', count: 2, sequenceId: 's' });
    unchanged();
  });

  test('takeSpecimen : planète autorisée seulement ; plus de jeton : rien ne change', () => {
    const jupiter = game.board.planets.find(p => p.id === 'jupiter')!;
    jupiter.mascamiteTokens = [{ bonus: { media: 1 } }];
    const collect: Interaction<'COLLECTING_SPECIMEN'> = { type: 'COLLECTING_SPECIMEN', planetId: 'jupiter', sequenceId: 's' };
    freeze();

    expect(InteractionChoices.specimenPlanets(game, P1, collect)).toEqual(['jupiter']);
    expect(InteractionChoices.takeSpecimen(game, P1, collect, 'saturn', 0).error).toBeDefined();

    const res = InteractionChoices.takeSpecimen(game, P1, collect, 'jupiter', 0);
    expect(res.error).toBeUndefined();
    expect(res.updatedGame.board.planets.find(p => p.id === 'jupiter')!.mascamiteTokens).toHaveLength(0);

    const empty = InteractionChoices.takeSpecimen(res.updatedGame, P1, collect, 'jupiter', 0);
    expect(empty.error).toBeUndefined();
    expect(empty.updatedGame).toBe(res.updatedGame);
    unchanged();
  });

  test('removeProbe : orbiteur du joueur retiré, celui d\'un adversaire refusé', () => {
    const mars = game.board.planets.find(p => p.id === 'mars')!;
    const mine = { ...probeAt('o1', P1, 'B', 1, 2, ProbeState.IN_ORBIT), planetId: 'mars', isOrbiter: true };
    const theirs = { ...probeAt('o2', P2, 'B', 1, 2, ProbeState.IN_ORBIT), planetId: 'mars', isOrbiter: true };
    mars.orbiters = [theirs, mine];
    getPlayer(game, P1).probes = [mine];
    getPlayer(game, P2).probes = [theirs];
    const interaction: Interaction<'REMOVING_ORBITER'> = { type: 'REMOVING_ORBITER', sequenceId: 's' };
    freeze();

    const res = InteractionChoices.removeProbe(game, P1, interaction, 'mars');
    expect(res.error).toBeUndefined();
    expect(res.updatedGame.board.planets.find(p => p.id === 'mars')!.orbiters.map(o => o.id)).toEqual(['o2']);

    expect(InteractionChoices.removeProbe(game, P1, interaction, 'mars', 0).error).toBeDefined();
    expect(InteractionChoices.removeProbe(game, P1, interaction, 'venus').error).toBeDefined();
    unchanged();
  });

  test('playExertienCard : renoncer est toujours possible, une carte absente est refusée', () => {
    const interaction: Interaction<'CHOOSING_EXERTIEN_CARD'> = { type: 'CHOOSING_EXERTIEN_CARD', milestone: 25 };
    freeze();

    expect(InteractionChoices.playExertienCard(game, P1, interaction).error).toBeUndefined();
    expect(InteractionChoices.playExertienCard(game, P1, interaction, 'inconnue').error).toBeDefined();
    unchanged();
  });

  test('observation2 : refusée, rien ne change ; acceptée, 1 Média contre un signal ; sans Média, refusée', () => {
    const interaction: Interaction<'CHOOSING_OBS2_ACTION'> = { type: 'CHOOSING_OBS2_ACTION', sequenceId: 's' };
    getPlayer(game, P1).mediaCoverage = 2;
    freeze();

    expect(InteractionChoices.observation2(game, P1, interaction, false).updatedGame).toBe(game);
    const accepted = InteractionChoices.observation2(game, P1, interaction, true);
    expect(getPlayer(accepted.updatedGame, P1).mediaCoverage).toBe(1);
    unchanged();

    getPlayer(game, P1).mediaCoverage = 0;
    expect(InteractionChoices.observation2(game, P1, interaction, true).error).toBeDefined();
  });

  test('observation4 : déplacement, ou sonde contre 1 Énergie', () => {
    const interaction: Interaction<'CHOOSING_OBS4_ACTION'> = { type: 'CHOOSING_OBS4_ACTION', sequenceId: 's' };
    getPlayer(game, P1).energy = 1;
    freeze();

    expect(InteractionChoices.observation4(game, P1, interaction, 'MOVE').newPendingInteractions).toEqual([{ type: 'MOVING_PROBE', count: 1, sequenceId: 's' }]);
    const probe = InteractionChoices.observation4(game, P1, interaction, 'PROBE');
    expect(getPlayer(probe.updatedGame, P1).energy).toBe(0);
    expect(getPlayer(probe.updatedGame, P1).probes.length).toBe(getPlayer(game, P1).probes.length + 1);
    unchanged();

    getPlayer(game, P1).energy = 0;
    expect(InteractionChoices.observation4(game, P1, interaction, 'PROBE').error).toBeDefined();
  });

  test('robot : les mêmes fonctions résolvent la file (scan sur une carte de la rangée)', () => {
    const rowCard = game.decks.cardRow[0];
    game.decks.cardRow = [rowCard];
    freeze();

    const res = AIController.processInteractionQueue(game, [{ type: 'SELECTING_SCAN_CARD', sequenceId: 's' }], 's', getPlayer(game, P1));

    expect(res.updatedGame.decks.discardPile.map(c => c.id)).toContain(rowCard.id);
    const signals = res.updatedGame.board.sectors.reduce((n, s) => n + s.signals.filter(sig => sig.markedBy === P1).length, 0);
    expect(signals).toBe(1);
    unchanged();
  });
});
