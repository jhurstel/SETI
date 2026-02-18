import { Game, LifeTraceType, HistoryEntry, InteractionState, AlienBoardType, Bonus, Card } from '../core/types';
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

                        // Remplir la rangée de carte de l'espèce
                        const species = updatedGame.species.find(s => s.name === board.speciesId);
                        if (species) {
                            if (!species.cardRow) species.cardRow = [];
                            if (species.cards.length > 0 && species.cardRow.length < 1) {
                                const card = species.cards.shift();
                                if (card) {
                                    species.cardRow.push(card);
                                }
                            }
                        }

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
    static placeLifeTrace(game: Game, boardIndex: number, color: LifeTraceType, playerId: string, sequenceId: string = '', slotType: 'triangle' | 'species', slotIndex?: number): { 
        updatedGame: Game; 
        isDiscovered: boolean;
        speciesId?: string;
        historyEntries: HistoryEntry[];
        newPendingInteractions: InteractionState[];
    } {
        let updatedGame = structuredClone(game);
        const board = updatedGame.board.alienBoards[boardIndex];
        
        const player = updatedGame.players.find(p => p.id === playerId);
        
        if (!board || !player) {
            // Should not happen if called correctly
            return { updatedGame: game, isDiscovered: false, historyEntries: [], newPendingInteractions: [] };
        }

        const species = updatedGame.species.find(s => s.name === board.speciesId);

        let bonusToApply: Bonus = {};
        let costText = '';

        if (slotType === 'triangle') {
            // Le joueur a cliqué sur le triangle. On compte combien de ses traces y sont déjà.
            // On inclut `location === undefined` pour la compatibilité avec les anciennes données de sauvegarde.
            const tracesOnTriangle = board.lifeTraces.filter(t => t.playerId === playerId && t.type === color && (t.location === 'triangle' || t.location === undefined)).length;
            if (tracesOnTriangle === 0) {
                bonusToApply = board.firstBonus;
            } else {
                bonusToApply = board.nextBonus;
            }
        } else { // slotType === 'species'
            if (!board.isDiscovered || !species) {
                return { updatedGame: game, isDiscovered: false, historyEntries: [{ message: "Impossible de placer sur la piste d'espèce avant sa découverte.", playerId, sequenceId }], newPendingInteractions: [] };
            }

            let trackIndex = 0;
            if (slotIndex !== undefined) {
                trackIndex = slotIndex;
            } else {
                // Fallback (ne devrait pas arriver avec la nouvelle UI)
                const tracesOnSpeciesTrack = board.lifeTraces.filter(t => t.playerId === playerId && t.type === color && t.location === 'species').length;
                trackIndex = tracesOnSpeciesTrack;
            }

            const isOccupied = board.lifeTraces.some(t => t.type === color && t.location === 'species' && t.slotIndex === trackIndex);
            if (isOccupied) {
                return { updatedGame: game, isDiscovered: false, historyEntries: [{ message: "Emplacement déjà occupé.", playerId, sequenceId }], newPendingInteractions: [] };
            }
            
            // Déterminer le bonus en fonction de l'index sur la piste
            const { fixedSlots, infiniteSlots } = species;
            const trackSlots = (color === LifeTraceType.RED) ? fixedSlots.redlifetrace : (color === LifeTraceType.YELLOW) ? fixedSlots.yellowlifetrace : fixedSlots.bluelifetrace;
            const infiniteSlot = (color === LifeTraceType.RED) ? infiniteSlots.redlifetrace : (color === LifeTraceType.YELLOW) ? infiniteSlots.yellowlifetrace : infiniteSlots.bluelifetrace;
            const fixedSlotCount = trackSlots.length;

            if (trackIndex < fixedSlotCount) {
                bonusToApply = trackSlots[trackIndex];
            } else {
                bonusToApply = infiniteSlot;
            }
        }

        // Handle costs
        if (typeof bonusToApply.token === 'number' && bonusToApply.token < 0) {
            const cost = Math.abs(bonusToApply.token);
            if ((player.tokens || 0) < cost) {
                return { 
                    updatedGame: game, 
                    isDiscovered: false, 
                    historyEntries: [{ message: `Pas assez de tokens pour placer la trace.`, playerId, sequenceId }],
                    newPendingInteractions: [] 
                };
            }
            player.tokens = (player.tokens || 0) - cost;
            costText = ` et paye ${cost} token${cost > 1 ? 's' : ''}`;
        }

        // Add the trace to the board and the player
        board.lifeTraces.push({ 
            id: `trace-${Date.now()}`, 
            type: color, 
            playerId: playerId,
            location: slotType,
            slotIndex: slotType === 'species' ? (slotIndex !== undefined ? slotIndex : 0) : undefined
        });
        player.lifeTraces.push({
            id: `player-trace-${Date.now()}`,
            type: color,
            playerId: playerId,
            location: slotType,
            slotIndex: slotType === 'species' ? (slotIndex !== undefined ? slotIndex : 0) : undefined
        });

        // Check for species discovery
        const traces = board.lifeTraces;
        const hasRed = traces.some(t => t.type === LifeTraceType.RED);
        const hasYellow = traces.some(t => t.type === LifeTraceType.YELLOW);
        const hasBlue = traces.some(t => t.type === LifeTraceType.BLUE);

        let discoveryLogs: string[] = [];
        let wasDiscoveredThisTurn = false;
        if (hasRed && hasYellow && hasBlue && !board.isDiscovered) {
            wasDiscoveredThisTurn = true;
            board.isDiscovered = true;
            const distResult = this.distributeDiscoveryCards(updatedGame, boardIndex);
            updatedGame = distResult.updatedGame;
            discoveryLogs = distResult.logs;

            // Remplir la rangée de carte de l'espèce
            const discoveredSpecies = updatedGame.species.find(s => s.name === board.speciesId);
            if (discoveredSpecies) {
                if (!discoveredSpecies.cardRow) discoveredSpecies.cardRow = [];
                if (discoveredSpecies.cards.length > 0 && discoveredSpecies.cardRow.length < 1) {
                    const card = discoveredSpecies.cards.shift();
                    if (card) {
                        discoveredSpecies.cardRow.push(card);
                    }
                }
            }

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

        // Process bonuses
        const res = ResourceSystem.processBonuses(bonusToApply, updatedGame, playerId, 'lifetrace', sequenceId, species?.id);
        updatedGame = res.updatedGame;

        const boardSideText = (boardIndex === 0) ? "gauche" : "droit";
        let mainLog = `place une trace de vie ${color} sur le plateau Alien ${boardSideText}${costText}`;
        if (res.logs.length > 0) {
            mainLog += ` et ${res.logs.join(' et ')}`;
        }
        if (discoveryLogs.length > 0) {
            mainLog += `. ${discoveryLogs.join('. ')}`;
        }

        res.historyEntries.unshift({ message: mainLog, playerId, sequenceId });

        return { 
            updatedGame, 
            isDiscovered: wasDiscoveredThisTurn,
            speciesId: board.speciesId,
            historyEntries: res.historyEntries,
            newPendingInteractions: res.newPendingInteractions
        };
    }

    /**
     * Acquiert une carte Alien (depuis la pioche ou la rangée) et remplit la rangée si nécessaire.
     */
    static acquireAlienCard(game: Game, playerId: string, speciesId: string, cardId: string): { updatedGame: Game, drawnCard?: Card } {
        let updatedGame = structuredClone(game);
        const species = updatedGame.species.find(s => s.id === speciesId);
        const player = updatedGame.players.find(p => p.id === playerId);

        if (!species || !player) return { updatedGame };

        let drawnCard: Card | undefined;

        if (cardId === 'deck') {
            if (species.cards.length > 0) {
                drawnCard = species.cards.shift();
            }
        } else {
            if (species.cardRow) {
                const index = species.cardRow.findIndex(c => c.id === cardId);
                if (index !== -1) {
                    drawnCard = species.cardRow.splice(index, 1)[0];
                    // Remplir la rangée immédiatement
                    if (species.cards.length > 0) {
                        const newCard = species.cards.shift();
                        if (newCard) species.cardRow.push(newCard);
                    }
                }
            }
        }

        if (drawnCard) {
            player.cards.push(drawnCard);
        }

        return { updatedGame, drawnCard };
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
