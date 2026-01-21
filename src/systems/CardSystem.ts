import { Game, Card, Player, ProbeState, FreeActionType, GAME_CONSTANTS, RevenueType } from '../core/types';
import { 
    createRotationState, 
    calculateAbsolutePosition, 
    getCell, 
    getAdjacentCells,
    CelestialObject,
    getObjectPosition,
    getAllCelestialObjects
} from '../core/SolarSystemPosition';

export class CardSystem {
  /**
   * Pioche des cartes pour un joueur
   */
  static drawCards(game: Game, playerId: string, count: number, source: string): Game {
    const updatedGame = structuredClone(game);
    const player = updatedGame.players.find(p => p.id === playerId);
    if (!player) return game;

    source;
    for (let i = 0; i < count; i++) {
      if (updatedGame.decks.cards.length > 0) {
        const card = updatedGame.decks.cards.shift();
        if (card) {
          player.cards.push(card);
        }
      }
    }

    return updatedGame;
  }

  /**
   * Réserve une carte
   */
  static reserveCard(game: Game, playerId: string, cardId: string): Game {
    let updatedGame = structuredClone(game);
    const playerIndex = updatedGame.players.findIndex(p => p.id === playerId);
    if (playerIndex === -1) return game;
    let player = updatedGame.players[playerIndex];

    const card = player.cards.find(c => c.id === cardId);
    if (!card) return game;

    // Retirer la carte
    player = this.discardCard(player, cardId);
    updatedGame.players[playerIndex] = player;
    
    // Appliquer le revenu et le bonus immédiat
    if (card.revenue === RevenueType.CREDIT) {
        player.revenueCredits += 1;
        player.credits += 1;
    } else if (card.revenue === RevenueType.ENERGY) {
        player.revenueEnergy += 1;
        player.energy += 1;
    } else if (card.revenue === RevenueType.CARD) {
        player.revenueCards += 1;
        updatedGame = this.drawCards(updatedGame, playerId, 1, "Réservation");
    }

    return updatedGame
  }

  /**
   * Vérifie si un joueur peut défausser une carte
   */
  static canDiscardFreeAction(game: Game, playerId: string, freeAction: FreeActionType):
  { canDiscard: boolean, reason: string } {
    const player = game.players.find(p => p.id === playerId);
    if (!player) {
      return { canDiscard: false, reason: "Joueur non trouvé" };
    }

    if (game.players[game.currentPlayerIndex].id !== playerId) {
      return { canDiscard: false, reason: "Ce n'est pas votre tour" };
    }

    if (freeAction === FreeActionType.MOVEMENT) {
      if (!(player.probes || []).some(p => p.state === ProbeState.IN_SOLAR_SYSTEM)) {
        return { canDiscard: false, reason : "Nécessite une sonde dans le système solaire" };
      } else {
        return { canDiscard: true, reason: "Défausser pour gagner 1 Déplacement" };
      }
    } else if (freeAction === FreeActionType.DATA) {
      if ((player.data || 0) >= GAME_CONSTANTS.MAX_DATA) {
        return { canDiscard: false, reason : "Nécessite de transférer des données" };
      } else {
        return { canDiscard: true, reason: "Défausser pour gagner 1 Donnée" };
      }
    } else if (freeAction === FreeActionType.MEDIA) {
      if (player.mediaCoverage >= GAME_CONSTANTS.MAX_MEDIA_COVERAGE) {
        return { canDiscard: false, reason: "Média au maximum" };
      } else {
        return { canDiscard: true, reason: "Défausser pour gagner 1 Média" };
      }
    }

    return {canDiscard: true, reason: "Action inconnue" };
  }

  /**
   * Vérifie si un joueur peut jouer au moins une carte de sa main
   */
  static canPlayCards(
    game: Game, 
    playerId: string, 
  ): { canPlay: boolean, reason: string } {
    const player = game.players.find(p => p.id === playerId);
    if (!player) {
      return { canPlay: false, reason: "Joueur non trouvé" };
    }

    if (player.cards.length === 0) {
      return { canPlay: false, reason: "Aucune carte en main" };
    }

    return player.cards.some(card => this.canPlayCard(game, playerId, card).canPlay)
      ? { canPlay: true, reason: "Au moins une carte peut être jouée" }
      : { canPlay: false, reason: "Aucune carte ne peut être jouée" };
  }

