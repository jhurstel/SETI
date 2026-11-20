/** @jest-environment jsdom */
import { fireEvent, render } from '@testing-library/react';
import { ActionType, Game, GamePhase } from '../../src/core/types';
import { PlayerActions } from '../../src/ui/player/PlayerActions';
import { ActionValidator } from '../../src/engine/ActionValidator';
import { createTestGame, getPlayer } from '../helpers/gameFixture';
import { renderToStaticMarkup } from 'react-dom/server';
import { ReactElement } from 'react';
import * as fs from 'fs';
import * as path from 'path';
import { DataLoader } from '../../src/core/DataLoader';

/** Actions principales du plateau joueur : grisées quand le moteur les refuse, raison dans l'infobulle du jeu */

const P1 = 'player_0';
let base: Game;
beforeAll(async () => {
  // jsdom n'a ni fetch ni Response : les CSV sont lus sur le disque
  (global as { fetch?: unknown }).fetch ??= () => Promise.reject(new Error('fetch'));
  DataLoader.setReader(async p => fs.readFileSync(path.resolve(__dirname, '../../public', p), 'utf8'));
  base = await createTestGame();
});

const freshGame = (): Game => {
  const game: Game = JSON.parse(JSON.stringify(base));
  game.phase = GamePhase.PLAYING;
  game.currentPlayerIndex = 0;
  return game;
};

const renderActions = (game: Game, overrides: { isInteractiveMode?: boolean, tutorialBlock?: (a: string) => string | null } = {}) => {
  const onAction = jest.fn();
  const onHover = jest.fn();
  const utils = render(
    <PlayerActions game={game} playerId={P1} interactionState={{ type: 'IDLE' }} isInteractiveMode={overrides.isInteractiveMode ?? false}
      onAction={onAction} onNextPlayer={jest.fn()} handleTooltipHover={onHover} handleTooltipLeave={jest.fn()} tutorialBlock={overrides.tutorialBlock} />
  );
  const slot = (action: ActionType) => utils.getByRole('button', { name: action });
  /** Texte de l'infobulle passée au survol de l'action */
  const tooltipText = (action: ActionType) => {
    onHover.mockClear();
    fireEvent.mouseEnter(slot(action));
    return renderToStaticMarkup(onHover.mock.calls[0][1] as ReactElement);
  };
  return { ...utils, onAction, slot, tooltipText };
};

test('action impossible : grisée, sans effet au clic, raison du moteur dans l\'infobulle', () => {
  const game = freshGame();
  Object.assign(getPlayer(game, P1), { credits: 0, energy: 0, mediaCoverage: 0 });
  const { slot, onAction, tooltipText } = renderActions(game);
  const scan = slot(ActionType.SCAN_SECTOR);
  expect(scan.getAttribute('aria-disabled')).toBe('true');
  expect(scan.classList.contains('unavailable')).toBe(true);
  fireEvent.click(scan);
  expect(onAction).not.toHaveBeenCalled();
  const reason = ActionValidator.mainActionAvailability(game, P1)[ActionType.RESEARCH_TECH].reason!;
  expect(tooltipText(ActionType.RESEARCH_TECH)).toContain(reason);
});

test('action possible : active, mise en avant et cliquable', () => {
  const game = freshGame();
  Object.assign(getPlayer(game, P1), { credits: 10, energy: 10 });
  const { slot, onAction, tooltipText } = renderActions(game);
  const launch = slot(ActionType.LAUNCH_PROBE);
  expect(launch.getAttribute('aria-disabled')).toBe('false');
  expect(launch.classList.contains('unavailable')).toBe(false);
  expect(launch.classList.contains('seti-flash-green')).toBe(true);
  fireEvent.click(launch);
  expect(onAction).toHaveBeenCalledWith(ActionType.LAUNCH_PROBE);
  expect(tooltipText(ActionType.LAUNCH_PROBE)).toContain('Cliquez pour lancer une sonde');
});

test('fin du tour : grisée avant l\'action principale, active après', () => {
  const game = freshGame();
  const before = renderActions(game);
  expect(before.getByRole('button', { name: 'Prochain joueur' }).classList.contains('unavailable')).toBe(true);
  before.unmount();
  getPlayer(game, P1).hasPerformedMainAction = true;
  const active = renderActions(game).getByRole('button', { name: 'Prochain joueur' });
  expect(active.classList.contains('unavailable')).toBe(false);
  expect(active.getAttribute('aria-disabled')).toBe('false');
});

test('tour d\'un autre joueur : toutes les actions grisées, raison générale', () => {
  const game = freshGame();
  game.currentPlayerIndex = 1;
  const { slot, tooltipText } = renderActions(game);
  [ActionType.LAUNCH_PROBE, ActionType.PASS, ActionType.PLAY_CARD].forEach(a => expect(slot(a).classList.contains('unavailable')).toBe(true));
  expect(tooltipText(ActionType.LAUNCH_PROBE)).toContain("Ce n&#x27;est pas votre tour");
});

test('blocages de l\'écran : étape du tutoriel puis mode de sélection en cours', () => {
  const game = freshGame();
  Object.assign(getPlayer(game, P1), { credits: 10, energy: 10 });
  const tutorial = renderActions(game, { tutorialBlock: a => a === ActionType.LAUNCH_PROBE ? 'Suivez l\'étape en cours' : null });
  expect(tutorial.slot(ActionType.LAUNCH_PROBE).classList.contains('unavailable')).toBe(true);
  expect(tutorial.tooltipText(ActionType.LAUNCH_PROBE)).toContain('Suivez l&#x27;étape en cours');
  tutorial.unmount();
  const selecting = renderActions(game, { isInteractiveMode: true });
  expect(selecting.slot(ActionType.LAUNCH_PROBE).classList.contains('unavailable')).toBe(true);
  expect(selecting.tooltipText(ActionType.LAUNCH_PROBE)).toContain('Terminez d&#x27;abord l&#x27;action en cours');
});
