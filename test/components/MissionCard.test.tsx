/** @jest-environment jsdom */
import { render } from '@testing-library/react';
import { Card, Game, Mission } from '../../src/core/types';
import { MissionCard } from '../../src/ui/components/MissionCard';
import * as fs from 'fs';
import * as path from 'path';
import { DataLoader } from '../../src/core/DataLoader';
import { createTestGame } from '../helpers/gameFixture';

/** Mission jouée : face de sa carte, cercle recouvert du marqueur du joueur */

let game: Game;
let card: Card;
beforeAll(async () => {
  // jsdom n'a pas fetch : createTestGame le remplace le temps de lire les CSV
  (global as { fetch?: unknown }).fetch ??= () => Promise.reject(new Error('fetch'));
  game = await createTestGame();
  DataLoader.setReader(async p => fs.readFileSync(path.resolve(__dirname, '../../public', p), 'utf8'));
  card = (await DataLoader.loadCards('cards/main.csv')).find(c => c.id === '2')!;
});

test('mission à un cercle recouvert : face de la carte, cercle recouvert à la couleur du joueur, l\'autre libre', () => {
  const mission: Mission = {
    id: 'mission-2', cardId: '2', name: card.name, description: card.description, ownerId: 'player_0',
    requirements: card.permanentEffects.map((effect, idx) => ({ id: `req-${idx}`, ...effect })),
    completedRequirementIds: ['req-0'], fulfillableRequirementIds: [], completed: false, originalCard: card,
  };
  const { container } = render(
    <MissionCard mission={mission} game={game} playerId="player_0" currentPlayerColor="#ff0000" isCurrentTurn isRobot={false}
      isInteractiveMode={false} onMissionClick={jest.fn()} handleTooltipHover={jest.fn()} handleTooltipLeave={jest.fn()} />
  );
  expect(container.querySelector('.card-face')!.textContent).toContain(card.name);
  const circles = container.querySelectorAll('.card-face-circle');
  expect(circles).toHaveLength(2);
  expect(circles[0].classList.contains('completed')).toBe(true);
  expect((circles[0].querySelector('.card-face-marker') as HTMLElement).style.backgroundColor).toBe('rgb(255, 0, 0)');
  expect(circles[1].classList.contains('completed')).toBe(false);
  // Aucun déclencheur : le second cercle n'est pas réalisable
  expect(circles[1].classList.contains('fulfillable')).toBe(false);
});
