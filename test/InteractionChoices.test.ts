import { InteractionChoices } from '../src/engine/InteractionChoices';
import { AIController } from '../src/ai/AIController';
import { SpeciesSystem } from '../src/systems/SpeciesSystem';
import { CardSystem } from '../src/systems/CardSystem';
import { DiskName, Game, LifeTraceLocation, LifeTraceType, Probe, ProbeState, SectorNumber, TechnologyCategory } from '../src/core/types';
import { createRotationState, getAdjacentCells, getCell, getObjectPosition } from '../src/core/SolarSystemPosition';
import { createTestGame, getPlayer } from './helpers/gameFixture';

const P1 = 'player_0';

describe('InteractionChoices', () => {
  let game: Game;

  beforeEach(async () => {
    game = await createTestGame();
    game.currentPlayerIndex = 0;
  });

  test('carte Alien : prend la carte, garde l\'interaction pour la suivante, sans modifier la partie reçue', () => {
    const species = game.species[0];
    const before = JSON.stringify(game);
    const handSize = getPlayer(game, P1).cards.length;

    const res = InteractionChoices.acquireAlienCard(game, P1, { type: 'ACQUIRING_ALIEN_CARD', count: 2, speciesId: species.id, sequenceId: 's' }, 'deck');

    expect(res.error).toBeUndefined();
    expect(getPlayer(res.updatedGame, P1).cards).toHaveLength(handSize + 1);
    expect(res.historyEntries[0].message).toContain('de la pioche');
    expect(res.newPendingInteractions).toEqual([{ type: 'ACQUIRING_ALIEN_CARD', count: 1, speciesId: species.id, sequenceId: 's' }]);
    expect(JSON.stringify(game)).toBe(before);
  });

  test('robot : prend toutes les cartes Alien promises (régression : une seule pour un gain de 2)', () => {
    const species = game.species[0];
    const handSize = getPlayer(game, P1).cards.length;

    const res = AIController.processInteractionQueue(game, [{ type: 'ACQUIRING_ALIEN_CARD', count: 2, speciesId: species.id }], 'seq', getPlayer(game, P1));

    expect(getPlayer(res.updatedGame, P1).cards).toHaveLength(handSize + 2);
  });

  test('tuile objectif déjà occupée : refusée, partie inchangée (régression : le joueur perdait son marqueur)', () => {
    const tile = game.board.objectiveTiles[0];
    tile.markers.push(P1);

    const res = InteractionChoices.placeObjectiveMarker(game, P1, { type: 'PLACING_OBJECTIVE_MARKER', milestone: 25 }, tile.id);

    expect(res.error).toBeDefined();
    expect(res.updatedGame).toBe(game);
  });

  test('tuile objectif libre : marqueur placé et message dans la séquence', () => {
    const tile = game.board.objectiveTiles[0];

    const res = InteractionChoices.placeObjectiveMarker(game, P1, { type: 'PLACING_OBJECTIVE_MARKER', milestone: 25, sequenceId: 'obj' }, tile.id);

    expect(res.updatedGame.board.objectiveTiles[0].markers).toContain(P1);
    expect(res.historyEntries).toEqual([expect.objectContaining({ playerId: P1, sequenceId: 'obj' })]);
    expect(game.board.objectiveTiles[0].markers).not.toContain(P1);
  });

  test('trace de vie : couleur non demandée refusée', () => {
    const res = InteractionChoices.placeLifeTrace(game, P1, { type: 'PLACING_LIFE_TRACE', color: LifeTraceType.RED }, 0, LifeTraceType.BLUE, 'triangle' as never);

    expect(res.error).toBeDefined();
    expect(res.updatedGame).toBe(game);
  });

  test('trace de vie : placée sur le premier emplacement proposé, sans découverte annoncée à tort', () => {
    // Indicateur resté actif d'une action précédente : ne doit pas annoncer de découverte
    game.isSpeciesDiscovered = true;
    const option = SpeciesSystem.lifeTraceOptions(game, LifeTraceType.RED)[0];

    const res = InteractionChoices.placeLifeTrace(game, P1, { type: 'PLACING_LIFE_TRACE', color: LifeTraceType.RED, sequenceId: 't' }, option.boardIndex, option.color, option.location, option.slotIndex);

    expect(res.error).toBeUndefined();
    expect(res.updatedGame).not.toBe(game);
    expect(res.historyEntries.some(e => e.message === 'découvre une nouvelle espèce Alien !')).toBe(false);
    expect(res.updatedGame.isSpeciesDiscovered).toBe(false);
    expect(res.historyEntries.every(e => e.sequenceId === 't')).toBe(true);
  });

  test('robot, Observation III : défausse une carte de la main pour un signal, comme le joueur humain', () => {
    const player = getPlayer(game, P1);
    const card = CardSystem.getHandCards(player)[0];
    const discardSize = game.decks.discardPile.length;

    const res = AIController.processInteractionQueue(game, [{ type: 'CHOOSING_OBS3_ACTION' }], 'seq', player);

    expect(getPlayer(res.updatedGame, P1).cards.some(c => c.id === card.id)).toBe(false);
    expect(res.updatedGame.decks.discardPile.filter(c => c.id === card.id)).toHaveLength(1);
    expect(res.updatedGame.decks.discardPile.length).toBe(discardSize + 1);
  });

  test("trace de vie limitée à certains plateaux : un autre plateau est refusé", () => {
    const res = InteractionChoices.placeLifeTrace(game, P1, { type: 'PLACING_LIFE_TRACE', color: LifeTraceType.RED, boardIndices: [1] }, 0, LifeTraceType.RED, LifeTraceLocation.TRIANGLE);
    expect(res.error).toBe('Plateau Alien non autorisé');
    expect(res.updatedGame).toBe(game);
  });

  test("technologie Informatique sans colonne alors qu'il en reste une libre : la colonne est demandée", () => {
    const tech = game.board.technologyBoard.available.find(t => t.type === TechnologyCategory.COMPUTING)!;
    const res = InteractionChoices.acquireTech(game, P1, { type: 'SELECTING_COMPUTER_SLOT', tech }, tech);
    expect(res.error).toBe("Choisissez une colonne de l'ordinateur");
  });
});

