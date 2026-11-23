import { RefObject, useCallback, useEffect, useRef, useState } from 'react';

/** Zoom du plateau : échelle et décalage (en pixels du conteneur, origine en haut à gauche) */
export interface BoardZoom { scale: number; x: number; y: number }

const IDENTITY: BoardZoom = { scale: 1, x: 0, y: 0 };
const MAX_SCALE = 4;

/** Décalage borné : le plateau zoomé couvre toujours le conteneur (pas de vide sur un bord) */
function clampZoom(zoom: BoardZoom, width: number, height: number): BoardZoom {
  if (zoom.scale <= 1.02) return IDENTITY;
  const minX = width * (1 - zoom.scale);
  const minY = height * (1 - zoom.scale);
  return { scale: zoom.scale, x: Math.min(0, Math.max(minX, zoom.x)), y: Math.min(0, Math.max(minY, zoom.y)) };
}

/**
 * Zoom au pincement du plateau du système solaire (écran tactile), à la place du zoom de la page : celui-ci laissait
 * les infobulles et la bulle du tutoriel (position fixe) à côté de leur cible, et redessinait mal le plateau réduit.
 * Deux doigts : zoom autour du point entre les doigts ; un doigt, plateau zoomé : déplacement ; plateau à 1× : un doigt
 * fait défiler la page comme avant (passage d'un écran à l'autre).
 */
export function useBoardPinchZoom(containerRef: RefObject<HTMLElement | null>) {
  const [zoom, setZoom] = useState<BoardZoom>(IDENTITY);
  const zoomRef = useRef(zoom);
  zoomRef.current = zoom;

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    let gesture: { startZoom: BoardZoom; dist: number; midX: number; midY: number } | null = null;
    let pan: { startZoom: BoardZoom; x: number; y: number; moved: boolean } | null = null;

    const local = (t: Touch) => {
      const r = el.getBoundingClientRect();
      return { x: t.clientX - r.left, y: t.clientY - r.top };
    };
    const apply = (next: BoardZoom) => {
      const r = el.getBoundingClientRect();
      setZoom(clampZoom(next, r.width, r.height));
    };

    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length === 2) {
        const a = local(e.touches[0]);
        const b = local(e.touches[1]);
        gesture = { startZoom: zoomRef.current, dist: Math.hypot(a.x - b.x, a.y - b.y) || 1, midX: (a.x + b.x) / 2, midY: (a.y + b.y) / 2 };
        pan = null;
      } else if (e.touches.length === 1 && zoomRef.current.scale > 1) {
        const p = local(e.touches[0]);
        pan = { startZoom: zoomRef.current, x: p.x, y: p.y, moved: false };
      }
    };

    const onTouchMove = (e: TouchEvent) => {
      if (gesture && e.touches.length === 2) {
        e.preventDefault();
        const a = local(e.touches[0]);
        const b = local(e.touches[1]);
        const { startZoom, dist, midX, midY } = gesture;
        const scale = Math.min(MAX_SCALE, Math.max(1, startZoom.scale * Math.hypot(a.x - b.x, a.y - b.y) / dist));
        const mx = (a.x + b.x) / 2;
        const my = (a.y + b.y) / 2;
        // Le point du plateau sous les doigts au départ reste sous les doigts
        const k = scale / startZoom.scale;
        apply({ scale, x: mx - (midX - startZoom.x) * k, y: my - (midY - startZoom.y) * k });
      } else if (pan && e.touches.length === 1) {
        const p = local(e.touches[0]);
        const dx = p.x - pan.x;
        const dy = p.y - pan.y;
        if (!pan.moved && Math.hypot(dx, dy) < 6) return;
        pan.moved = true;
        e.preventDefault();
        apply({ scale: pan.startZoom.scale, x: pan.startZoom.x + dx, y: pan.startZoom.y + dy });
      }
    };

    const onTouchEnd = (e: TouchEvent) => {
      if (e.touches.length < 2) gesture = null;
      if (e.touches.length === 0) pan = null;
    };

    // iOS : pas de zoom de la page par geste sur le plateau
    const onGesture = (e: Event) => e.preventDefault();

    el.addEventListener('touchstart', onTouchStart, { passive: true });
    el.addEventListener('touchmove', onTouchMove, { passive: false });
    el.addEventListener('touchend', onTouchEnd);
    el.addEventListener('touchcancel', onTouchEnd);
    el.addEventListener('gesturestart', onGesture);
    el.addEventListener('gesturechange', onGesture);
    return () => {
      el.removeEventListener('touchstart', onTouchStart);
      el.removeEventListener('touchmove', onTouchMove);
      el.removeEventListener('touchend', onTouchEnd);
      el.removeEventListener('touchcancel', onTouchEnd);
      el.removeEventListener('gesturestart', onGesture);
      el.removeEventListener('gesturechange', onGesture);
    };
  }, [containerRef]);

  const reset = useCallback(() => setZoom(IDENTITY), []);
  return { zoom, reset };
}
