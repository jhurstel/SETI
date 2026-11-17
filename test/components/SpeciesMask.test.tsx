/** @jest-environment jsdom */
import { render } from '@testing-library/react';
import { AlienBoardType, CardType, Game, HistoryEntry } from '../../src/core/types';
import { cardSpecies } from '../../src/ui/cardSpecies';
import { chapterById } from '../../src/tutorial/chapters';
import { applyTutorialCommand, prepareChapter } from '../../src/tutorial/prepare';
import { answerInteraction } from '../../src/tutorial/scenario';
import { speciesMask } from '../../src/tutorial/unlock';
import { AlienBoardUI } from '../../src/ui/AlienBoardUI';
import { HistoryList } from '../../src/ui/HistoryBoardUI';
import { SpeciesMaskContext } from '../../src/ui/speciesMask';
import * as fs from 'fs';
import * as path from 'path';

/** Chapitre « Traces de vie et espèces » joué jusqu'à la découverte : partie, historique et masque */
async function discoveredInChapter(unlockedSpecies: string[]) {
  const chapter = chapterById('especes')!;
  const { game: start, humanId, entries } = await prepareChapter(chapter, 'Alice', { unlockedSpecies });
  let game = start;
  const log: HistoryEntry[] = [...entries];
  for (const command of chapter.solution) {
    let step = applyTutorialCommand(game, humanId, command);
    game = step.game;
    log.push(...step.entries);
    while (game.interaction) {
      step = applyTutorialCommand(game, humanId, answerInteraction);
      game = step.game;
      log.push(...step.entries);
    }
  }
  return { game, log: log.map((e, i) => ({ ...e, id: e.id ?? `e${i}` })), mask: speciesMask(chapter, start, unlockedSpecies) };
}

function renderBoards(game: Game, log: HistoryEntry[], mask: ReturnType<typeof speciesMask>) {
  return render(
    <SpeciesMaskContext.Provider value={mask}>
      <AlienBoardUI game={game} boardIndex={0} interactionState={{ type: 'IDLE' }} onPlaceLifeTrace={() => {}}
        onSpeciesCardClick={() => {}} setActiveTooltip={() => {}} onOpenDocumentation={() => {}} />
      <HistoryList game={game} historyLog={log} setActiveTooltip={() => {}} />
    </SpeciesMaskContext.Provider>,
  );
}

describe('espèce masquée à l\'écran', () => {
  // jsdom n'a ni fetch ni Response : les fichiers de public/ (cartes) sont servis directement
  beforeAll(() => {
    (globalThis as { fetch?: unknown }).fetch = async (url: string) => {
      const file = path.join(__dirname, '../../public', String(url));
      return fs.existsSync(file) ? { ok: true, status: 200, text: async () => fs.readFileSync(file, 'utf8') } : { ok: false, status: 404, text: async () => '' };
    };
  });

  test('espèce jamais rencontrée : plateau « Espèce découverte », historique sans son nom ni ses cartes', async () => {
    const { game, log, mask } = await discoveredInChapter([]);
    expect(game.board.alienBoards[0].isDiscovered).toBe(true);
    const { container } = renderBoards(game, log, mask);
    const text = container.textContent ?? '';
    expect(text).toContain('Espèce découverte');
    expect(text).not.toMatch(/anomalie/i);
    mask.cardNames.forEach(name => expect(text).not.toContain(name));
    expect(container.querySelector('.alien-tracks-container')).toBeNull();
    expect(container.querySelector('.alien-species-doc-btn')).toBeNull();
    // Aucun symbole d'espèce au dos des cartes
    expect(container.querySelector('.seti-card-back-species')).toBeNull();
  });

  test('espèce déjà débloquée : affichée normalement', async () => {
    const { game, log, mask } = await discoveredInChapter([AlienBoardType.MASCAMITES]);
    const { container } = renderBoards(game, log, mask);
    expect(container.textContent).toContain(AlienBoardType.MASCAMITES);
    expect(container.querySelector('.alien-tracks-container')).not.toBeNull();
    // Pioche de l'espèce : son symbole au dos
    expect(container.querySelector('.seti-deck-pile [data-species="Mascamites"]')).not.toBeNull();
  });
});

describe("espèce d'une carte (symbole au dos)", () => {
  test("d'après son numéro ET.n, ou son type pour une carte Exertien cachée", () => {
    expect(cardSpecies({ id: 'ET.1', type: CardType.ACTION })).toBe(AlienBoardType.MASCAMITES);
    expect(cardSpecies({ id: 'ET.14', type: CardType.ACTION })).toBe(AlienBoardType.ANOMALIES);
    expect(cardSpecies({ id: 'ET.30', type: CardType.ACTION })).toBe(AlienBoardType.OUMUAMUA);
    expect(cardSpecies({ id: 'ET.31', type: CardType.CENTAURIEN })).toBe(AlienBoardType.CENTAURIENS);
    expect(cardSpecies({ id: 'ET.55', type: CardType.EXERTIEN })).toBe(AlienBoardType.EXERTIENS);
    expect(cardSpecies({ id: 'hidden-2', type: CardType.EXERTIEN })).toBe(AlienBoardType.EXERTIENS);
    expect(cardSpecies({ id: '14', type: CardType.ACTION })).toBeUndefined();
    expect(cardSpecies({ id: 'hidden-1', type: CardType.ACTION })).toBeUndefined();
  });
});
