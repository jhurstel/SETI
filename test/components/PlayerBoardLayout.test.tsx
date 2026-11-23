/** @jest-environment jsdom */
import { act, fireEvent, render, within } from '@testing-library/react';
import * as fs from 'fs';
import * as path from 'path';
import { DataLoader } from '../../src/core/DataLoader';
import { CardType, Game, GamePhase } from '../../src/core/types';
import { PlayerBoardUI } from '../../src/ui/PlayerBoardUI';
import { createTestGame, getPlayer } from '../helpers/gameFixture';

/** Plateau joueur : rangée Exploration | Observation, main et missions l'une sous l'autre, fenêtre « main en grand » */

const P1 = 'player_0';
const P2 = 'player_1';
let base: Game;
beforeAll(async () => {
  // jsdom n'a ni fetch ni Response : les CSV sont lus sur le disque
  (global as { fetch?: unknown }).fetch ??= () => Promise.reject(new Error('fetch'));
  DataLoader.setReader(async p => fs.readFileSync(path.resolve(__dirname, '../../public', p), 'utf8'));
  base = await createTestGame();
});

/** Partie en cours, tour du joueur 1 (humain), ressources pour jouer des cartes */
const freshGame = (): Game => {
  const game: Game = JSON.parse(JSON.stringify(base));
  game.phase = GamePhase.PLAYING;
  game.currentPlayerIndex = 0;
  game.players[0].type = 'human';
  game.players[1].type = 'robot';
  game.players[0].credits = 10;
  game.players[0].energy = 10;
  return game;
};

const handOf = (game: Game, playerId: string) => getPlayer(game, playerId).cards.filter(c => c.type !== CardType.EXERTIEN);

const board = (game: Game, playerId = P1, onPlayCard = jest.fn()) => (
  <PlayerBoardUI game={game} playerId={playerId} interactionState={{ type: 'IDLE' }} onViewPlayer={jest.fn()} onAction={jest.fn()}
    onCardClick={jest.fn()} onDiscardCardAction={jest.fn()} onPlayCard={onPlayCard} onBuyCardAction={jest.fn()} onTradeCardAction={jest.fn()}
    onTransferData={jest.fn()} onComputerSlotSelect={jest.fn()} onNextPlayer={jest.fn()} onDirectTradeAction={jest.fn()}
    setActiveTooltip={jest.fn()} onSettingsClick={jest.fn()} onDocumentationClick={jest.fn()} onMissionClick={jest.fn()} onConfirmAction={jest.fn()} />
);

const sectionByTitle = (container: HTMLElement, title: string) =>
  [...container.querySelectorAll('.seti-player-section')].find(s => s.querySelector('.seti-player-section-title')?.textContent?.trim().startsWith(title)) as HTMLElement;

const modal = () => document.body.querySelector('.seti-hand-modal') as HTMLElement | null;
const openButton = (getByRole: (role: string, options: { name: string }) => HTMLElement) => getByRole('button', { name: 'Voir la main en grand' });

describe('Disposition du plateau joueur', () => {
  test('Exploration et Observation partagent une rangée, Informatique est seule sur toute la largeur', () => {
    const { container } = render(board(freshGame()));
    const exploration = sectionByTitle(container, 'Exploration');
    const observation = sectionByTitle(container, 'Observation');
    expect(exploration.parentElement).toBe(observation.parentElement);
    expect(exploration.parentElement!.classList.contains('seti-player-row')).toBe(true);
    const computer = container.querySelector('[data-tutorial="computer"]') as HTMLElement;
    expect(computer.parentElement!.classList.contains('seti-player-row')).toBe(false);
    // Pistes compactes ; l'ordinateur garde sa taille
    expect(exploration.querySelector('.obs-track-container.compact')).not.toBeNull();
    expect(observation.querySelector('.obs-track-container.compact')).not.toBeNull();
    expect(computer.querySelector('.compact')).toBeNull();
  });

  test("Main puis Missions, l'une sous l'autre sur toute la largeur, cibles du tutoriel conservées", () => {
    const { container } = render(board(freshGame()));
    const hand = container.querySelector('[data-tutorial="hand"]') as HTMLElement;
    const missions = container.querySelector('[data-tutorial="missions"]') as HTMLElement;
    expect(hand.parentElement!.classList.contains('seti-player-row')).toBe(false);
    expect(missions.parentElement!.classList.contains('seti-player-row')).toBe(false);
    expect(hand.nextElementSibling).toBe(missions);
    expect(container.querySelector('[data-tutorial="player-board"]')).not.toBeNull();
    expect(container.querySelector('[data-tutorial="computer"]')).not.toBeNull();
  });
});

