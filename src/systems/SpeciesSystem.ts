import { Game, LifeTraceType, HistoryEntry, InteractionState } from '../core/types';
import { ResourceSystem } from './ResourceSystem';

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

    /**
    * Place une trace de vie sur un plateau Alien et gère la découverte d'espèce
    */
    static placeLifeTrace(game: Game, boardIndex: number, color: LifeTraceType, playerId: string, sequenceId: string = ''): { 
        updatedGame: Game; 
        isDiscovered: boolean; 
        speciesId?: string;
        historyEntries: HistoryEntry[];
        newPendingInteractions: InteractionState[];
    } {
        let updatedGame = structuredClone(game);
        const board = updatedGame.board.alienBoards[boardIndex];
        
        if (!board) {
            throw new Error(`Alien board ${boardIndex} not found`);
        }

        // Ajouter la trace
        board.lifeTraces.push({ 
            id: `trace-${Date.now()}`, 
            type: color, 
            playerId: playerId 
        });

        // Vérifier découverte espèce (si on a les 3 couleurs et pas encore d'espèce)
        let isDiscovered = false;
        const traces = board.lifeTraces;
        const hasRed = traces.some(t => t.type === LifeTraceType.RED);
        const hasYellow = traces.some(t => t.type === LifeTraceType.YELLOW);
        const hasBlue = traces.some(t => t.type === LifeTraceType.BLUE);

        if (hasRed && hasYellow && hasBlue && !board.speciesId) {
            const ALIEN_SPECIES = ['Centauriens', 'Exertiens', 'Oumuamua'];
            const randomSpecies = ALIEN_SPECIES[Math.floor(Math.random() * ALIEN_SPECIES.length)];
            board.speciesId = randomSpecies;
            isDiscovered = true;
        }

        // Calculer le bonus (1ère fois ou suivantes)
        const track = traces.filter(t => t.type === color);
        const isFirst = track.length === 1;
        const bonus = isFirst ? board.firstBonus : board.nextBonus;

        // Process bonuses
        const res = ResourceSystem.processBonuses(bonus, updatedGame, playerId, 'lifetrace', sequenceId);
        updatedGame = res.updatedGame;

        const orderText = (boardIndex === 0) ? "gauche" : " droit";
        let mainLog = `place une trace de vie ${color} sur le plateau Alien ${orderText}`;
        if (res.logs.length > 0) {
            mainLog += ` et ${res.logs.join(' et ')}`;
        }

        res.historyEntries.unshift({ message: mainLog, playerId, sequenceId });

        return { 
            updatedGame, 
            isDiscovered, 
            speciesId: board.speciesId,
            historyEntries: res.historyEntries,
            newPendingInteractions: res.newPendingInteractions
        };
    }

}