  /**
   * Vérifie si un joueur peut jouer une carte
   */
  static canPlayCard(
    game: Game, 
    playerId: string, 
    card: Card
  ): { canPlay: boolean, reason: string } {
    const player = game.players.find(p => p.id === playerId);
    if (!player) {
      return { canPlay: false, reason: "Joueur non trouvé" };
    }

    if (game.players[game.currentPlayerIndex].id !== playerId) {
      return { canPlay: false, reason: "Ce n'est pas votre tour" };
    }

    if (player.credits < card.cost) {
      return { canPlay: false, reason: `Crédits insuffisants (coût: ${card.cost} crédit${card.cost > 1 ? 's' : ''})` };
    }

    // Vérification si la carte donne des déplacements
    const hasMovementEffect = card.immediateEffects?.some(e => e.type === 'ACTION' && e.target === 'MOVEMENT');
    if (hasMovementEffect) {
      const hasProbeInSystem = player.probes.some(p => p.state === ProbeState.IN_SOLAR_SYSTEM);
      if (!hasProbeInSystem) {
        return { canPlay: false, reason: "Nécessite une sonde dans le système solaire" };
      }
    }

    // TODO: Ajouter d'autres conditions de carte ici
    return { canPlay: true, reason: `Jouer la carte (coût: ${card.cost} crédit${card.cost > 1 ? 's' : ''})` };
  }

