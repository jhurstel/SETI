import { effectNumber } from '../core/cardEffects';
import { cloneGame } from '../core/cloneGame';
import { Game, LifeTraceType, HistoryEntry, InteractionState, AlienBoardType, Bonus, Card, SectorNumber, SpeciesDiscoveryCode, LifeTraceLocation, Player, CentaurienMarker, Species } from '../core/types';
import { ResourceSystem } from './ResourceSystem';
import { getObjectPosition } from '../core/SolarSystemPosition';
import { CardSystem } from './CardSystem';
import { ProbeSystem } from './ProbeSystem';
import { uniqueId } from '../core/ids';
import { random } from '../core/random';

export class SpeciesSystem {
    /**
     * Palier Exertien atteint : le joueur joue face cachée l'une de ses cartes Exertiens
     * (son DANGER s'ajoute au sien), ou y renonce si cardId est absent.
     * Dans les deux cas, le palier est consommé pour ce joueur.
     */
    static playExertienCard(game: Game, playerId: string, milestone: number, cardId?: string): { updatedGame: Game; historyEntries: HistoryEntry[]; error?: string } {
        const updatedGame = cloneGame(game);
        const player = updatedGame.players.find(p => p.id === playerId);
        if (!player) return { updatedGame: game, historyEntries: [], error: 'Joueur introuvable' };

        let card: Card | undefined;
        if (cardId) {
            card = player.cards.find(c => c.id === cardId);
            if (!card || !CardSystem.isExertienCard(card)) {
                return { updatedGame: game, historyEntries: [], error: "Cette carte n'est pas une de vos cartes Exertiens" };
            }
        }

        player.claimedExertienMilestones = [...(player.claimedExertienMilestones || []), milestone];

        if (!card) {
            return { updatedGame, historyEntries: [{ message: `renonce à jouer une carte Exertien (palier ${milestone} PV)`, playerId }] };
        }

        player.cards = player.cards.filter(c => c.id !== card!.id);
        player.playedCards = [...(player.playedCards || []), card];
        player.danger = (player.danger || 0) + (card.danger || 0);
        return {
            updatedGame,
            historyEntries: [{ message: `joue une carte Exertien face cachée (palier ${milestone} PV)`, playerId }],
        };
    }

    /**
     * Spécimen Mascamite. « collect » retire le jeton de la planète et le place dans une capsule du joueur
     * sur la case de la planète (sa récompense sera gagnée en le ramenant à destination) ;
     * « consult » applique la récompense du jeton sans le retirer. Renvoie null s'il n'y a pas de jeton à cet index.
     */
    static takeMascamiteSpecimen(game: Game, playerId: string, planetId: string, tokenIndex: number, mode: 'collect' | 'consult', sequenceId: string): {
        updatedGame: Game;
        historyEntries: HistoryEntry[];
        newPendingInteractions: InteractionState[];
    } | null {
        const updatedGame = cloneGame(game);
        const planet = updatedGame.board.planets.find(p => p.id === planetId);
        const tokens = planet?.mascamiteTokens;
        if (!planet || !tokens || !tokens[tokenIndex]) return null;

        if (mode === 'collect') {
            const token = tokens.splice(tokenIndex, 1)[0];
            ProbeSystem.createCapsule(updatedGame, playerId, planetId, token);
            return {
                updatedGame,
                historyEntries: [{ message: `prélève un spécimen Mascamite sur ${planet.name} et le place dans une capsule`, playerId, sequenceId }],
                newPendingInteractions: [],
            };
        }

        const token = tokens[tokenIndex];
        const res = ResourceSystem.processBonuses(token.bonus, updatedGame, playerId, 'mascamite_specimen', sequenceId);
        return {
            updatedGame: res.updatedGame,
            historyEntries: [
                { message: `étudie un spécimen Mascamite sur ${planet.name}`, playerId, sequenceId },
                ...res.historyEntries.map(e => ({ ...e, sequenceId })),
            ],
            newPendingInteractions: res.newPendingInteractions,
        };
    }