describe('Main en grand', () => {
  test('le bouton ouvre la fenêtre avec toutes les cartes de la main ; Échap et Fermer la ferment', () => {
    const game = freshGame();
    const { getByRole } = render(board(game));
    fireEvent.click(openButton(getByRole));
    expect(modal()).not.toBeNull();
    expect(modal()!.querySelectorAll('.seti-common-card')).toHaveLength(handOf(game, P1).length);
    expect(modal()!.querySelector('.seti-choice-modal-title')!.textContent).toBe('Votre main');
    act(() => { fireEvent.keyDown(window, { key: 'Escape' }); });
    expect(modal()).toBeNull();

    fireEvent.click(openButton(getByRole));
    fireEvent.click(within(modal()!).getByRole('button', { name: 'Fermer' }));
    expect(modal()).toBeNull();
  });

  test('un clic hors de la fenêtre la ferme, un clic dedans non', () => {
    const { getByRole } = render(board(freshGame()));
    fireEvent.click(openButton(getByRole));
    fireEvent.click(modal()!.querySelector('.seti-choice-modal-title')!);
    expect(modal()).not.toBeNull();
    fireEvent.click(document.body.querySelector('.seti-modal-overlay')!);
    expect(modal()).toBeNull();
  });

  test('Jouer depuis la fenêtre envoie la commande ; la fenêtre se ferme quand la carte quitte la main', () => {
    const game = freshGame();
    const onPlayCard = jest.fn();
    const { getByRole, rerender } = render(board(game, P1, onPlayCard));
    fireEvent.click(openButton(getByRole));
    let played: string | undefined;
    for (const card of [...modal()!.querySelectorAll('.seti-card-wrapper')]) {
      fireEvent.click(card);
      const play = modal()!.querySelector('.seti-hand-card-play-btn');
      if (play && play.getAttribute('aria-disabled') !== 'true') {
        fireEvent.click(play);
        played = onPlayCard.mock.calls[0]?.[0];
        break;
      }
    }
    expect(played).toBeDefined();
    expect(modal()).not.toBeNull();

    // La session a joué la carte : elle quitte la main
    const after: Game = JSON.parse(JSON.stringify(game));
    after.players[0].cards = after.players[0].cards.filter(c => c.id !== played);
    rerender(board(after, P1, onPlayCard));
    expect(modal()).toBeNull();
  });

  test('main vide : bouton désactivé, aucune fenêtre', () => {
    const game = freshGame();
    game.players[0].cards = [];
    const { getByRole } = render(board(game));
    const button = openButton(getByRole);
    expect(button.getAttribute('aria-disabled')).toBe('true');
    fireEvent.click(button);
    expect(modal()).toBeNull();
  });

  test("main d'un robot : cartes cachées de dos, sans bouton de commande", () => {
    const game = freshGame();
    getPlayer(game, P2).cards.forEach(c => { c.isRevealed = false; });
    const { getByRole } = render(board(game, P2));
    fireEvent.click(openButton(getByRole));
    expect(modal()!.querySelectorAll('.seti-card-back')).toHaveLength(handOf(game, P2).length);
    expect(modal()!.querySelector('.seti-hand-card-play-btn')).toBeNull();
    expect(modal()!.querySelector('.seti-choice-modal-title')!.textContent).toBe(`Main de ${getPlayer(game, P2).name}`);
  });
});
