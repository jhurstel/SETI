import { useCallback, useEffect, useState } from 'react';
import { Game, GamePhase, HistoryEntry } from '../../core/types';
import { noticedSpecies } from '../../systems/SpeciesSystem';
import type { AnnouncementContent } from '../components/Announcement';

/**
 * Annonces au centre de l'écran : début de tour d'un joueur, découverte d'une espèce (prioritaire), et tirage du
 * premier joueur au démarrage d'une partie. `showNotifications` répartit les annonces de la partie : une découverte
 * devient la bande « Nouvelle espèce », le reste un message (`onMessage`).
 */
export function useAnnouncements({ game, historyLog, me, onMessage, chapterOffer }: {
  /** Partie avec les vrais types de joueurs (realGame) */
  game: Game | null;
  historyLog: HistoryEntry[];
  /** Joueur de cet écran */
  me: string | undefined;
  onMessage: (message: string) => void;
  /** Espèces débloquées pour la première fois dans ce navigateur, et ouverture de leur chapitre du tutoriel */
  chapterOffer?: { species: string[]; open: (species: string) => void };
}) {
  const [discovery, setDiscovery] = useState<{ species: string; key: number } | null>(null);
  const [turnAnnouncement, setTurnAnnouncement] = useState<AnnouncementContent | null>(null);

  // Début de tour d'un joueur : annonce au centre (grande pour vous, réduite pour les autres). Le nombre de tours
  // déjà commencés (lignes « --- Tour de … » de l'historique) distingue deux tours de suite d'un même joueur
  const turnsStarted = historyLog.filter(e => e.message.startsWith('--- Tour de')).length;
  const turnPlayer = game && game.phase === GamePhase.PLAYING ? game.players[game.currentPlayerIndex] : undefined;
  const turnKey = turnPlayer ? `${game!.currentRound}-${turnsStarted}-${turnPlayer.id}` : null;
  useEffect(() => {
    if (!turnKey || !turnPlayer || !game) return;
    const mine = turnPlayer.id === me;
    setTurnAnnouncement({
      key: turnKey,
      kicker: `Manche ${game.currentRound}`,
      title: mine ? 'À vous de jouer' : `Tour de ${turnPlayer.name}`,
      subtitle: mine ? turnPlayer.name : turnPlayer.type === 'robot' ? 'Robot' : undefined,
      color: turnPlayer.color,
      size: mine ? 'large' : 'compact',
      duration: mine ? 1800 : 1200,
    });
    // Seul le changement de tour relance l'annonce
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [turnKey]);

  // Tirage du premier joueur : animé une fois au démarrage de chaque partie (solo ou en ligne), avant la première
  // réservation ; la partie est reconnue par sa première entrée d'historique. Les robots locaux attendent la fin
  const [drawShownFor, setDrawShownFor] = useState<string | null>(null);
  const [drawing, setDrawing] = useState(false);
  const gameKey = historyLog[0]?.id;
  const atStart = !!game && game.phase === GamePhase.SETUP && game.players.every(p => p.reservedCards.length === 0);
  // Tirage dû mais pas encore lancé : compté dès le premier rendu de la partie, pour que la roue couvre l'écran
  // avant toute image du plateau (l'effet ne passe qu'après ce rendu)
  const drawDue = atStart && !!gameKey && gameKey !== drawShownFor;
  useEffect(() => {
    if (!drawDue) return;
    setDrawShownFor(gameKey!);
    setDrawing(true);
  }, [drawDue, gameKey]);
  const endDrawing = useCallback(() => setDrawing(false), []);

  /** Annonces de la partie (découverte d'une espèce…) */
  const showNotifications = useCallback((notifications: string[]) => {
    notifications.forEach(message => {
      const species = noticedSpecies(message);
      if (species !== undefined) setDiscovery({ species, key: Date.now() });
      else onMessage(message);
    });
  }, [onMessage]);

  // Découverte (prioritaire sur l'annonce de tour) : nom de l'espèce et joueurs qui ont un marqueur sur son plateau
  const discoveryBoard = discovery && game ? game.board.alienBoards.find(b => b.speciesId === discovery.species) : undefined;
  const discoverers = [...new Set((discoveryBoard?.lifeTraces || []).map(t => t.playerId))]
    .map(id => game?.players.find(p => p.id === id)?.name)
    .filter((name): name is string => !!name);
  const offered = !!discovery?.species && !!chapterOffer?.species.includes(discovery.species);
  const announcement: AnnouncementContent | null = discovery
    ? {
        key: `discovery-${discovery.key}`,
        kicker: 'Nouvelle espèce',
        title: discovery.species || 'Espèce Alien découverte',
        subtitle: discoverers.length > 0 ? `découverte par ${discoverers.join(', ').replace(/, ([^,]*)$/, ' et $1')}` : undefined,
        color: '#3ddc84',
        size: 'large',
        // Avec le bouton du chapitre : plus longtemps, le temps de lire et de choisir (le survol la garde aussi)
        duration: offered ? 9000 : 3500,
        icon: '👽',
        // Fin du tour qui révèle une espèce rencontrée pour la première fois : son chapitre du tutoriel est proposé
        action: offered ? { label: 'Voir le chapitre du tutoriel', onClick: () => chapterOffer!.open(discovery.species) } : undefined,
      }
    : turnAnnouncement;
  const closeDiscovery = useCallback(() => setDiscovery(null), []);
  const closeTurnAnnouncement = useCallback(() => setTurnAnnouncement(null), []);

  return {
    announcement,
    /** Fin de l'annonce affichée (la découverte, sinon l'annonce de tour) */
    onAnnouncementDone: discovery ? closeDiscovery : closeTurnAnnouncement,
    /** Tirage du premier joueur en cours d'animation */
    drawing: drawing || drawDue,
    endDrawing,
    showNotifications,
  };
}
