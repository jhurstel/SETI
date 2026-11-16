import { CardSystem } from '../src/systems/CardSystem';
import { ScanSystem } from '../src/systems/ScanSystem';
import { SpeciesSystem } from '../src/systems/SpeciesSystem';
import { InteractionChoices } from '../src/engine/InteractionChoices';
import { InteractionResolver } from '../src/engine/InteractionResolver';
import { DataLoader } from '../src/core/DataLoader';
import { playerText, revealText, textFor } from '../src/core/historyText';
import { AlienBoardType, Card, Game, Sector, TechnologyCategory } from '../src/core/types';
import { createTestGame, getPlayer, giveCard, mockFetchFromPublic } from './helpers/gameFixture';

/** Textes des messages d'historique rédigés par le moteur (sous-actions, doublons, noms privés) */
describe("Messages d'historique", () => {
  const P1 = 'player_0';
  const P2 = 'player_1';
  let game: Game;

  beforeEach(async () => {
    game = await createTestGame(['Alice', 'Bob']);
  });

  const occurrences = (text: string, part: string) => text.split(part).length - 1;

  test('carte 92 : la réservation de la carte est une sous-action, la carte piochée reste privée', () => {
    giveCard(game, P1, '92');
    getPlayer(game, P1).credits = 5;
    const before = JSON.stringify(game);

    const res = CardSystem.playCard(game, P1, '92');
    const [play, ...rest] = res.historyEntries;
    expect(play.message).toBe('paye 3 Crédits pour jouer "Photo du Jour de la NASA" et gagne 2 Médias');
    const reservation = rest.find(e => e.message.startsWith('réserve '))!;
    expect(reservation.sequenceId).toBe(play.sequenceId);
    const drawn = getPlayer(res.updatedGame, P1).cards.at(-1)!;
    expect(revealText(reservation.message)).toBe(`réserve "Photo du Jour de la NASA" et gagne 1 Carte "${drawn.name}"`);
    expect(textFor(reservation.message, P2)).toBe('réserve "Photo du Jour de la NASA" et gagne 1 Carte');
    expect(getPlayer(res.updatedGame, P1).reservedCards.map(c => c.id)).toContain('92');
    expect(JSON.stringify(game)).toBe(before);
  });

  test('carte 91 : la réservation annonce son gain d\'Énergie une seule fois', () => {
    giveCard(game, P1, '91');
    getPlayer(game, P1).credits = 5;
    const energy = getPlayer(game, P1).energy;

    const res = CardSystem.playCard(game, P1, '91');
    expect(res.historyEntries[0].message).toBe('paye 3 Crédits pour jouer "Réacteur à Fusion"');
    expect(res.historyEntries.map(e => e.message)).toContain('réserve "Réacteur à Fusion" et gagne 1 Énergie');
    expect(getPlayer(res.updatedGame, P1).energy).toBe(energy + 1);
    expect(getPlayer(game, P1).energy).toBe(energy);
  });

  test('carte 50 : le bonus de 2 PV n\'est écrit qu\'une fois dans le message du signal', () => {
    const sector = game.board.sectors[0];
    const signalIndex = sector.signals.findIndex(s => !s.bonus?.pv);
    sector.signals.slice(0, signalIndex).forEach(s => { s.marked = true; s.markedBy = P1; });
    getPlayer(game, P1).activeBuffs = [{ type: 'SCORE_IF_UNIQUE', value: 2, source: 'Square Kilometre Array' }];
    const score = getPlayer(game, P1).score;

    const res = ScanSystem.performSignalAndCover(game, P1, sector.id, [], false, 'seq');
    const message = res.historyEntries.at(-1)!.message;
    expect(message).toContain('gagne 2 PV (Bonus "Square Kilometre Array")');
    expect(occurrences(message, '2 PV')).toBe(1);
    expect(getPlayer(res.updatedGame, P1).score).toBe(score + 2);
    expect(getPlayer(game, P1).score).toBe(score);
  });

  test('carte 50 avec un signal à 2 PV : chaque gain est écrit une fois', () => {
    const sector = game.board.sectors[0];
    const signalIndex = sector.signals.findIndex(s => s.bonus?.pv);
    expect(signalIndex).toBeGreaterThanOrEqual(0);
    sector.signals.slice(0, signalIndex).forEach(s => { s.marked = true; s.markedBy = P1; });
    getPlayer(game, P1).activeBuffs = [{ type: 'SCORE_IF_UNIQUE', value: 2, source: 'Square Kilometre Array' }];
    const score = getPlayer(game, P1).score;

    const res = ScanSystem.performSignalAndCover(game, P1, sector.id, [], false, 'seq');
    const message = res.historyEntries.at(-1)!.message;
    const signalPv = sector.signals[signalIndex].bonus!.pv!;
    expect(message).toContain('gagne 2 PV (Bonus "Square Kilometre Array")');
    expect(message).toContain(`gagne ${signalPv} PV`);
    expect(message).not.toContain(`gagne ${signalPv + 2} PV`);
    expect(getPlayer(res.updatedGame, P1).score).toBe(score + signalPv + 2);
  });

  test('couverture avec une carte « bonus si couvert » : l\'Énergie de la carte n\'est pas répétée dans les gains du secteur', () => {
    const sector: Sector = game.board.sectors[0];
    sector.firstBonus = { pv: 3 };
    sector.signals.forEach(s => { s.marked = true; s.markedBy = P1; });
    getPlayer(game, P1).activeBuffs = [{ type: 'BONUS_IF_COVERED', target: 'energy', value: 1, source: 'Carte test' }];
    const energy = getPlayer(game, P1).energy;

    const res = InteractionResolver.resolve(game, P1, { type: 'RESOLVING_SECTOR', sectorId: sector.id, sequenceId: 'seq' });
    const message = res.historyEntries.find(e => e.message.startsWith('couvre le secteur'))!.message;
    expect(message).toContain('gagne 1 Énergie (Bonus "Carte test")');
    expect(message).toContain('gagne 3 PV');
    expect(occurrences(message, 'Énergie')).toBe(1);
    expect(getPlayer(res.updatedGame, P1).energy).toBe(energy + 1);
    expect(getPlayer(game, P1).energy).toBe(energy);
  });

  describe('technologie qui fait gagner une carte (règles : carte de la rangée ou 1re carte du paquet, au choix)', () => {
    const acquire = () => {
      // Tuile au bonus de carte mise sur le dessus de sa pile (seule la tuile du dessus se prend)
      const slot = game.board.technologyBoard.categorySlots!.find(sl => sl.category !== TechnologyCategory.COMPUTING)!;
      const tech = slot.technologies.find(t => t.bonus.anycard)!;
      slot.technologies = [tech, ...slot.technologies.filter(t => t !== tech)];
      expect(game.board.technologyBoard.available.some(t => t.bonus.card)).toBe(false);
      const res = InteractionChoices.acquireTech(game, P1, { type: 'ACQUIRING_TECH', sequenceId: 'seq' }, tech);
      expect(res.historyEntries[0].message).toMatch(/^acquiert technologie .* et gagne 1 Carte/);
      // Conséquences (sonde lancée par Exploration I…) dans la séquence de la technologie : indentées dessous
      expect(res.historyEntries.every(e => e.sequenceId === 'seq')).toBe(true);
      const choice = res.newPendingInteractions.find(i => i.type === 'ACQUIRING_CARD')!;
      expect(choice).toMatchObject({ type: 'ACQUIRING_CARD', count: 1, isFree: true, sequenceId: 'seq' });
      return { res, choice: choice as Extract<typeof choice, { type: 'ACQUIRING_CARD' }> };
    };

    test('carte de la rangée : la sous-action nomme la carte', () => {
      const { res, choice } = acquire();
      const before = JSON.stringify(res.updatedGame);
      const rowCard = res.updatedGame.decks.cardRow[0];
      const taken = InteractionChoices.acquireCard(res.updatedGame, P1, choice, rowCard.id);
      expect(taken.historyEntries[0]).toMatchObject({ message: `choisit "${rowCard.name}" de la rangée`, sequenceId: 'seq' });
      expect(getPlayer(taken.updatedGame, P1).cards.some(c => c.id === rowCard.id)).toBe(true);
      // Ni la partie reçue par le choix de la carte, ni celle reçue par le choix de la technologie ne sont modifiées
      expect(JSON.stringify(res.updatedGame)).toBe(before);
      expect(getPlayer(game, P1).technologies).toHaveLength(0);
    });

    test('carte de la pioche : nom privé', () => {
      const { res, choice } = acquire();
      const taken = InteractionChoices.acquireCard(res.updatedGame, P1, choice);
      const drawn = getPlayer(taken.updatedGame, P1).cards.at(-1)!;
      expect(textFor(taken.historyEntries[0].message, P1)).toBe(`choisit "${drawn.name}" de la pioche`);
      expect(textFor(taken.historyEntries[0].message, P2)).toBe('choisit une carte de la pioche');
    });
  });

  test('couverture : les noms des joueurs présents sont marqués (couleur), pas dans le résumé', () => {
    const sector: Sector = game.board.sectors[0];
    sector.signals.forEach((s, i) => { s.marked = true; s.markedBy = i === 0 ? P2 : P1; });
    const res = InteractionResolver.resolve(game, P1, { type: 'RESOLVING_SECTOR', sectorId: sector.id, sequenceId: 'seq' });
    const message = res.historyEntries.find(e => e.message.startsWith('couvre le secteur'))!.message;
    expect(message).toContain(`(${playerText(P2, 'Bob')} et ${playerText(P1, 'Alice')})`);
    expect(revealText(message)).toContain('(Bob et Alice)');
    expect(res.summary).toContain('(Bob et Alice)');
    expect(res.summary).not.toContain('⟪');
  });

  describe('Centauriens', () => {
    let centaurienCards: Card[];

    beforeAll(async () => {
      const fetchSpy = mockFetchFromPublic();
      centaurienCards = await DataLoader.loadCards('cards/centauriens.csv');
      fetchSpy.mockRestore();
    });

    test('palier de message : « choisit une tuile Message et gagne … », sans répéter le bonus', () => {
      SpeciesSystem.addCentaurienMarker(getPlayer(game, P1));
      const species = game.species.find(s => s.name === AlienBoardType.CENTAURIENS)!;
      const index = species.message!.findIndex(t => t.bonus.media);

      const res = SpeciesSystem.claimCentaurienReward(game, P1, index);
      const message = res.historyEntries[0].message;
      expect(message).toMatch(/^atteint son palier de message Centaurien, choisit une tuile Message et gagne /);
      expect(occurrences(message, 'Média')).toBe(1);
      expect(species.message![index].isAvailable).toBe(true);
    });

    test('carte Centaurien jouée : « … et émet un message »', () => {
      const card = structuredClone(centaurienCards.find(c => !c.passiveEffects.some(e => e.type.startsWith('DISCARD')))!);
      const player = getPlayer(game, P1);
      player.cards.push(card);
      player.credits = 10;
      player.energy = 10;

      const res = CardSystem.playCard(game, P1, card.id);
      expect(res.historyEntries[0].message).toMatch(new RegExp(`^paye .* pour jouer "${card.name}".* et émet un message$`));
      expect(getPlayer(res.updatedGame, P1).centaurienMilestones).toHaveLength(1);
      expect(getPlayer(game, P1).centaurienMilestones).toHaveLength(0);
    });
  });
});
