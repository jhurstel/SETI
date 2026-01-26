import { Game, LifeTraceType } from '../core/types';

export type SpeciesDiscoveryCode = 'NO_MARKERS' | 'NO_SPACE' | 'PLACED' | 'DISCOVERED';

export class SpeciesSystem {
    /**
     * Tente de placer un marqueur neutre sur le plateau Alien pour un palier donné.
     * Gère la décrémentation du stock de marqueurs, le placement sur le premier emplacement libre,
     * et la découverte potentielle d'une espèce.
     */
    static placeNeutralMilestone(game: Game, milestone: number): {
        updatedGame: Game;
        code: SpeciesDiscoveryCode;
        data?: { color: LifeTraceType; speciesId?: string; boardIndex: number };
    } {
        const updatedGame = structuredClone(game);

        // Vérifier s'il reste des marqueurs neutres pour ce palier
        if (!updatedGame.neutralMilestonesAvailable || updatedGame.neutralMilestonesAvailable[milestone] <= 0) {
            return { updatedGame, code: 'NO_MARKERS' };
        }

        updatedGame.neutralMilestonesAvailable[milestone]--;

        const boards = updatedGame.board.alienBoards;
        const colors = [LifeTraceType.RED, LifeTraceType.YELLOW, LifeTraceType.BLUE];
        
        for (let i = 0; i < boards.length; i++) {
            const board = boards[i];
            for (const color of colors) {
                // Vérifier si l'emplacement est libre (aucune trace de cette couleur sur ce plateau)
                const isOccupied = board.lifeTraces.some(t => t.type === color);
                if (!isOccupied) {
                    board.lifeTraces.push({
                        id: `trace-neutral-${Date.now()}`,
                        type: color,
                        playerId: 'neutral'
                    });

                    // Vérifier si une espèce Alien est découverte (1 marqueur de chaque couleur sur ce plateau)
                    const traces = board.lifeTraces;
                    const hasRed = traces.some(t => t.type === LifeTraceType.RED);
                    const hasYellow = traces.some(t => t.type === LifeTraceType.YELLOW);
                    const hasBlue = traces.some(t => t.type === LifeTraceType.BLUE);

                    if (hasRed && hasYellow && hasBlue && !board.speciesId) {
                        const ALIEN_SPECIES = ['Centauriens', 'Exertiens', 'Oumuamua'];
                        const randomSpecies = ALIEN_SPECIES[Math.floor(Math.random() * ALIEN_SPECIES.length)];
                        board.speciesId = randomSpecies;
                        
                        return { 
                            updatedGame, 
                            code: 'DISCOVERED', 
                            data: { color, speciesId: randomSpecies, boardIndex: i } 
                        };
                    }

                    return { updatedGame, code: 'PLACED', data: { color, boardIndex: i } };
                }
            }
        }

        return { updatedGame, code: 'NO_SPACE' };
    }
}