    /**
     * Planètes dont le joueur peut consulter un spécimen : celle indiquée, Jupiter ou Saturne au choix (ET.8 à ET.10),
     * ou celles où il a une sonde (Étude de l'Écosystème) ; seulement s'il y reste des spécimens.
     */
    static consultablePlanets(game: Game, playerId: string, interaction: { planetId?: string; anyPlanet?: boolean }): string[] {
        const candidates = interaction.planetId ? [interaction.planetId] : ['jupiter', 'saturn'];
        return candidates.filter(id =>
            !!game.board.planets.find(p => p.id === id)?.mascamiteTokens?.length &&
            (interaction.planetId !== undefined || interaction.anyPlanet || !!ProbeSystem.findProbeAtPlanet(game, playerId, id))
        );
    }

    /** Traces de vie d'un joueur pour une espèce (piste, emplacements Découverte et excédentaires, FAQ Q38) */
    static playerTracesForSpecies(game: Game, playerId: string, speciesName: string) {
        const board = game.board.alienBoards.find(b => b.speciesId.toLowerCase() === speciesName.toLowerCase());
        return board ? board.lifeTraces.filter(t => t.playerId === playerId) : [];
    }

    /**
     * Placement automatique d'une trace de vie (robots) : la piste d'espèce n'est utilisée
     * qu'une fois l'espèce découverte, sinon la trace serait refusée et perdue.
     */
    static placeLifeTraceAuto(game: Game, requestedColor: LifeTraceType, playerId: string, sequenceId: string = '', boardIndices?: number[]) {
        // Premier emplacement accepté par le moteur, dans l'ordre de préférence de lifeTraceOptions
        for (const option of this.lifeTraceOptions(game, requestedColor)) {
            if (boardIndices && !boardIndices.includes(option.boardIndex)) continue;
            const res = this.placeLifeTrace(game, option.boardIndex, option.color, playerId, sequenceId, option.location, option.slotIndex);
            if (res.updatedGame !== game) return res;
        }
        return { updatedGame: game, historyEntries: [], newPendingInteractions: [] };
    }

    /**
     * Emplacements possibles pour une trace de vie, du plus intéressant au moins intéressant :
     * emplacement Découverte (triangle) d'une espèce non découverte où la couleur manque (rapproche la découverte,
     * et la 1re trace d'une couleur rapporte une carte Alien à la découverte), puis tous les emplacements libres
     * de la piste d'une espèce découverte (dans n'importe quel ordre : un emplacement trop cher en tokens
     * n'empêche pas d'en prendre un autre), puis les emplacements excédentaires (autres triangles).
     * Une trace « de n'importe quelle couleur » envisage les trois couleurs.
     */
    static lifeTraceOptions(game: Game, requestedColor: LifeTraceType): { boardIndex: number; color: LifeTraceType; location: LifeTraceLocation; slotIndex?: number }[] {
        const colors = requestedColor === LifeTraceType.ANY ? [LifeTraceType.RED, LifeTraceType.YELLOW, LifeTraceType.BLUE] : [requestedColor];
        const speciesSlots: ReturnType<typeof this.lifeTraceOptions> = [];
        const missingColorTriangles: ReturnType<typeof this.lifeTraceOptions> = [];
        const otherTriangles: ReturnType<typeof this.lifeTraceOptions> = [];

        game.board.alienBoards.forEach((board, boardIndex) => {
            for (const color of colors) {
                if (board.isDiscovered) {
                    this.freeSpeciesSlotIndices(game, boardIndex, color)
                        .forEach(slotIndex => speciesSlots.push({ boardIndex, color, location: LifeTraceLocation.SPECIES, slotIndex }));
                }
                const hasColor = board.lifeTraces.some(t => t.type === color);
                (hasColor || board.isDiscovered ? otherTriangles : missingColorTriangles).push({ boardIndex, color, location: LifeTraceLocation.TRIANGLE });
            }
        });
        return [...missingColorTriangles, ...speciesSlots, ...otherTriangles];
    }