describe('InteractionChoices.moveProbe : le pas de sonde du joueur humain et des robots', () => {
  let game: Game;
  const MOVING = { type: 'MOVING_PROBE' as const, count: 3, sequenceId: 'mv' };

  /** Sonde de P1 sur une case voisine de Mars sans astéroïde (anneaux à 0) ; renvoie la case de Mars */
  const probeNextToMars = () => {
    const s = game.board.solarSystem;
    Object.assign(s, { rotationAngleLevel1: 0, rotationAngleLevel2: 0, rotationAngleLevel3: 0 });
    const rotation = createRotationState(0, 0, 0);
    const mars = getObjectPosition('mars', 0, 0, 0, s.extraCelestialObjects)!;
    const from = getAdjacentCells(mars.disk, mars.absoluteSector).find(c => !getCell(c.disk, c.sector, rotation, s.extraCelestialObjects)?.hasAsteroid)!;
    const probe: Probe = { id: 'p1', ownerId: P1, position: { x: 0, y: 0 }, solarPosition: { disk: from.disk, sector: from.sector, level: 0 }, state: ProbeState.IN_SOLAR_SYSTEM, isOrbiter: false, isLander: false };
    getPlayer(game, P1).probes = [probe];
    s.probes = [probe];
    return { disk: mars.disk as DiskName, sector: mars.absoluteSector as SectorNumber };
  };

  beforeEach(async () => {
    game = await createTestGame();
    game.currentPlayerIndex = 0;
  });

  test('déplacements gratuits : un pas consommé, les restants suivent, sans modifier la partie reçue', () => {
    const mars = probeNextToMars();
    const before = JSON.stringify(game);
    const energy = getPlayer(game, P1).energy;

    const res = InteractionChoices.moveProbe(game, P1, MOVING, 'p1', mars.disk, mars.sector, 'mv');

    expect(res.error).toBeUndefined();
    expect(getPlayer(res.updatedGame, P1).energy).toBe(energy);
    expect(res.nextInteraction).toEqual({ ...MOVING, count: 2 });
    expect(JSON.stringify(game)).toBe(before);
  });

  test('carte 19 sur une planète : le choix Média / déplacement reprend les déplacements restants (pas de suite en double)', () => {
    const mars = probeNextToMars();
    getPlayer(game, P1).activeBuffs = [{ type: 'CHOICE_MEDIA_OR_MOVE', value: true, source: 'Assistance' }];

    const res = InteractionChoices.moveProbe(game, P1, MOVING, 'p1', mars.disk, mars.sector, 'mv');

    expect(res.newPendingInteractions).toEqual([expect.objectContaining({ type: 'CHOOSING_MEDIA_OR_MOVE', remainingMoves: 2 })]);
    expect(res.nextInteraction).toBeUndefined();
  });

  test("sans déplacement gratuit : payé en énergie ; refusé sans énergie ou hors de son tour", () => {
    const mars = probeNextToMars();
    getPlayer(game, P1).energy = 1;
    const paid = InteractionChoices.moveProbe(game, P1, undefined, 'p1', mars.disk, mars.sector, 'mv');
    expect(getPlayer(paid.updatedGame, P1).energy).toBe(0);
    expect(paid.nextInteraction).toBeUndefined();

    getPlayer(game, P1).energy = 0;
    expect(InteractionChoices.moveProbe(game, P1, undefined, 'p1', mars.disk, mars.sector, 'mv').error).toBeDefined();
    game.currentPlayerIndex = 1;
    expect(InteractionChoices.moveProbe(game, P1, MOVING, 'p1', mars.disk, mars.sector, 'mv').error).toBe("Ce n'est pas votre tour");
  });
});

