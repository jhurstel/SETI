import React from 'react';
import { Bonus, GAME_CONSTANTS, Player } from '../../core/types';
import { ResourceIcon, VictoryPointsIcon } from '../components/GameIcons';
import { ActionTooltip, ResourceSymbols } from '../components/BoardTooltips';
import { ReservationIcon } from '../components/ObjectiveSymbol';
import { HoverTooltip } from '../components/HoverTooltip';
import { CardTooltip } from '../components/CardTooltip';
import { useResourceFlash } from './useResourceFlash';

/**
 * Section Ressources du plateau joueur : une tuile par ressource (symbole, valeur, flash au changement), ses actions
 * gratuites dans son infobulle (échanges, achat d'une carte), et la tuile des revenus et des cartes réservées
 */
export const PlayerResources: React.FC<{
  player: Player;
  /** Cartes en main (sans les cartes Exertiens) */
  handCount: number;
  isRobot: boolean;
  isCurrentTurn: boolean;
  isInteractiveMode: boolean;
  onDirectTradeAction: (spendType: string, gainType: string) => void;
  onTradeCardAction: (targetGain?: string) => void;
  onBuyCardAction: () => void;
  setActiveTooltip: (tooltip: null) => void;
  showInteractiveTooltip: (e: React.MouseEvent, content: React.ReactNode) => void;
  scheduleTooltipClose: () => void;
}> = ({ player: currentPlayer, handCount, isRobot, isCurrentTurn, isInteractiveMode, onDirectTradeAction, onTradeCardAction, onBuyCardAction, setActiveTooltip, showInteractiveTooltip, scheduleTooltipClose }) => {
  const mediaFlash = useResourceFlash(currentPlayer.mediaCoverage, currentPlayer.id);
  const creditFlash = useResourceFlash(currentPlayer.credits, currentPlayer.id);
  const energyFlash = useResourceFlash(currentPlayer.energy, currentPlayer.id);
  const revenueCreditFlash = useResourceFlash(currentPlayer.revenueCredits, currentPlayer.id);
  const revenueEnergyFlash = useResourceFlash(currentPlayer.revenueEnergy, currentPlayer.id);
  const revenueCardFlash = useResourceFlash(currentPlayer.revenueCards, currentPlayer.id);
  const dataFlash = useResourceFlash(currentPlayer.data, currentPlayer.id);
  const scoreFlash = useResourceFlash(currentPlayer.score, currentPlayer.id);
  const cardsFlash = useResourceFlash(handCount, currentPlayer.id);

  // Actions gratuites d'une ressource (échanges, achat d'une carte), proposées dans son infobulle
  type FreeAction = {
    key: string; title: string; spend: TradeKind; spendAmount: number; gain: TradeKind; gainAmount: number; note?: string;
    available: boolean; lacking: string; onClick: () => void;
  };
  type TradeKind = 'credit' | 'energy' | 'card' | 'media';
  const TRADE_BONUS: Record<TradeKind, keyof Bonus> = { credit: 'credits', energy: 'energy', card: 'card', media: 'media' };
  const tradeBonus = (kind: TradeKind, amount: number): Bonus => ({ [TRADE_BONUS[kind]]: amount });
  const freeActionReason = (lacking: string) => !isCurrentTurn ? "Ce n'est pas votre tour" : isInteractiveMode ? "Terminez d'abord l'action en cours" : lacking;
  const trade = (spend: 'credit' | 'energy', gain: 'credit' | 'energy' | 'card'): FreeAction => {
    const have = spend === 'credit' ? currentPlayer.credits : currentPlayer.energy;
    return {
      key: `${spend}-${gain}`, title: 'Échanger', spend, spendAmount: 2, gain, gainAmount: 1, available: isCurrentTurn && !isInteractiveMode && have >= 2,
      lacking: `Vous avez ${have} ${spend === 'credit' ? 'crédit(s)' : 'énergie(s)'}`, onClick: () => onDirectTradeAction && onDirectTradeAction(spend, gain),
    };
  };
  const cardTrade = (gain: 'credit' | 'energy'): FreeAction => ({
    key: `card-${gain}`, title: 'Échanger des cartes', spend: 'card', spendAmount: 2, gain, gainAmount: 1,
    available: isCurrentTurn && !isInteractiveMode && handCount >= 2,
    lacking: `Vous avez ${handCount} carte(s) en main`, onClick: () => onTradeCardAction && onTradeCardAction(gain),
  });
  const buyCard: FreeAction = {
    key: 'buy-card', title: 'Acheter une carte', spend: 'media', spendAmount: 3, gain: 'card', gainAmount: 1, note: 'rangée ou pioche',
    available: isCurrentTurn && !isInteractiveMode && currentPlayer.mediaCoverage >= 3,
    lacking: `Vous avez ${currentPlayer.mediaCoverage} média(s)`, onClick: () => onBuyCardAction && onBuyCardAction(),
  };
  // Infobulle d'une ressource : seulement ses actions gratuites, boutons à icônes seules, chacun avec une infobulle
  // d'action (coût, bonus, clic ou raison) ; pas d'infobulle sans action (robot, score, données)
  const resourceTooltip = (actions: FreeAction[]) => (isRobot || actions.length === 0 ? null : (
    <div className="seti-resource-tooltip">
        <div className="seti-resource-tooltip-actions">
          <div className="seti-resource-tooltip-actions-title">Actions</div>
          <div className="seti-resource-tooltip-action-row">
            {actions.map(action => (
              <HoverTooltip key={action.key} nested content={
                <ActionTooltip title={action.title} cost={<ResourceSymbols bonus={tradeBonus(action.spend, action.spendAmount)} />}
                  bonus={<ResourceSymbols bonus={tradeBonus(action.gain, action.gainAmount)} note={action.note} />}
                  available={action.available} hint={action.available ? (action.key === 'buy-card' ? 'Cliquez pour acheter' : 'Cliquez pour échanger') : freeActionReason(action.lacking)} />
              }>
                <button
                  type="button"
                  className="seti-resource-tooltip-action"
                  aria-label={action.title}
                  aria-disabled={!action.available}
                  onClick={() => { if (!action.available) return; setActiveTooltip(null); action.onClick(); }}
                >
                  <ResourceIcon kind={action.spend} amount={action.spendAmount} size={18} />
                  <span aria-hidden="true">→</span>
                  <ResourceIcon kind={action.gain} amount={action.gainAmount} size={18} />
                </button>
              </HoverTooltip>
            ))}
          </div>
        </div>
    </div>
  ));

  const flashClass = (flash: { type: string } | null) => (flash ? (flash.type === 'gain' ? 'flash-gain' : 'flash-loss') : '');
  // Tuile d'une ressource : symbole et valeur, limite éventuelle en légende dessous (sans déplacer le symbole)
  const tile = (key: string, flash: { id: number; type: string } | null, icon: React.ReactNode, tooltip: React.ReactNode, caption?: string) => (
    <div
      key={flash ? `${key}-${flash.id}` : `${key}-static`}
      className={`seti-stat-tile ${tooltip ? 'has-actions' : ''} ${flashClass(flash)}`}
      onMouseEnter={tooltip ? (e) => showInteractiveTooltip(e, tooltip) : undefined}
      onMouseLeave={tooltip ? scheduleTooltipClose : undefined}
    >
      <div className="seti-stat-main">{icon}</div>
      {caption && <span className="seti-stat-caption">{caption}</span>}
    </div>
  );
  return (
    <div className="seti-player-section">
    <div className="seti-player-section-title">Ressources</div>
    <div className="seti-stats-row">
    {tile('score', scoreFlash, <VictoryPointsIcon amount={currentPlayer.score} size={32} />, null)}
    {tile('credit', creditFlash, <ResourceIcon kind="credit" amount={currentPlayer.credits} size={30} />,
      resourceTooltip([trade('credit', 'energy'), trade('credit', 'card')]))}
    {tile('energy', energyFlash, <ResourceIcon kind="energy" amount={currentPlayer.energy} size={30} />,
      resourceTooltip([trade('energy', 'credit'), trade('energy', 'card')]))}
    {tile('cards', cardsFlash, <ResourceIcon kind="card" amount={handCount} size={30} />,
      resourceTooltip([cardTrade('credit'), cardTrade('energy')]), `Fin de tour : ${GAME_CONSTANTS.HAND_SIZE_AFTER_PASS}`)}
    {tile('media', mediaFlash, <ResourceIcon kind="media" amount={currentPlayer.mediaCoverage} size={30} />,
      resourceTooltip([buyCard]), `(max ${GAME_CONSTANTS.MAX_MEDIA_COVERAGE})`)}
    {tile('data', dataFlash, <ResourceIcon kind="data" amount={currentPlayer.data} size={30} />,
      null, `(max ${GAME_CONSTANTS.MAX_DATA})`)}

    {/* Revenus : bouton Réservation, revenus de chaque manche en miniature, détail en infobulle */}
    {(() => {
      const revenues = [
        { kind: 'credit' as const, label: 'Crédits', total: currentPlayer.revenueCredits, base: GAME_CONSTANTS.INITIAL_REVENUE_CREDITS, flash: revenueCreditFlash },
        { kind: 'energy' as const, label: 'Énergie', total: currentPlayer.revenueEnergy, base: GAME_CONSTANTS.INITIAL_REVENUE_ENERGY, flash: revenueEnergyFlash },
        { kind: 'card' as const, label: 'Cartes', total: currentPlayer.revenueCards, base: GAME_CONSTANTS.INITIAL_REVENUE_CARDS, flash: revenueCardFlash },
        // Revenus apportés par les espèces (cartes Centauriens, réservations de cartes à revenu Média ou Donnée)
        { kind: 'media' as const, label: 'Médias', total: currentPlayer.revenueMedia || 0, base: 0, flash: null },
        { kind: 'data' as const, label: 'Données', total: currentPlayer.revenueData || 0, base: 0, flash: null },
      ];
      const reserved = currentPlayer.reservedCards || [];
      const tooltip = (
        <div className="seti-revenue-tooltip">
          <div className="seti-revenue-tooltip-title">Revenus à chaque fin de manche</div>
          {revenues.map(r => (
            <div key={r.kind} className="seti-revenue-tooltip-row">
              <ResourceIcon kind={r.kind} size={16} />
              <span>{r.label}</span>
              <strong>{r.total}</strong>
              <span className="seti-revenue-tooltip-detail">{r.base > 0 ? `${r.base} de départ` : ''}{r.base > 0 && r.total > r.base ? ' + ' : ''}{r.total > r.base ? `${r.total - r.base} réservé${r.total - r.base > 1 ? 's' : ''}` : ''}</span>
            </div>
          ))}
          {/* Cartes réservées : une par ligne, nom surligné comme dans l'historique, infobulle de la carte */}
          <div className="seti-revenue-tooltip-cards">
            {reserved.length > 0 ? (
              <>
                <div className="seti-revenue-tooltip-cards-title">Cartes réservées ({reserved.length})</div>
                {reserved.map(c => (
                  <div key={c.id} className="seti-revenue-tooltip-card">
                    <HoverTooltip nested content={<CardTooltip card={c} />}>
                      <span className="seti-history-card-ref">"{c.name}"</span>
                    </HoverTooltip>
                  </div>
                ))}
              </>
            ) : 'Aucune carte réservée'}
          </div>
        </div>
      );
      const anyFlash = revenues.find(r => r.flash)?.flash ?? null;
      return (
        <div
          key={anyFlash ? `revenue-${anyFlash.id}` : 'revenue-static'}
          className={`seti-stat-tile seti-revenue-tile has-actions ${flashClass(anyFlash)}`}
          onMouseEnter={(e) => showInteractiveTooltip(e, tooltip)}
          onMouseLeave={scheduleTooltipClose}
          aria-label="Revenus"
        >
          <div className="seti-stat-main">
            <ReservationIcon size={26} />
            <span className="seti-revenue-count">{reserved.length}</span>
          </div>
          <div className="seti-revenue-mini">
            {revenues.map(r => <span key={r.kind} className={r.total === 0 ? 'empty' : undefined}><ResourceIcon kind={r.kind} amount={r.total} size={12} /></span>)}
          </div>
        </div>
      );
    })()}
    </div>
    </div>
  );
};