    /**
     * Emplacements libres d'une couleur sur la piste d'une espèce découverte : chaque emplacement fixe libre,
     * puis le prochain de l'emplacement infini (qui s'empile).
     */
    /**
     * L'espèce a-t-elle des emplacements infinis (au-delà des emplacements fixes) pour cette couleur ?
     * Mascamites et Exertiens n'en ont pas (emplacement infini défini vide) : une fois la piste pleine,
     * les traces vont sur les emplacements excédentaires du plateau.
     */
    static hasInfiniteSlot(species: Species, color: LifeTraceType): boolean {
        const slot = color === LifeTraceType.RED ? species.infiniteSlots.redlifetrace
            : color === LifeTraceType.YELLOW ? species.infiniteSlots.yellowlifetrace : species.infiniteSlots.bluelifetrace;
        return Object.keys(slot).length > 0;
    }

    static freeSpeciesSlotIndices(game: Game, boardIndex: number, color: LifeTraceType): number[] {
        const board = game.board.alienBoards[boardIndex];
        const species = game.species.find(s => s.name === board.speciesId);
        if (!species) return [];
        const fixed = color === LifeTraceType.RED ? species.fixedSlots.redlifetrace
            : color === LifeTraceType.YELLOW ? species.fixedSlots.yellowlifetrace : species.fixedSlots.bluelifetrace;
        const taken = new Set(board.lifeTraces.filter(t => t.type === color && t.location === LifeTraceLocation.SPECIES).map(t => t.slotIndex));
        const free = fixed.map((_, i) => i).filter(i => !taken.has(i));
        if (!this.hasInfiniteSlot(species, color)) return free;
        let infiniteIndex = fixed.length;
        while (taken.has(infiniteIndex)) infiniteIndex++;
        return [...free, infiniteIndex];
    }

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
        let updatedGame = cloneGame(game);

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
                        id: `trace-neutral-${uniqueId()}`,
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
                        updatedGame.isSpeciesDiscovered = true;

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

                        if (board.speciesId === AlienBoardType.MASCAMITES) {
                            const mascamiteLogs = this.spawnMascamites(updatedGame);
                            distResult.logs.push(...mascamiteLogs);
                        }

                        if (board.speciesId === AlienBoardType.OUMUAMUA) {
                            if (!updatedGame.board.solarSystem.extraCelestialObjects) {
                                updatedGame.board.solarSystem.extraCelestialObjects = [];
                            }
                            updatedGame.board.solarSystem.extraCelestialObjects.push({ id: 'oumuamua', type: 'planet', name: 'Oumuamua', position: { disk: 'C', sector: 3, x: 0, y: 0 }, level: 1 });
                            distResult.logs.push("L'astéroïde Oumuamua apparaît dans le système solaire !");
                        }

                        if (board.speciesId === AlienBoardType.ANOMALIES) {
                            const anomalyLogs = this.spawnAnomalies(updatedGame);
                            distResult.logs.push(...anomalyLogs);
                        }

                        if (board.speciesId === AlienBoardType.CENTAURIENS) {
                            updatedGame.players.forEach(p => this.addCentaurienMarker(p));
                            distResult.logs.push("Les Centauriens envoient un message ! Chaque joueur place un palier à +15 PV.");
                        }

