import { createRotationState, getAbsoluteSectorForProbe, getObjectPosition, performRotation } from '../core/SolarSystemPosition';
import { Game, GAME_CONSTANTS, Bonus, InteractionState, TechnologyCategory, SectorType, ProbeState, HistoryEntry, Signal } from '../core/types';
import { CardSystem } from './CardSystem';
import { ProbeSystem } from './ProbeSystem';
import { ScanSystem } from './ScanSystem';

export class ResourceSystem {  
  static formatResource(amount: number, type: string): string {
    const absAmount = Math.abs(amount);
    const plural = absAmount > 1 ? 's' : '';
    let label = type;
    const key = type.toUpperCase();

    if (key === 'PV') label = 'PV';
    else if (key === 'MEDIA' || key === 'MEDIAS') label = `Média${plural}`;
    else if (key === 'DATA' || key === 'DATAS') label = `Donnée${plural}`;
    else if (key === 'CREDIT' || key === 'CREDITS') label = `Crédit${plural}`;
    else if (key === 'ENERGY' || key === 'ENERGIE') label = `Énergie${plural}`;
    else if (key === 'CARD' || key === 'CARDS' || key === 'CARTES') label = `Carte${plural}`;
    
    return `${amount} ${label}`;
  }

  // Helper pour formater les bonus
  static formatBonus(bonus: Bonus) {
    if (!bonus) return null;
    const items: string[] = [];
    if (bonus.pv) items.push(`${bonus.pv} PV`);
    if (bonus.media) items.push(`${bonus.media} Média`);
    if (bonus.credits) items.push(`${bonus.credits} Crédit`);
    if (bonus.energy) items.push(`${bonus.energy} Énergie`);
    if (bonus.card) items.push(`${bonus.card} Pioche`);
    if (bonus.data) items.push(`${bonus.data} Donnée`);

    if (bonus.signals) {
      bonus.signals.forEach(s => {
        items.push(`${s.amount} Signal (${s.scope})`);
      });
    }

    if (bonus.scan) items.push(`${bonus.scan} Scan`);

    if (bonus.revenue) items.push(`${bonus.revenue} Réservation`);
    if (bonus.anycard) items.push(`${bonus.anycard} Carte`);

    if (bonus.lifetraces) {
      bonus.lifetraces.forEach(l => {
        items.push(`${l.amount} Trace ${l.scope}`);
      });
    }

    if (bonus.technologies) {
      bonus.technologies.forEach(t => {
        items.push(`${t.amount} Tech ${t.scope}`);
      });
    }

    if (bonus.probe) items.push(`${bonus.probe} Sonde`);
    if (bonus.landing) items.push(`${bonus.landing} Atterrisseur`);
    if (bonus.movements) items.push(`${bonus.movements} Déplacement`);

    return items;
  };

  static accumulateBonus(bonus: Bonus, accumulatedBonuses: Bonus) {
      for (const key in bonus) {
          const k = key as keyof Bonus;
          const val = bonus[k];
          if (typeof val === 'number') {
              (accumulatedBonuses as any)[k] = ((accumulatedBonuses[k] as number) || 0) + val;
          } else if (val !== undefined) {
              if (k === 'gainSignal' && Array.isArray(val)) {
                  const existing = (accumulatedBonuses[k] as any[]) || [];
                  (accumulatedBonuses as any)[k] = [...existing, ...val];
              } else {
                  (accumulatedBonuses as any)[k] = val;
              }
          }
      }
  }

  static buyCard(game: Game, playerId: string, cardIdFromRow?: string, isFree: boolean = false): { updatedGame: Game, error?: string } {
    let updatedGame = { ...game };
    
    // Copie profonde du joueur et de ses cartes
    updatedGame.players = updatedGame.players.map(p => p.id === playerId ? { ...p, cards: [...p.cards] } : p);
    const player = updatedGame.players.find(p => p.id === playerId);
    if (!player) return { updatedGame: game, error: "Joueur non trouvé" };

    if (!isFree) {
      if (player.mediaCoverage < 3) {
        return { updatedGame: game, error: "Couverture médiatique insuffisante" };
      }

      player.mediaCoverage -= 3;
    }

    if (cardIdFromRow) {
      // Copie profonde de la rangée de cartes avant modification
      updatedGame.decks = {
        ...updatedGame.decks,
        cardRow: [...(updatedGame.decks.cardRow || [])]
      };

      const cardIndex = updatedGame.decks.cardRow.findIndex(c => c.id === cardIdFromRow);
      if (cardIndex !== -1) {
        const [card] = updatedGame.decks.cardRow.splice(cardIndex, 1);
        player.cards.push(card);
        updatedGame = CardSystem.refillCardRow(updatedGame);
      } else {
        return { updatedGame: game, error: "Carte non trouvée dans la rangée" };
      }
    } else {
      updatedGame = CardSystem.drawCards(updatedGame, playerId, 1);
    }

    return { updatedGame };
  }

