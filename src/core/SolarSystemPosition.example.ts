/**
 * Exemples d'utilisation du module SolarSystemPosition
 * 
 * Ce fichier montre comment utiliser les fonctions du module pour :
 * - Obtenir les positions de tous les objets célestes
 * - Vérifier la visibilité des cases
 * - Calculer les trajectoires accessibles
 */

import {
  createRotationState,
  getAllAbsolutePositions,
  getAllCells,
  getObjectPosition,
  getObjectsOnCell,
  getCell,
  calculateReachableCells,
  calculateReachableCellsWithEnergy,
  getAllCelestialObjects,
} from './SolarSystemPosition';

// Exemple 1 : Créer un état de rotation
const rotationState = createRotationState(
  -45, // Plateau niveau 1 tourné de 45° dans le sens anti-horaire
  -90, // Plateau niveau 2 tourné de 90° dans le sens anti-horaire
  -45  // Plateau niveau 3 tourné de 45° dans le sens anti-horaire
);

// Exemple 2 : Obtenir toutes les positions absolues
const allPositions = getAllAbsolutePositions(rotationState);
allPositions.forEach((position, objectId) => {
  console.log(`${objectId}: ${position.disk}${position.absoluteSector} (visible: ${position.isVisible})`);
});

// Exemple 3 : Obtenir la position d'un objet spécifique
const earthPosition = getObjectPosition('earth', rotationState);
if (earthPosition) {
  console.log(`Terre: ${earthPosition.disk}${earthPosition.absoluteSector}`);
}

// Exemple 4 : Obtenir tous les objets sur une case
const objectsOnA3 = getObjectsOnCell('A', 3, rotationState);
console.log(`Objets sur A3:`, objectsOnA3.map(obj => obj.name));

// Exemple 5 : Obtenir l'état d'une case
const cellA3 = getCell('A', 3, rotationState);
if (cellA3) {
  console.log(`Case A3:`, {
    hasPlanet: cellA3.hasPlanet,
    planetName: cellA3.planetName,
    hasAsteroid: cellA3.hasAsteroid,
    hasComet: cellA3.hasComet,
    isVisible: cellA3.isVisible,
  });
}

// Exemple 6 : Obtenir toutes les cases
const allCells = getAllCells(rotationState);
allCells.forEach((cell, cellKey) => {
  if (cell.isVisible && (cell.hasPlanet || cell.hasAsteroid || cell.hasComet)) {
    console.log(`${cellKey}:`, {
      planet: cell.planetName,
      asteroid: cell.hasAsteroid,
      comet: cell.hasComet,
    });
  }
});

// Exemple 7 : Calculer les cases accessibles depuis A3 avec 3 déplacements
const reachableFromA3 = calculateReachableCells('A', 3, 3, rotationState);
reachableFromA3.forEach((data, cellKey) => {
  console.log(`${cellKey}: ${data.movements} déplacements`, data.path);
});

// Exemple 8 : Calculer les cases accessibles avec énergie
const reachableWithEnergy = calculateReachableCellsWithEnergy(
  'A', 3, // Position de départ
  2,      // 2 déplacements disponibles
  3,      // 3 énergie disponible (sera convertie en 3 déplacements)
  rotationState
);
console.log(`Cases accessibles avec 2 déplacements + 3 énergie:`, reachableWithEnergy.size);

// Exemple 9 : Obtenir tous les objets célestes
const allObjects = getAllCelestialObjects();
console.log(`Total d'objets célestes:`, allObjects.length);
allObjects.forEach(obj => {
  console.log(`${obj.name} (${obj.type}) sur ${obj.position.disk}${obj.position.sector}, niveau ${obj.level}`);
});


