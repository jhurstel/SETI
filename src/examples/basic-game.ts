/**
 * Exemple d'utilisation basique du moteur de jeu SETI
 */

import { GameFactory } from '../core/GameFactory';
import { GameEngine } from '../core/Game';
import { LaunchProbeAction } from '../actions/LaunchProbeAction';
import { PassAction } from '../actions/PassAction';

/**
 * Exemple : Créer une partie et jouer quelques actions
 */
export function exampleBasicGame() {
  console.log('=== Exemple de partie SETI ===\n');

  // 1. Créer une nouvelle partie avec 2 joueurs
  console.log('1. Création de la partie...');
  const gameState = GameFactory.createGame(['Alice', 'Bob']);
  const initializedGame = GameFactory.initializeGame(gameState);
  const engine = new GameEngine(initializedGame);

  console.log(`Partie créée : ${initializedGame.id}`);
  console.log(`Joueurs : ${initializedGame.players.map(p => p.name).join(', ')}`);
  console.log(`Manche : ${initializedGame.currentRound}/${initializedGame.maxRounds}\n`);

  // 2. Lancer une sonde (joueur 1)
  console.log('2. Alice lance une sonde...');
  const currentPlayer = engine.getCurrentPlayer();
  console.log(`Joueur actuel : ${currentPlayer.name}`);
  console.log(`Crédits : ${currentPlayer.credits}`);

  const launchAction = new LaunchProbeAction(currentPlayer.id);
  const launchResult = engine.executeAction(launchAction);

  if (launchResult.success) {
    const updatedState = engine.getState();
    const updatedPlayer = updatedState.players.find(p => p.id === currentPlayer.id);
    console.log(`✅ Sonde lancée !`);
    console.log(`Crédits restants : ${updatedPlayer?.credits}`);
    console.log(`Sondes : ${updatedPlayer?.probes.length}\n`);
  } else {
    console.log(`❌ Erreur : ${launchResult.error}\n`);
  }

  // 3. Passer son tour (joueur 1)
  console.log('3. Alice passe son tour...');
  const passAction = new PassAction(currentPlayer.id, []);
  const passResult = engine.executeAction(passAction);

  if (passResult.success) {
    console.log(`✅ Tour passé !\n`);
    
    // Le joueur suivant devient actif
    const newState = engine.getState();
    const newCurrentPlayer = newState.players[newState.currentPlayerIndex];
    console.log(`Joueur actuel : ${newCurrentPlayer.name}\n`);
  } else {
    console.log(`❌ Erreur : ${passResult.error}\n`);
  }

  // 4. Afficher l'état final
  console.log('4. État de la partie :');
  const finalState = engine.getState();
  console.log(`Manche : ${finalState.currentRound}`);
  console.log(`Phase : ${finalState.phase}`);
  console.log(`Joueurs ayant passé : ${finalState.players.filter(p => p.hasPassed).map(p => p.name).join(', ') || 'Aucun'}`);
}

// Exécuter l'exemple
exampleBasicGame();