  static tradeResources(game: Game, playerId: string, spendType: string, gainType: string, cardIdsToSpend?: string[]): { updatedGame: Game, error?: string } {
    let updatedGame = { ...game };
    updatedGame.players = updatedGame.players.map(p => ({ ...p }));
    const player = updatedGame.players.find(p => p.id === playerId);
    if (!player) return { updatedGame: game, error: "Joueur non trouvé" };

    const normalizedSpend = spendType.toLowerCase().trim().replace('é', 'e');
    const normalizedGain = gainType.toLowerCase().trim().replace('é', 'e');

    if (normalizedSpend === 'credit') {
        if (player.credits < 2) return { updatedGame: game, error: "Pas assez de crédits" };
        player.credits -= 2;
    } else if (normalizedSpend === 'energy') {
        if (player.energy < 2) return { updatedGame: game, error: "Pas assez d'énergie" };
        player.energy -= 2;
    } else if (normalizedSpend === 'card') {
        if (!cardIdsToSpend || cardIdsToSpend.length !== 2) return { updatedGame: game, error: "2 cartes doivent être sélectionnées" };
        player.cards = player.cards.filter(c => !cardIdsToSpend.includes(c.id));
    }

    if (normalizedGain === 'credit') {
        player.credits += 1;
    } else if (normalizedGain === 'energy') {
        player.energy += 1;
    } else if (normalizedGain === 'carte' || normalizedGain === 'card') {
        updatedGame = CardSystem.drawCards(updatedGame, playerId, 1);
    } else {
         return { updatedGame: game, error: "Type de ressource à recevoir invalide" };
    }

    return { updatedGame };
  }

  static updateMedia(game: Game, playerId: string, count: number): { updatedGame: Game, error?: string } {
    let updatedGame = { ...game };
    updatedGame.players = updatedGame.players.map(p => ({ ...p }));
    const player = updatedGame.players.find(p => p.id === playerId);
    if (!player) return { updatedGame: game, error: "Joueur non trouvé" };

    player.mediaCoverage = Math.min(player.mediaCoverage + count, GAME_CONSTANTS.MAX_MEDIA_COVERAGE);
    return { updatedGame };
  }

  static updateCredit(game: Game, playerId: string, count: number): { updatedGame: Game, error?: string } {
    let updatedGame = { ...game };
    updatedGame.players = updatedGame.players.map(p => ({ ...p }));
    const player = updatedGame.players.find(p => p.id === playerId);
    if (!player) return { updatedGame: game, error: "Joueur non trouvé" };

    player.credits += count;
    return { updatedGame };
  }

  static updateEnergy(game: Game, playerId: string, count: number): { updatedGame: Game, error?: string } {
    let updatedGame = { ...game };
    updatedGame.players = updatedGame.players.map(p => ({ ...p }));
    const player = updatedGame.players.find(p => p.id === playerId);
    if (!player) return { updatedGame: game, error: "Joueur non trouvé" };

    player.energy += count;
    return { updatedGame };
  }

  static updateData(game: Game, playerId: string, count: number): { updatedGame: Game, error?: string } {
    let updatedGame = { ...game };
    updatedGame.players = updatedGame.players.map(p => ({ ...p }));
    const player = updatedGame.players.find(p => p.id === playerId);
    if (!player) return { updatedGame: game, error: "Joueur non trouvé" };

    player.data = Math.min(player.data + count, GAME_CONSTANTS.MAX_DATA);
    return { updatedGame };
  }