                        if (board.speciesId === AlienBoardType.EXERTIENS) {
                            const score = Math.max(...updatedGame.players.map(p => p.score));
                            if (!updatedGame.exertienMilestones) updatedGame.exertienMilestones = [];
                            updatedGame.exertienMilestones.push(score + 20);
                            updatedGame.exertienMilestones.push(score + 40);
                            distResult.logs.push("Deux nouveaus paliers à +20 PV et +40 PV apparaissent permettant d'utiliser la technologie des Exertiens.");
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
    static placeLifeTrace(game: Game, boardIndex: number, color: LifeTraceType, playerId: string, sequenceId: string = '', slotType: LifeTraceLocation, slotIndex?: number): {
        updatedGame: Game;
        historyEntries: HistoryEntry[];
        newPendingInteractions: InteractionState[];
    } {
        let updatedGame = cloneGame(game);
        const board = updatedGame.board.alienBoards[boardIndex];

        const player = updatedGame.players.find(p => p.id === playerId);

        if (!board || !player) {
            // Should not happen if called correctly
            return { updatedGame: game, historyEntries: [], newPendingInteractions: [] };
        }

        const species = updatedGame.species.find(s => s.name === board.speciesId);

        let bonusToApply: Bonus = {};
        let costText = '';

        if (slotType === LifeTraceLocation.TRIANGLE) {
            // Le joueur a cliqué sur le triangle. On compte combien de ses traces y sont déjà.
            const tracesOnTriangle = board.lifeTraces.filter(t => t.type === color && t.location === LifeTraceLocation.TRIANGLE).length;
            if (tracesOnTriangle === 0) {
                bonusToApply = board.firstBonus;
            } else {
                bonusToApply = board.nextBonus;
            }
        } else { // slotType === LifeTraceLocation.SPECIES
            if (!board.isDiscovered || !species) {
                return { updatedGame: game, historyEntries: [{ message: "Impossible de placer sur la piste d'espèce avant sa découverte.", playerId, sequenceId }], newPendingInteractions: [] };
            }

            let trackIndex = 0;
            if (slotIndex !== undefined) {
                trackIndex = slotIndex;
            } else {
                // Fallback (ne devrait pas arriver avec la nouvelle UI)
                const tracesOnSpeciesTrack = board.lifeTraces.filter(t => t.type === color && t.location === LifeTraceLocation.SPECIES).length;
                trackIndex = tracesOnSpeciesTrack;
            }

            const isOccupied = board.lifeTraces.some(t => t.type === color && t.location === LifeTraceLocation.SPECIES && t.slotIndex === trackIndex);
            if (isOccupied) {
                return { updatedGame: game, historyEntries: [{ message: "Emplacement déjà occupé.", playerId, sequenceId }], newPendingInteractions: [] };
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
                    historyEntries: [{ message: `Pas assez de tokens pour placer la trace.`, playerId, sequenceId }],
                    newPendingInteractions: []
                };
            }
            player.tokens = (player.tokens || 0) - cost;
            costText = ` et paye ${cost} token${cost > 1 ? 's' : ''}`;
        }

        // Add the trace to the board and the player
        board.lifeTraces.push({
            id: `trace-${uniqueId()}`,
            type: color,
            playerId: playerId,
            location: slotType,
            slotIndex: slotType === LifeTraceLocation.SPECIES ? (slotIndex !== undefined ? slotIndex : 0) : undefined
        });
        player.lifeTraces.push({
            id: `player-trace-${uniqueId()}`,
            type: color,
            playerId: playerId,
            location: slotType,
            slotIndex: slotType === LifeTraceLocation.SPECIES ? (slotIndex !== undefined ? slotIndex : 0) : undefined
        });
  
        // Check for species discovery
        const traces = board.lifeTraces;
        const hasRed = traces.some(t => t.type === LifeTraceType.RED);
        const hasYellow = traces.some(t => t.type === LifeTraceType.YELLOW);
        const hasBlue = traces.some(t => t.type === LifeTraceType.BLUE);

        let discoveryLogs: string[] = [];
        if (hasRed && hasYellow && hasBlue && !board.isDiscovered) {
            board.isDiscovered = true;
            updatedGame.isSpeciesDiscovered = true;
            
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

            if (board.speciesId === AlienBoardType.MASCAMITES) {
                const mascamiteLogs = this.spawnMascamites(updatedGame);
                discoveryLogs.push(...mascamiteLogs);
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

            if (board.speciesId === AlienBoardType.ANOMALIES) {
                const anomalyLogs = this.spawnAnomalies(updatedGame);
                discoveryLogs.push(...anomalyLogs);
            }

            if (board.speciesId === AlienBoardType.CENTAURIENS) {
                updatedGame.players.forEach(p => this.addCentaurienMarker(p));
                discoveryLogs.push("Les Centauriens envoient un message ! Chaque joueur place un palier à +15 PV.");
            }

            if (board.speciesId === AlienBoardType.EXERTIENS) {
                const score = Math.max(...updatedGame.players.map(p => p.score));
                if (!updatedGame.exertienMilestones) updatedGame.exertienMilestones = [];
                updatedGame.exertienMilestones.push(score + 20);
                updatedGame.exertienMilestones.push(score + 40);
                distResult.logs.push("Deux nouveaus paliers à +20 PV et +40 PV apparaissent permettant d'utiliser la technologie des Exertiens.");
            }
        }

        // Traitement des missions conditionnelles (GAIN_ON_TECH)
        const hasFulfillable = CardSystem.processMissionBuffs(player, buff => {
            if (color === LifeTraceType.YELLOW && buff.type === 'GAIN_ON_YELLOW_LIFETRACE') return true;
            if (color === LifeTraceType.RED && buff.type === 'GAIN_ON_RED_LIFETRACE') return true;
            if (color === LifeTraceType.BLUE && buff.type === 'GAIN_ON_BLUE_LIFETRACE') return true;
            if (color === LifeTraceType.ANY && (
                buff.type.includes('GAIN_ON_BLUE_LIFETRACE') ||
                buff.type.includes('GAIN_ON_YELLOW_LIFETRACE') ||
                buff.type.includes('GAIN_ON_RED_LIFETRACE')
            )) return true;
            return false;
        });

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

        if (hasFulfillable) {
            res.historyEntries.push({ message: 'déclenche une mission à recouvrir', playerId, sequenceId });
        }

        const scoringPlayer = updatedGame.players.find(p => p.id === playerId)!;

        // Piste Exertiens : le danger de l'emplacement s'ajoute à celui du joueur (affichage ; le décompte final le recalcule).
        // Valeur absolue : les anciennes sauvegardes stockaient ces dangers en négatif
        if (bonusToApply.danger) {
            scoringPlayer.danger = (scoringPlayer.danger || 0) + Math.abs(bonusToApply.danger);
        }

        // Carte 75 (Étude sur les Extrêmophiles) : 1 PV par trace de vie marquée de la couleur qui vient d'être gagnée
        const scorePerTraceBuffs = scoringPlayer.activeBuffs.filter(b => b.type === 'SCORE_PER_TRACE');
        if (scorePerTraceBuffs.length > 0) {
            const tracesOfColor = scoringPlayer.lifeTraces.filter(t => t.type === color).length;
            scorePerTraceBuffs.forEach(buff => {
                const points = tracesOfColor * (effectNumber(buff) || 1);
                scoringPlayer.score += points;
                res.historyEntries.push({ message: `gagne ${ResourceSystem.formatResource(points, 'PV')} (${tracesOfColor} trace${tracesOfColor > 1 ? 's' : ''} de vie ${color}, carte "${buff.source}")`, playerId, sequenceId });
            });
            scoringPlayer.activeBuffs = scoringPlayer.activeBuffs.filter(b => b.type !== 'SCORE_PER_TRACE');
        }

        return {
            updatedGame,
            historyEntries: res.historyEntries,
            newPendingInteractions: res.newPendingInteractions
        };
    }

    /**
     * Acquiert une carte Alien (depuis la pioche ou la rangée) et remplit la rangée si nécessaire.
     */
    static acquireAlienCard(game: Game, playerId: string, speciesId: string, cardId: string): { updatedGame: Game, drawnCard?: Card } {
        const updatedGame = cloneGame(game);
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
        const updatedGame = game;
        const board = updatedGame.board.alienBoards[boardIndex];
        const species = updatedGame.species.find(s => s.name === board.speciesId);
        if (!species) return { updatedGame, logs: [] };
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

        // Exertiens : chaque joueur reçoit en plus 3 cartes (species.name, l'id contient un suffixe unique)
        if (species.name === AlienBoardType.EXERTIENS) {
            updatedGame.players.forEach(p => {
                cardsPerPlayer[p.id] = (cardsPerPlayer[p.id] || 0) + 3;
            });
        }

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

    private static spawnMascamites(game: Game): string[] {
        const logs: string[] = [];
        const species = game.species.find(s => s.name === AlienBoardType.MASCAMITES);
        if (species && species.specimen) {
            const tokens = [...species.specimen];
            const shuffledTokens = ResourceSystem.shuffle(tokens);
            const saturnTokens = shuffledTokens.splice(0, 3);
            const jupiterTokens = shuffledTokens.splice(0, 3);
            const boardToken = shuffledTokens[0];

            const saturn = game.board.planets.find(p => p.id === 'saturn');
            if (saturn) saturn.mascamiteTokens = saturnTokens;

            const jupiter = game.board.planets.find(p => p.id === 'jupiter');
            if (jupiter) jupiter.mascamiteTokens = jupiterTokens;

            if (boardToken) species.fixedSlots.bluelifetrace[2] = boardToken.bonus;
            logs.push("Les Mascamites sont découverts ! Des spécimens apparaissent sur Jupiter et Saturne.");
        }
        return logs;
    }

    private static spawnAnomalies(game: Game): string[] {
        const logs: string[] = [];
        if (!game.board.solarSystem.extraCelestialObjects) {
            game.board.solarSystem.extraCelestialObjects = [];
        }

        const species = game.species.find(s => s.name === AlienBoardType.ANOMALIES);
        const tokens = species?.anomalie;

        if (tokens) {
            const shuffledTokens = ResourceSystem.shuffle(tokens);
            const solarSystem = game.board.solarSystem;
            const earthPos = getObjectPosition('earth', solarSystem.rotationAngleLevel1 || 0, solarSystem.rotationAngleLevel2 || 0, solarSystem.rotationAngleLevel3 || 0, solarSystem.extraCelestialObjects);

            if (earthPos) {
                const earthSector = earthPos.absoluteSector;
                const sectors = [
                    earthSector,
                    ((earthSector - 1 - 3 + 8) % 8) + 1,
                    ((earthSector - 1 + 3) % 8) + 1
                ];

                shuffledTokens.forEach((token, index) => {
                    const side = random() < 0.5 ? 'head' : 'tail';
                    const bonus = side === 'head' ? token.head : token.tail;
                    const sector = sectors[index] as SectorNumber;

                    game.board.solarSystem.extraCelestialObjects!.push({
                        id: `anomaly-${token.color}-${uniqueId()}-${index}`,
                        type: 'anomaly',
                        name: `Anomalie ${token.color}`,
                        position: { disk: 'D', sector: sector, x: 0, y: 0 },
                        level: 0,
                        anomalyData: { color: token.color, side, bonus }
                    });
                });
                logs.push("Des anomalies apparaissent en périphérie du système solaire !");
            }
        }
        return logs;
    }

    /** Place un palier de message Centaurien à +15 PV : message de l'espèce, ou réception d'une carte Centaurien */
    static addCentaurienMarker(player: Player, card?: Card): void {
        if (!player.centaurienMilestones) player.centaurienMilestones = [];
        player.centaurienMilestones.push({
            id: `centaurien-${player.id}-${player.centaurienMilestones.length}-${uniqueId()}`,
            score: player.score + 15,
            cardId: card?.id,
            cardName: card?.name,
        });
    }

    /** Premier palier Centaurien atteint et pas encore résolu */
    static reachedCentaurienMarker(player: Player): CentaurienMarker | undefined {
        return [...(player.centaurienMilestones || [])].sort((a, b) => a.score - b.score).find(m => !m.resolved && player.score >= m.score);
    }

    /**
     * Message de l'espèce décodé : le joueur choisit une tuile Message encore disponible.
     * La tuile retient qui l'a choisie, et le palier garde la récompense obtenue (affichée sur la piste de score).
     */
    static claimCentaurienReward(game: Game, playerId: string, tokenIndex: number, markerId?: string): { updatedGame: Game, historyEntries: HistoryEntry[], newPendingInteractions: InteractionState[] } {
        const updatedGame = cloneGame(game);
        const player = updatedGame.players.find(p => p.id === playerId);
        const species = updatedGame.species.find(s => s.name === AlienBoardType.CENTAURIENS);
        const token = species?.message?.[tokenIndex];
        if (!player || !token || !token.isAvailable) {
            return { updatedGame: game, historyEntries: [], newPendingInteractions: [] };
        }

        token.isAvailable = false;
        token.claimedBy = playerId;
        const label = (ResourceSystem.formatBonus(token.bonus) || []).join(', ');
        const marker = markerId
            ? player.centaurienMilestones.find(m => m.id === markerId)
            : this.reachedCentaurienMarker(player);
        if (marker) marker.resolved = `Message décodé : ${label}`;

        const sequenceId = `centaurien-${uniqueId()}`;
        const res = ResourceSystem.processBonuses(token.bonus, updatedGame, playerId, 'centaurien_message', sequenceId);
        const gains = res.logs.length > 0 ? ` : ${res.logs.join(', ')}` : '';
        return {
            updatedGame: res.updatedGame,
            historyEntries: [{ message: `déchiffre un message Centaurien et choisit « ${label} »${gains}`, playerId, sequenceId }, ...res.historyEntries],
            newPendingInteractions: res.newPendingInteractions || [],
        };
    }

    /**
     * Réception d'une carte Centaurien (son palier est atteint) : la carte est glissée sous le plateau pour
     * augmenter les revenus (avec la ressource gagnée immédiatement, FAQ), ou sa récompense est appliquée.
     */
    static receiveCentaurienCard(game: Game, playerId: string, markerId: string): { updatedGame: Game, historyEntries: HistoryEntry[], newPendingInteractions: InteractionState[] } {
        let updatedGame = cloneGame(game);
        const player = updatedGame.players.find(p => p.id === playerId);
        const marker = player?.centaurienMilestones.find(m => m.id === markerId);
        if (!player || !marker) return { updatedGame: game, historyEntries: [], newPendingInteractions: [] };

        const card = player.playedCards.find(c => c.id === marker.cardId);
        const sequenceId = `centaurien-${uniqueId()}`;
        const cardName = marker.cardName || card?.name || 'carte Centaurien';
        if (!card) {
            marker.resolved = `Réception (« ${cardName} ») : carte absente`;
            return { updatedGame, historyEntries: [], newPendingInteractions: [] };
        }

        if (card.passiveEffects.some(e => e.type === 'RECEPTION_REVENUE')) {
            // La carte passe des cartes jouées aux cartes réservées : son revenu augmente et la ressource est gagnée
            player.playedCards = player.playedCards.filter(c => c.id !== card.id);
            player.cards.push(card);
            const reserved = CardSystem.reserveCards(updatedGame, playerId, [card.id], sequenceId);
            updatedGame = reserved.updatedGame;
            const label = ResourceSystem.formatResource(1, CardSystem.revenueResource(card.revenue));
            updatedGame.players.find(p => p.id === playerId)!.centaurienMilestones.find(m => m.id === markerId)!.resolved = `Réception (« ${cardName} ») : revenu augmenté de ${label}`;
            return {
                updatedGame,
                historyEntries: [{ message: `reçoit le message de la carte « ${cardName} » : augmente ses revenus de ${label} et gagne ${label}`, playerId, sequenceId }],
                newPendingInteractions: [],
            };
        }

        const reception = card.passiveEffects.find(e => e.type === 'RECEPTION');
        const bonus = reception ? CardSystem.parseRewards(String(reception.value).split(':')) : {};
        const label = (ResourceSystem.formatBonus(bonus) || []).join(', ') || 'aucun effet';
        marker.resolved = `Réception (« ${cardName} ») : ${label}`;
        const res = ResourceSystem.processBonuses(bonus, updatedGame, playerId, 'centaurien_reception', sequenceId);
        const gains = res.logs.length > 0 ? ` : ${res.logs.join(', ')}` : '';
        return {
            updatedGame: res.updatedGame,
            historyEntries: [{ message: `reçoit le message de la carte « ${cardName} »${gains}`, playerId, sequenceId }, ...res.historyEntries],
            newPendingInteractions: res.newPendingInteractions || [],
        };
    }
}
