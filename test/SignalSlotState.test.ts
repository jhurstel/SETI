import { signalSlotState } from '../src/ui/components/signalSlotState';
import { SLOT_COLORS } from '../src/ui/styles/slotColors';
import { createTestGame } from './helpers/gameFixture';

describe('infobulle des cases de signal (secteurs, Oumuamua)', () => {
  test('marquée, signal précédent manquant, choix d\'un secteur', async () => {
    const game = await createTestGame();
    const signal = game.board.sectors[0].signals[0];
    const humanId = game.players[0].id;
    expect(signalSlotState(game, { type: 'IDLE' }, { ...signal, marked: true, markedBy: humanId }, false, false, false))
      .toEqual({ status: `Marqué par ${game.players[0].name}`, color: game.players[0].color, note: null });
    expect(signalSlotState(game, { type: 'IDLE' }, signal, true, false, false).note).toBe('Nécessite le signal précédent');
    expect(signalSlotState(game, { type: 'SELECTING_SCAN_SECTOR', color: game.board.sectors[0].color }, signal, false, true, false).note)
      .toBe('Cliquez pour marquer le signal');
  });

  test('case du secteur de la Terre : disponible au scan, coût sur la ligne du bonus ; sans ressources : insuffisantes', async () => {
    const game = await createTestGame();
    const signal = game.board.sectors[0].signals[0];
    const scannable = signalSlotState(game, { type: 'IDLE' }, signal, false, true, true);
    expect(scannable).toEqual({ status: 'Disponible', color: SLOT_COLORS.available, note: 'Scannez pour envoyer un signal', cost: { credits: 1, energy: 2 } });
    game.players[0].credits = 0;
    expect(signalSlotState(game, { type: 'IDLE' }, signal, false, true, false).status).toBe('Ressources insuffisantes');
  });

  test('autre prochaine case : indisponible pour l\'instant, à marquer par un scan ou un signal', async () => {
    const game = await createTestGame();
    const state = signalSlotState(game, { type: 'IDLE' }, game.board.sectors[0].signals[0], false, false, false);
    expect(state).toEqual({ status: 'Indisponible', color: SLOT_COLORS.unavailable, note: 'Nécessite un scan ou un signal' });
  });
});