  /**
   * Joue une carte de la main du joueur
   */
  static playCard(game: Game, playerId: string, cardId: string): { updatedGame: Game, error?: string, bonuses?: any } {
    let updatedGame = structuredClone(game);
    const player = updatedGame.players.find(p => p.id === playerId);

    if (!player) return { updatedGame: game, error: "Joueur non trouvé" };

    const cardIndex = player.cards.findIndex(c => c.id === cardId);
    if (cardIndex === -1) return { updatedGame: game, error: "Carte non trouvée en main" };

    const card = player.cards[cardIndex];

    // Vérification du coût
    if (player.credits < card.cost) {
        return { updatedGame: game, error: "Crédits insuffisants" };
    }

    // Payer le coût
    player.credits -= card.cost;

    // Retirer la carte de la main
    player.cards.splice(cardIndex, 1);

    // Ajouter aux cartes jouées (pour les effets passifs/tags)
    // Note: Dans SETI, les cartes jouées vont souvent dans un tableau personnel ou sont défaussées selon le type.
    // Ici on suppose qu'elles restent actives pour les passifs ou sont défaussées si instantanées.
    // Pour simplifier, on ne les stocke pas dans une liste "playedCards" explicite dans Player pour l'instant,
    // mais on applique les effets immédiats.
    
    // Traitement des effets immédiats
    const bonuses: any = {};

    if (card.immediateEffects) {
        card.immediateEffects.forEach(effect => {
        if (effect.type === 'GAIN') {
            switch (effect.target) {
            case 'CREDIT':
                player.credits += effect.value;
                bonuses.credits = (bonuses.credits || 0) + effect.value;
                break;
            case 'ENERGY':
                player.energy += effect.value;
                bonuses.energy = (bonuses.energy || 0) + effect.value;
                break;
            case 'DATA':
                player.data = (player.data || 0) + effect.value;
                bonuses.data = (bonuses.data || 0) + effect.value;
                break;
            case 'MEDIA':
                player.mediaCoverage += effect.value;
                bonuses.media = (bonuses.media || 0) + effect.value;
                break;
            case 'CARD':
                bonuses.card = (bonuses.card || 0) + effect.value;
                break;
            case 'PROBE':
                bonuses.probe = (bonuses.probe || 0) + effect.value;
                break;
            }
        } else if (effect.type === 'ACTION') {
            switch (effect.target) {
                case 'ANYCARD':
                    bonuses.anycard = (bonuses.anycard || 0) + effect.value;
                    break;
                case 'ROTATION':
                    bonuses.rotation = (bonuses.rotation || 0) + effect.value;
                    break;
                case 'LAND':
                    bonuses.landing = (bonuses.landing || 0) + effect.value;
                    break;
                case 'MOVEMENT':
                    bonuses.movements = (bonuses.movements || 0) + effect.value;
                    break;
                case 'TECH':
                    if (typeof effect.value === 'object' && effect.value !== null) {
                        bonuses.technology = {
                            amount: (bonuses.technology?.amount || 0) + effect.value.amount,
                            color: effect.value.color // last one wins, which is fine for single tech bonus
                        };
                    } else { // fallback for old format
                        bonuses.technology = { amount: (bonuses.technology?.amount || 0) + effect.value };
                    }
                    break;
                case 'GAIN_SIGNAL':
                    if (!bonuses.gainSignal) bonuses.gainSignal = [];
                    bonuses.gainSignal.push(effect.value);
                    break;
            }
        }
        });
    }

    // Traitement des effets passifs temporaires (Buffs de tour)
    if (card.passiveEffects) {
        card.passiveEffects.forEach(effect => {
            if (effect.type === 'VISIT_BONUS' && effect.target) {
                // Si la planète a DÉJÀ été visitée ce tour-ci, on applique le bonus immédiatement
                if (player.visitedPlanetsThisTurn.includes(effect.target)) {
                    player.score += effect.value;
                    if (!bonuses.pv) bonuses.pv = 0;
                    bonuses.pv += effect.value;
                } else {
                    // Sinon on ajoute le buff pour le reste du tour
                    player.activeBuffs.push({ ...effect, source: card.name });
                }
            } else if (effect.type === 'VISIT_UNIQUE') {
                player.activeBuffs.push({ ...effect, source: card.name });
            } else if (effect.type === 'ASTEROID_EXIT_COST') {
                player.activeBuffs.push({ ...effect, source: card.name });
            } else if (effect.type === 'VISIT_ASTEROID') {
                player.activeBuffs.push({ ...effect, source: card.name });
            } else if (effect.type === 'VISIT_COMET') {
                player.activeBuffs.push({ ...effect, source: card.name });
            } else if (effect.type === 'SAME_DISK_MOVE') {
                player.activeBuffs.push({ ...effect, source: card.name });
            } else if (effect.type === 'REVEAL_AND_TRIGGER_FREE_ACTION') {
                bonuses.revealAndTriggerFreeAction = true;
            } else if (effect.type === 'SCORE_PER_MEDIA') {
                bonuses.scorePerMedia = effect.value;
            } else if (effect.type === 'SCORE_PER_TECH_TYPE') {
                player.activeBuffs.push({ ...effect, source: card.name });
            } else if (effect.type === 'MEDIA_IF_SHARED_TECH') {
                player.activeBuffs.push({ ...effect, source: card.name });
            } else if (effect.type === 'SHARED_TECH_ONLY_NO_BONUS') {
                if (bonuses.technology) {
                    bonuses.technology.sharedOnly = true;
                    bonuses.technology.noTileBonus = true;
                }
            } else if (effect.type === 'GAIN_ENERGY_PER_ENERGY_REVENUE') {
                let energyCardsCount = 0;
                player.cards.forEach(c => {
                    if (c.revenue === RevenueType.ENERGY) {
                        c.isRevealed = true;
                        energyCardsCount++;
                    }
                });
                if (energyCardsCount > 0) {
                    player.energy += energyCardsCount;
                    bonuses.energy = (bonuses.energy || 0) + energyCardsCount;
                }
            } else if (effect.type === 'REVEAL_MOVEMENT_CARDS_FOR_BONUS') {
                let movementCardsCount = 0;
                player.cards.forEach(c => {
                    if (c.freeAction === FreeActionType.MOVEMENT) {
                        c.isRevealed = true;
                        movementCardsCount++;
                    }
                });
                if (movementCardsCount > 0) {
                    bonuses.probe = (bonuses.probe || 0) + movementCardsCount;
                    bonuses.movements = (bonuses.movements || 0) + movementCardsCount;
                }
            } else if (effect.type === 'GAIN_ENERGY_PER_REVENUE_ENERGY_AND_RESERVE') {
                const energyRevCards = player.revenueEnergy - GAME_CONSTANTS.INITIAL_REVENUE_ENERGY;
                if (energyRevCards > 0) {
                    player.energy += energyRevCards;
                    bonuses.energy = (bonuses.energy || 0) + energyRevCards;
                }
                // Reserve self (Energy)
                player.revenueEnergy += 1;
                player.energy += 1; // Immediate gain from reservation
                bonuses.energy = (bonuses.energy || 0) + 1;
            } else if (effect.type === 'GAIN_MEDIA_PER_REVENUE_CARD_AND_RESERVE') {
                const cardRevCards = player.revenueCards - GAME_CONSTANTS.INITIAL_REVENUE_CARDS;
                if (cardRevCards > 0) {
                    player.mediaCoverage = Math.min(player.mediaCoverage + cardRevCards, GAME_CONSTANTS.MAX_MEDIA_COVERAGE);
                    bonuses.media = (bonuses.media || 0) + cardRevCards;
                }
                // Reserve self (Card)
                player.revenueCards += 1;
                // Immediate gain from reservation (Draw 1 card)
                updatedGame = CardSystem.drawCards(updatedGame, playerId, 1, 'Bonus réservation');
                bonuses.card = (bonuses.card || 0) + 1;
            } else if (effect.type === 'GAIN_PV_PER_REVENUE_CREDIT_AND_RESERVE') {
                const creditRevCards = player.revenueCredits - GAME_CONSTANTS.INITIAL_REVENUE_CREDITS;
                if (creditRevCards > 0) {
                    const pvGain = creditRevCards * 3;
                    player.score += pvGain;
                    bonuses.pv = (bonuses.pv || 0) + pvGain;
                }
                // Reserve self (Credit)
                player.revenueCredits += 1;
                player.credits += 1; // Immediate gain from reservation
                bonuses.credits = (bonuses.credits || 0) + 1;
            } else if (effect.type === 'OPTIMAL_LAUNCH_WINDOW') {
                const rotationState = createRotationState(
                    updatedGame.board.solarSystem.rotationAngleLevel1 || 0,
                    updatedGame.board.solarSystem.rotationAngleLevel2 || 0,
                    updatedGame.board.solarSystem.rotationAngleLevel3 || 0
                );

                const earthPos = getObjectPosition('earth', rotationState.level1Angle, rotationState.level2Angle, rotationState.level3Angle);
                if (earthPos) {
                    let movementBonus = 0;
                    const allObjects = getAllCelestialObjects();

                    allObjects.forEach(obj => {
                        if (obj.id === 'earth') return;
                        if (obj.type !== 'planet' && obj.type !== 'comet') return;

                        const objPos = calculateAbsolutePosition(obj, rotationState);
                        if (objPos.isVisible && objPos.disk === earthPos.disk && objPos.absoluteSector === earthPos.absoluteSector) {
                            movementBonus++;
                        }
                    });

                    if (movementBonus > 0) {
                        bonuses.movements = (bonuses.movements || 0) + movementBonus;
                    }
                }
            } else if (effect.type === 'IGNORE_PROBE_LIMIT') {
                bonuses.ignoreProbeLimit = true;
            } else if (effect.type === 'CHOICE_MEDIA_OR_MOVE') {
                player.activeBuffs.push({ ...effect, source: card.name });
            } else if (effect.type === 'OSIRIS_REX_BONUS') {
                let maxDataBonus = 0;
                const rotationState = createRotationState(
                    updatedGame.board.solarSystem.rotationAngleLevel1 || 0,
                    updatedGame.board.solarSystem.rotationAngleLevel2 || 0,
                    updatedGame.board.solarSystem.rotationAngleLevel3 || 0
                );

                player.probes.filter(p => p.state === ProbeState.IN_SOLAR_SYSTEM && p.solarPosition).forEach(probe => {
                    let currentProbeBonus = 0;
                    
                    // Get absolute position of the probe
                    const tempObj: CelestialObject = {
                        id: probe.id,
                        type: 'empty', // type doesn't matter for position calculation
                        name: 'probe',
                        position: {
                            disk: probe.solarPosition!.disk,
                            sector: probe.solarPosition!.sector,
                            x: 0, y: 0
                        },
                        level: (probe.solarPosition!.level || 0) as 0 | 1 | 2 | 3
                    };
                    const absPos = calculateAbsolutePosition(tempObj, rotationState);

                    // Check current cell: +2 data if on an asteroid field
                    const currentCell = getCell(absPos.disk, absPos.absoluteSector, rotationState);
                    if (currentCell && currentCell.hasAsteroid) {
                        currentProbeBonus += 2;
                    }

                    // Check adjacent cells: +1 data for each adjacent asteroid field
                    const adjacentCellsInfo = getAdjacentCells(absPos.disk, absPos.absoluteSector);
                    adjacentCellsInfo.forEach(adj => {
                        const adjCell = getCell(adj.disk, adj.sector, rotationState);
                        if (adjCell && adjCell.hasAsteroid) {
                            currentProbeBonus += 1;
                        }
                    });

                    if (currentProbeBonus > maxDataBonus) {
                        maxDataBonus = currentProbeBonus;
                    }
                });

                if (maxDataBonus > 0) {
                    player.data = Math.min((player.data || 0) + maxDataBonus, GAME_CONSTANTS.MAX_DATA);
                    bonuses.data = (bonuses.data || 0) + maxDataBonus;
                }
            } else if (effect.type === 'DISCARD_ROW_FOR_FREE_ACTIONS') {
                // Appliquer les actions gratuites de toutes les cartes de la rangée
                updatedGame.decks.cardRow.forEach(rowCard => {
                    if (rowCard.freeAction === FreeActionType.MOVEMENT) {
                        bonuses.movements = (bonuses.movements || 0) + 1;
                    } else if (rowCard.freeAction === FreeActionType.DATA) {
                        player.data = Math.min((player.data || 0) + 1, GAME_CONSTANTS.MAX_DATA);
                        bonuses.data = (bonuses.data || 0) + 1;
                    } else if (rowCard.freeAction === FreeActionType.MEDIA) {
                        player.mediaCoverage = Math.min((player.mediaCoverage || 0) + 1, GAME_CONSTANTS.MAX_MEDIA_COVERAGE);
                        bonuses.media = (bonuses.media || 0) + 1;
                    }
                });
                updatedGame.decks.cardRow = [];
                const refilled = this.refillCardRow(updatedGame);
                updatedGame.decks.cardRow = refilled.decks.cardRow;
                updatedGame.decks = refilled.decks;
            } else if (effect.type === 'ATMOSPHERIC_ENTRY') {
                bonuses.atmosphericEntry = true;
            } else if (effect.type === 'GAIN_SIGNAL_FROM_HAND') {
                bonuses.gainSignalFromHand = effect.value;
            } else if (effect.type === 'BONUS_IF_COVERED') {
                player.activeBuffs.push({ ...effect, source: card.name });
            } else if (effect.type === 'SCORE_IF_UNIQUE') {
                player.activeBuffs.push({ ...effect, source: card.name });
            } else if (effect.type === 'SCORE_PER_SECTOR') {
                player.activeBuffs.push({ ...effect, source: card.name });
            } else if (effect.type === 'KEEP_CARD_IF_ONLY') {
                bonuses.keepCardIfOnly = true;
            } else if (effect.type === 'NO_DATA') {
                bonuses.noData = true;
            } else if (effect.type === 'ANY_PROBE') {
                bonuses.anyProbe = true;
            } else if (effect.type === 'GAIN_SIGNAL_ADJACENTS') {
                bonuses.gainSignalAdjacents = true;
            }
        });
    }

    return { updatedGame, bonuses };
  }
    
  static discardToHandSize(player: Player, cardIdsToKeep: string[]): Player {
    const updatedPlayer = { ...player };
    updatedPlayer.cards = player.cards.filter(c => cardIdsToKeep.includes(c.id));
    return updatedPlayer;
  }

  static discardCard(player: Player, cardId: string): Player {
    const updatedPlayer = { ...player };
    updatedPlayer.cards = player.cards.filter(c => c.id !== cardId);
    return updatedPlayer;
  }

  static refillCardRow(game: Game): Game {
    const updatedGame = { ...game };
    
    // Copie profonde des decks
    updatedGame.decks = {
        ...updatedGame.decks,
        cards: [...updatedGame.decks.cards]
    };

    // Remplir jusqu'à 3 cartes
    while (updatedGame.decks.cardRow.length < 3 && updatedGame.decks.cards.length > 0) {
      const newCard = updatedGame.decks.cards.shift();
      if (newCard) {
        updatedGame.decks.cardRow.push(newCard);
      }
    }
    return updatedGame;
  }
}