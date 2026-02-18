import { Game, LifeTraceType, HistoryEntry, InteractionState, AlienBoardType } from '../core/types';
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
        logs?: string[];
    } {
        let updatedGame = structuredClone(game);

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

                    if (hasRed && hasYellow && hasBlue && !board.isDiscovered) {
                        board.isDiscovered = true;
                        
                        const distResult = this.distributeDiscoveryCards(updatedGame, i);
                        updatedGame = distResult.updatedGame;

                        // Ajout de l'astéroïde Oumuamua si l'espèce est découverte
                        if (board.speciesId === AlienBoardType.OUMUAMUA) {
                            if (!updatedGame.board.solarSystem.extraCelestialObjects) {
                                updatedGame.board.solarSystem.extraCelestialObjects = [];
                            }
                            // Disque 1 (Level 1), 2 crans avant Jupiter (C5) -> C3
                            // C3 est un creux, donc l'objet flottera au-dessus
                            updatedGame.board.solarSystem.extraCelestialObjects.push({ id: 'oumuamua', type: 'planet', name: 'Oumuamua', position: { disk: 'C', sector: 3, x: 0, y: 0 }, level: 1 });
                            distResult.logs.push("L'astéroïde Oumuamua apparaît dans le système solaire !");
                        }

                        return { 
                            updatedGame, 
                            code: 'DISCOVERED', 
                            data: { color, speciesId: board.speciesId, boardIndex: i },
                            logs: distResult.logs
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
        const traces = board.lifeTraces;
        const hasRed = traces.some(t => t.type === LifeTraceType.RED);
        const hasYellow = traces.some(t => t.type === LifeTraceType.YELLOW);
        const hasBlue = traces.some(t => t.type === LifeTraceType.BLUE);

        let discoveryLogs: string[] = [];
        if (hasRed && hasYellow && hasBlue && !board.isDiscovered) {
            board.isDiscovered = true;
            const distResult = this.distributeDiscoveryCards(updatedGame, boardIndex);
            updatedGame = distResult.updatedGame;
            discoveryLogs = distResult.logs;

            // Ajout de la planète Oumuamua (astéroïde) si l'espèce est découverte
            if (board.speciesId === AlienBoardType.OUMUAMUA) {
                if (!updatedGame.board.solarSystem.extraCelestialObjects) {
                    updatedGame.board.solarSystem.extraCelestialObjects = [];
                }
                // Disque 1 (Level 1), 2 crans avant Jupiter (C5) -> C3
                // C3 est un creux, donc l'objet flottera au-dessus
                updatedGame.board.solarSystem.extraCelestialObjects.push({ id: 'oumuamua', type: 'planet', name: 'Oumuamua', position: { disk: 'C', sector: 3, x: 0, y: 0 }, level: 1 });
                discoveryLogs.push("L'astéroïde Oumuamua apparaît dans le système solaire !");
            }
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
        if (discoveryLogs.length > 0) {
            mainLog += `. ${discoveryLogs.join('. ')}`;
        }

        res.historyEntries.unshift({ message: mainLog, playerId, sequenceId });

        return { 
            updatedGame, 
            isDiscovered: board.isDiscovered,
            speciesId: board.speciesId,
            historyEntries: res.historyEntries,
            newPendingInteractions: res.newPendingInteractions
        };
    }

    private static distributeDiscoveryCards(game: Game, boardIndex: number): { updatedGame: Game, logs: string[] } {
        let updatedGame = game;
        const board = updatedGame.board.alienBoards[boardIndex];
        const species = updatedGame.species.find(s => s.name === board.speciesId);
        const logs: string[] = [];
        const colors = [LifeTraceType.RED, LifeTraceType.YELLOW, LifeTraceType.BLUE];
        const cardsPerPlayer: Record<string, number> = {};

        colors.forEach(color => {
            const traces = board.lifeTraces.filter(t => t.type === color);
            if (traces.length > 0) {
                const firstTrace = traces[0];
                if (firstTrace.playerId !== 'neutral') {
                    cardsPerPlayer[firstTrace.playerId] = (cardsPerPlayer[firstTrace.playerId] || 0) + 1;
                }
            }
        });

        for (const [playerId, count] of Object.entries(cardsPerPlayer)) {
            const player = updatedGame.players.find(p => p.id === playerId);
            if (player && species) {
                let drawnCount = 0;
                const drawnCardNames: string[] = [];
                for (let i = 0; i < count; i++) {
                    const card = species.cards.shift();
                    if (card) {
                        player.cards.push(card);
                        drawnCount++;
                        drawnCardNames.push(card.name);
                    }
                }
                if (drawnCount > 0) {
                    const cardsStr = drawnCardNames.map(name => `"${name}"`).join(', ');
                    logs.push(`${player.name} pioche ${drawnCount} carte${drawnCount > 1 ? 's' : ''} Alien ${cardsStr} (Découverte)`);
                }
            }
        }
        
        return { updatedGame, logs };
    }
}
