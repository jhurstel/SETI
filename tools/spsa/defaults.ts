// Poids en place : DEFAULT_WEIGHTS et ceux de chaque nombre de joueurs (point de départ du réglage, « default » des comparaisons)
import { DEFAULT_WEIGHTS, WEIGHTS_BY_PLAYER_COUNT } from '../../src/ai/AIEvaluator';
console.log(JSON.stringify({ base: DEFAULT_WEIGHTS, byCount: WEIGHTS_BY_PLAYER_COUNT }));
