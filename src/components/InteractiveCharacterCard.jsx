/**
 * Wrapper pour la zone image de la carte personnage (page d'accueil uniquement).
 * Déplacement 3D au clic-maintenu + glisser. Clic simple = retourner la carte (verso).
 * N'enveloppe que la zone image (pas les stats/armes/passifs).
 */

import React, { useState, useRef, useCallback, useEffect } from 'react';

import cardBackImage from '../assets/backgrounds/BG.png';

const PARALLAX_SENSITIVITY = 0.25;
const PARALLAX_MAX = 18;

export default function InteractiveCharacterCard({ children, className = '' }) {
  const [rotateX, setRotateX] = useState(0);
  const [rotateY, setRotateY] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = useRef({ x: 0, y: 0, rotateX: 0, rotateY: 0 });
  const didDragRef = useRef(false);
  const cardRef = useRef(null);

  const handleMouseDown = useCallback((e) => {
    if (e.button !== 0) return;
    didDragRef.current = false;
    setIsDragging(true);
    dragStartRef.current = {
      x: e.clientX,
      y: e.clientY,
      rotateX,
      rotateY,
    };
  }, [rotateX, rotateY]);

  const handleMouseMove = useCallback((e) => {
    if (!isDragging) return;
    const { x, y, rotateX: startRX, rotateY: startRY } = dragStartRef.current;
    const deltaX = e.clientX - x;
    const deltaY = e.clientY - y;
    if (Math.abs(deltaX) > 4 || Math.abs(deltaY) > 4) didDragRef.current = true;
    const newRY = Math.max(-PARALLAX_MAX, Math.min(PARALLAX_MAX, startRY + deltaX * PARALLAX_SENSITIVITY));
    const newRX = Math.max(-PARALLAX_MAX, Math.min(PARALLAX_MAX, startRX - deltaY * PARALLAX_SENSITIVITY));
    setRotateY(newRY);
    setRotateX(newRX);
  }, [isDragging]);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  const handleMouseLeave = useCallback(() => {
    setIsDragging(false);
  }, []);

  useEffect(() => {
    if (!isDragging) return;
    const onUp = () => setIsDragging(false);
    window.addEventListener('mouseup', onUp);
    return () => window.removeEventListener('mouseup', onUp);
  }, [isDragging]);

  const toggleFlip = useCallback((e) => {
    e.stopPropagation();
    setIsFlipped((prev) => !prev);
  }, []);

  const handleClick = useCallback((e) => {
    if (didDragRef.current) return;
    toggleFlip(e);
  }, [toggleFlip]);

  const flipDeg = isFlipped ? 180 : 0;
  const transform = `perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) rotateY(${flipDeg}deg)`;

  return (
    <div
      className={`relative w-full ${className}`.trim()}
      style={{ perspective: '1200px' }}
    >
      <div
        ref={cardRef}
        className="relative w-full select-none cursor-grab active:cursor-grabbing transition-transform duration-150 ease-out"
        style={{
          transformStyle: 'preserve-3d',
          transform,
        }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseLeave}
        onClick={handleClick}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggleFlip(e); } }}
        role="button"
        tabIndex={0}
        aria-label={isFlipped ? 'Retourner la carte (face personnage)' : 'Retourner la carte (voir le verso)'}
      >
        <div
          className="relative w-full"
          style={{
            backfaceVisibility: 'hidden',
            WebkitBackfaceVisibility: 'hidden',
          }}
        >
          {children}
        </div>

        <div
          className="absolute inset-0 w-full border border-stone-600 bg-stone-900 overflow-hidden rounded-sm"
          style={{
            backfaceVisibility: 'hidden',
            WebkitBackfaceVisibility: 'hidden',
            transform: 'rotateY(180deg)',
            backgroundImage: `url(${cardBackImage})`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
          }}
        />
      </div>

      <p className="text-center text-stone-500 text-xs mt-2">
        Clic maintenu + glisser pour observer · Clic pour retourner
      </p>
    </div>
  );
}