  // Helper pour traiter les bonus
  static processBonuses(bonuses: Bonus, currentGame: Game, playerId: string, sourceId: string, sequenceId: string): { updatedGame: Game, newPendingInteractions: InteractionState[], passiveGains: string[], logs: string[], historyEntries: HistoryEntry[] }
  {
    let updatedGame = currentGame;
    const newPendingInteractions: InteractionState[] = [];
    const logs: string[] = [];
    const historyEntries: HistoryEntry[] = [];
    const passiveGains: string[] = [];
    const launchedProbeIds: string[] = [];

    if (!bonuses) return { updatedGame, newPendingInteractions, logs, passiveGains, historyEntries };

    // Appliquer les ressources simples au joueur
    const player = updatedGame.players.find(p => p.id === playerId);
    if (player) {
        if (bonuses.pv) player.score += bonuses.pv;
        if (bonuses.credits) player.credits += bonuses.credits;
        if (bonuses.energy) player.energy += bonuses.energy;
        if (bonuses.media) player.mediaCoverage = Math.min(player.mediaCoverage + bonuses.media, GAME_CONSTANTS.MAX_MEDIA_COVERAGE);
        if (bonuses.data) player.data = Math.min(player.data + bonuses.data, GAME_CONSTANTS.MAX_DATA);
    }

    // Gains passifs pour le résumé (déjà effectué dans CardSystem)
    if (bonuses.media) { const txt = ResourceSystem.formatResource(bonuses.media, 'MEDIA'); passiveGains.push(txt); }
    if (bonuses.credits) { const txt = ResourceSystem.formatResource(bonuses.credits, 'CREDIT'); passiveGains.push(txt); }
    if (bonuses.energy) { const txt = ResourceSystem.formatResource(bonuses.energy, 'ENERGY'); passiveGains.push(txt); }
    if (bonuses.data) { const txt = ResourceSystem.formatResource(bonuses.data, 'DATA'); passiveGains.push(txt); }
    if (bonuses.pv) { const txt = ResourceSystem.formatResource(bonuses.pv, 'PV'); passiveGains.push(txt); }
    const gainsText = passiveGains.length > 0 ? `${passiveGains.join(', ')}` : '';
    if (gainsText) logs.push(`gagne ${gainsText}`);

    // Effets immédiats
    if (bonuses.rotation) {
      for (let i = 0; i < bonuses.rotation; i++) {
        const rotationResult = performRotation(updatedGame);
        updatedGame = rotationResult.updatedGame;
        logs.push(...rotationResult.logs);
      }
    }
    if (bonuses.card) {
      updatedGame = CardSystem.drawCards(updatedGame, playerId, bonuses.card);
      const txt = ResourceSystem.formatResource(bonuses.card, 'CARD');
      passiveGains.push(txt);
      logs.push(`pioche ${txt}`);
    }
    if (bonuses.probe) {
      const ignoreLimit = bonuses.ignoreProbeLimit || false;
      for (let i = 0; i < bonuses.probe; i++) {
        const result = ProbeSystem.launchProbe(updatedGame, playerId, true, ignoreLimit); // free launch
        if (result.probeId) {
          updatedGame = result.updatedGame;
          launchedProbeIds.push(result.probeId);
          logs.push(`lance 1 sonde depuis la Terre`);
        } else {
          logs.push(`ne peut pas lancer de sonde (limite atteinte)`);
        }
      }
      const txt = `${bonuses.probe} Sonde${bonuses.probe > 1 ? 's' : ''}`;
      passiveGains.push(txt);
    }

    // Effets interactifs (File d'attente)
    if (bonuses.signals) {
      for (const signalBonus of bonuses.signals) {
        for (let i = 0; i < signalBonus.amount; i++) {
          let targetSectorId: string | undefined;
          let objectId: string | undefined;

          switch (signalBonus.scope) {
            case SectorType.EARTH: objectId = 'earth'; break;
            case SectorType.MERCURY: objectId = 'mercury'; break;
            case SectorType.VENUS: objectId = 'venus'; break;
            case SectorType.MARS: objectId = 'mars'; break;
            case SectorType.JUPITER: objectId = 'jupiter'; break;
            case SectorType.SATURN: objectId = 'saturn'; break;
          }

          if (objectId) {
            const solarSystem = updatedGame.board.solarSystem;
            const pos = getObjectPosition(objectId, solarSystem.rotationAngleLevel1, solarSystem.rotationAngleLevel2, solarSystem.rotationAngleLevel3);
            if (pos) {
              const sector = updatedGame.board.sectors[pos.absoluteSector - 1];
              if (sector) targetSectorId = sector.id;
            }
          } else {
            let searchName = '';
            switch (signalBonus.scope) {
              case SectorType.VEGA: searchName = 'Véga'; break;
              case SectorType.PICTORIS: searchName = 'Pictoris'; break;
              case SectorType.KEPLER: searchName = 'Kepler'; break;
              case SectorType.VIRGINIS: searchName = 'Virginis'; break;
              case SectorType.BARNARD: searchName = 'Barnard'; break;
              case SectorType.PROXIMA: searchName = 'Proxima'; break;
              case SectorType.PROCYON: searchName = 'Procyon'; break;
              case SectorType.SIRIUS: searchName = 'Sirius'; break;
            }
            if (searchName) {
              const sector = updatedGame.board.sectors.find(s => s.name.includes(searchName));
              if (sector) targetSectorId = sector.id;
            }
          }

          if (targetSectorId) {
            const result = ScanSystem.performSignalAndCover(updatedGame, playerId, targetSectorId, logs, bonuses.noData, sequenceId);
            updatedGame = result.updatedGame;
            historyEntries.push(...result.historyEntries);
            newPendingInteractions.push(...result.newPendingInteractions);
            continue;
          }

          // Scans interactifs
          if (signalBonus.scope === SectorType.ROW) {
            newPendingInteractions.push({ type: 'SELECTING_SCAN_CARD' });
          } else if (signalBonus.scope === SectorType.DECK) {
            if (updatedGame.decks.cards.length > 0) {
              const drawnCard = updatedGame.decks.cards.shift();
              if (drawnCard) {
                updatedGame.decks.discardPile.push(drawnCard);
                newPendingInteractions.push({ type: 'SELECTING_SCAN_SECTOR', color: drawnCard.scanSector, cardId: drawnCard.id, message: `Marquez un signal dans un secteur ${drawnCard.scanSector} (Carte "${drawnCard.name}")` });
              }
            }
          } else if (signalBonus.scope === SectorType.PROBE) {
            const currentPlayer = updatedGame.players.find(p => p.id === playerId);
            const probesInSystem = currentPlayer ? currentPlayer.probes.filter(p => p.state === ProbeState.IN_SOLAR_SYSTEM && p.solarPosition) : [];

            if (probesInSystem.length === 1) {
              const probe = probesInSystem[0];
              const rotationState = createRotationState(
                updatedGame.board.solarSystem.rotationAngleLevel1 || 0,
                updatedGame.board.solarSystem.rotationAngleLevel2 || 0,
                updatedGame.board.solarSystem.rotationAngleLevel3 || 0
              );
              const absoluteSector = getAbsoluteSectorForProbe(probe.solarPosition!, rotationState);

              if (absoluteSector) {
                const sectorId = `sector_${absoluteSector}`;
                const result = ScanSystem.performSignalAndCover(updatedGame, playerId, sectorId, undefined, bonuses.noData, sequenceId);
                updatedGame = result.updatedGame;
                historyEntries.push(...result.historyEntries);
                newPendingInteractions.push(...result.newPendingInteractions);

                if (bonuses.keepCardIfOnly && sourceId) {
                  const updatedSector = updatedGame.board.sectors[absoluteSector - 1];
                  const playerSignals = updatedSector.signals.filter((s: Signal) => s.markedBy === playerId) || [];

                  if (playerSignals.length === 1) {
                    const discardPile = updatedGame.decks.discardPile;
                    const cardIndex = discardPile.findIndex(c => c.id === sourceId);

                    if (cardIndex !== -1) {
                      const card = discardPile[cardIndex];
                      discardPile.splice(cardIndex, 1);

                      const pIndex = updatedGame.players.findIndex(p => p.id === playerId);
                      if (pIndex !== -1) {
                        updatedGame.players[pIndex].cards.push(card);
                        logs.push(`récupère la carte "${card.name}" en main`);
                        passiveGains.push("Carte récupérée");
                      }
                    }
                  }
                }
              }
            } else {
              newPendingInteractions.push({ type: 'SELECTING_SCAN_SECTOR', color: SectorType.PROBE, noData: bonuses.noData, onlyProbes: true, keepCardIfOnly: bonuses.keepCardIfOnly, cardId: sourceId });
            }
          } else if ([SectorType.RED, SectorType.BLUE, SectorType.YELLOW, SectorType.BLACK, SectorType.ANY].includes(signalBonus.scope)) {
            newPendingInteractions.push({ type: 'SELECTING_SCAN_SECTOR', color: signalBonus.scope, noData: bonuses.noData });
          }
        }
      }
    }

    if (bonuses.scan) {
      for (let i = 0; i < bonuses.scan; i++) {
        const res = ScanSystem.performScanAction(updatedGame, true, sequenceId);
        updatedGame = res.updatedGame;
        historyEntries.push(...res.historyEntries);
        newPendingInteractions.push(...res.newPendingInteractions);
      }
    }

    if (bonuses.anycard) {
      newPendingInteractions.push({ type: 'ACQUIRING_CARD', count: bonuses.anycard, isFree: true });
    }

    if (bonuses.revenue) {
      const player = updatedGame.players.find(p => p.id === playerId);
      if (player) {
        const count = Math.min(bonuses.revenue, player.cards.length);
        if (count > 0) newPendingInteractions.push({ type: 'RESERVING_CARD', count: count, selectedCards: [] });
      }
    }

    if (bonuses.technologies) {
      for (const techBonus of bonuses.technologies) {
        for (let i = 0; i < techBonus.amount; i++) {
          newPendingInteractions.push({ type: 'ACQUIRING_TECH', isBonus: true, category: techBonus.scope === TechnologyCategory.ANY ? undefined : techBonus.scope, sharedOnly: bonuses.sharedOnly, noTileBonus: bonuses.noTileBonus });
        }
      }
    }

    if (bonuses.movements) {
      newPendingInteractions.push({ type: 'MOVING_PROBE', count: bonuses.movements, autoSelectProbeId: launchedProbeIds.length > 0 ? launchedProbeIds[launchedProbeIds.length - 1] : undefined });
      logs.push(`obtient ${bonuses.movements} déplacement${bonuses.movements > 1 ? 's' : ''} gratuit${bonuses.movements > 1 ? 's' : ''}`);
    }

    if (bonuses.landing) {
      newPendingInteractions.push({ type: 'LANDING_PROBE', count: bonuses.landing, source: sourceId });
      logs.push(`obtient ${bonuses.landing} atterrissage`);
    }

    if (bonuses.lifetraces) {
      let tracesText = [];
      for (const lifetraceBonus of bonuses.lifetraces) {
        for (let i = 0; i < lifetraceBonus.amount; i++) {
          newPendingInteractions.push({ type: 'PLACING_LIFE_TRACE', color: lifetraceBonus.scope });
        }
        const colorLabel = lifetraceBonus.scope && typeof lifetraceBonus.scope === 'string' ? ` (${lifetraceBonus.scope})` : '';
        tracesText.push(`${lifetraceBonus.amount} trace${lifetraceBonus.amount > 1 ? 's' : ''} de vie${colorLabel}`);
      }
      if (tracesText.length > 0) {
        logs.push(`obtient ${tracesText.join(' et ')}`);
      }
    }
    // Effets interactifs (File d'attente)
    if (bonuses.scorePerMedia) {
      newPendingInteractions.push({ type: 'TRIGGER_CARD_EFFECT', effectType: 'SCORE_PER_MEDIA', value: bonuses.scorePerMedia });
    }
    if (bonuses.revealAndTriggerFreeAction) {
      newPendingInteractions.push({ type: 'ACQUIRING_CARD', count: 1, isFree: true, triggerFreeAction: true });
    }
    if (bonuses.choiceMediaOrMove) {
      newPendingInteractions.push({ type: 'CHOOSING_MEDIA_OR_MOVE' });
    }
    if (bonuses.atmosphericEntry) {
      newPendingInteractions.push({ type: 'REMOVING_ORBITER' });
    }
    if (bonuses.gainSignalFromHand) {
      newPendingInteractions.push({ type: 'DISCARDING_FOR_SIGNAL', count: bonuses.gainSignalFromHand, selectedCards: [] });
    }

    return { updatedGame, newPendingInteractions, logs, passiveGains, historyEntries };
  };

}