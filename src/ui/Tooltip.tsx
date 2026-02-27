import React, { useRef, useState, useLayoutEffect } from 'react';
import { createPortal } from 'react-dom';

export const Tooltip = ({ content, targetRect, pointerEvents = 'none', onMouseEnter, onMouseLeave, disableCollision = false }: { content: React.ReactNode, targetRect: DOMRect, pointerEvents?: 'none' | 'auto', onMouseEnter?: () => void, onMouseLeave?: () => void, disableCollision?: boolean }) => {
  const tooltipRef = useRef<HTMLDivElement>(null);
  const [style, setStyle] = useState<React.CSSProperties>({ opacity: 0 });
  const tooltipId = useRef(Math.random().toString(36).substr(2, 9));

  useLayoutEffect(() => {
    if (tooltipRef.current && targetRect) {
      const rect = tooltipRef.current.getBoundingClientRect();
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;
      const margin = 8;
      const padding = 10;

      let left = targetRect.left + (targetRect.width / 2) - (rect.width / 2);

      if (left < padding) left = padding;
      if (left + rect.width > viewportWidth - padding) {
        left = viewportWidth - rect.width - padding;
      }

      let top = targetRect.top - rect.height - margin;

      if (top < padding) {
        const bottomPosition = targetRect.bottom + margin;
        if (bottomPosition + rect.height <= viewportHeight - padding) {
            top = bottomPosition;
        } else {
            if (targetRect.top > (viewportHeight - targetRect.bottom)) {
                top = padding;
            } else {
                top = viewportHeight - rect.height - padding;
            }
        }
      }

      // Gestion des superpositions (Collision Detection)
      let finalTop = top;
      let finalLeft = left;
      
      if (!disableCollision) {
        const width = rect.width;
        const height = rect.height;
        
        const others = ((window as any).__SETI_TOOLTIPS__ || []).filter((t: any) => t.id !== tooltipId.current);
        let collision = true;
        let iterations = 0;

        while (collision && iterations < 10) {
            collision = false;
            const myRect = { left: finalLeft, top: finalTop, right: finalLeft + width, bottom: finalTop + height };
            
            for (const other of others) {
                const otherRect = other.rect;
                if (myRect.left < otherRect.right &&
                    myRect.right > otherRect.left &&
                    myRect.top < otherRect.bottom &&
                    myRect.bottom > otherRect.top) {
                    
                    // Collision détectée : on décale vers le bas
                    finalTop = otherRect.bottom + 5;
                    collision = true;
                    
                    // Si on sort de l'écran en bas, on essaie de décaler à droite
                    if (finalTop + height > viewportHeight - 10) {
                        finalTop = top; // Reset top
                        finalLeft = otherRect.right + 5;
                    }
                    break;
                }
            }
            iterations++;
        }
      }

      // Enregistrer la position finale
      if (!disableCollision) {
        const registry = (window as any).__SETI_TOOLTIPS__ || [];
        (window as any).__SETI_TOOLTIPS__ = [...registry.filter((t: any) => t.id !== tooltipId.current), { id: tooltipId.current, rect: { left: finalLeft, top: finalTop, right: finalLeft + rect.width, bottom: finalTop + rect.height } }];
      }

      setStyle({
        top: finalTop,
        left: finalLeft,
        opacity: 1
      });

      return () => {
          if (!disableCollision) {
            const reg = (window as any).__SETI_TOOLTIPS__ || [];
            (window as any).__SETI_TOOLTIPS__ = reg.filter((t: any) => t.id !== tooltipId.current);
          }
      };
    }
    return;
  }, [targetRect, content, disableCollision]);

  return createPortal(
    <div
      ref={tooltipRef}
      style={{
        position: 'fixed',
        zIndex: 20000,
        backgroundColor: 'rgba(0, 0, 0, 0.9)',
        padding: '6px 10px',
        borderRadius: '4px',
        border: '1px solid #78a0ff',
        color: '#fff',
        textAlign: 'center',
        minWidth: '120px',
        whiteSpace: 'pre-line',
        boxShadow: '0 2px 10px rgba(0,0,0,0.5)',
        transition: 'opacity 0.1s ease-in-out',
        pointerEvents,
        ...style
      }}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      {content}
    </div>
  , document.body);
};
