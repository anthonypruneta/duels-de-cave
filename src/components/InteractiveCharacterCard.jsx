/**
 * Wrapper pour la zone image de la carte personnage (page d'accueil uniquement).
 * Glisser horizontal = passer recto/verso. Glisser vertical = inclinaison 3D. Clic = position par défaut.
 */

import React, { useState, useRef, useCallback, useEffect } from 'react';

import cardBackImage from '../assets/backgrounds/BG.png';

const TILT_SENSITIVITY = 0.25;
const TILT_MAX = 18;
const FLIP_SENSITIVITY = 1.2; // degrés par pixel (glisser ~150px = retourner)

export default function InteractiveCharacterCard({ children, className = '' }) {
  const [rotateX, setRotateX] = useState(0);
  const [rotateY, setRotateY] = useState(0);
  const [flipAngle, setFlipAngle] = useState(0); // 0 = recto, 180 = verso (continu pendant le drag)
  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = useRef({ x: 0, y: 0, rotateX: 0, rotateY: 0, flipAngle: 0 });
  const cardRef = useRef(null);

  const handleMouseDown = useCallback((e) => {
    if (e.button !== 0) return;
    setIsDragging(true);
    dragStartRef.current = {
      x: e.clientX,
      y: e.clientY,
      rotateX,
      rotateY,
      flipAngle,
    };
  }, [rotateX, rotateY, flipAngle]);

  const handleMouseMove = useCallback((e) => {
    if (!isDragging) return;
    const { x, y, rotateX: startRX, rotateY: startRY, flipAngle: startFlip } = dragStartRef.current;
    const deltaX = e.clientX - x;
    const deltaY = e.clientY - y;
    const newFlip = Math.max(0, Math.min(180, startFlip + deltaX * FLIP_SENSITIVITY));
    const newRY = Math.max(-TILT_MAX, Math.min(TILT_MAX, startRY + deltaX * TILT_SENSITIVITY));
    const newRX = Math.max(-TILT_MAX, Math.min(TILT_MAX, startRX - deltaY * TILT_SENSITIVITY));
    setFlipAngle(newFlip);
    setRotateY(newRY);
    setRotateX(newRX);
  }, [isDragging]);

  const handleMouseUp = useCallback(() => {
    if (!isDragging) return;
    setIsDragging(false);
    setFlipAngle((current) => (current >= 90 ? 180 : 0));
  }, [isDragging]);

  const handleMouseLeave = useCallback(() => {
    if (isDragging) {
      setFlipAngle((current) => (current >= 90 ? 180 : 0));
    }
    setIsDragging(false);
  }, [isDragging]);

  useEffect(() => {
    if (!isDragging) return;
    const onUp = () => {
      setIsDragging(false);
      setFlipAngle((current) => (current >= 90 ? 180 : 0));
    };
    window.addEventListener('mouseup', onUp);
    return () => window.removeEventListener('mouseup', onUp);
  }, [isDragging]);

  const resetRotation = useCallback(() => {
    setRotateX(0);
    setRotateY(0);
  }, []);

  const handleClick = useCallback((e) => {
    resetRotation();
  }, [resetRotation]);

  const transform = `perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) rotateY(${flipAngle}deg)`;

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
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); if (e.repeat) return; resetRotation(); } }}
        role="button"
        tabIndex={0}
        aria-label="Glisser pour observer ou retourner la carte, clic pour position par défaut"
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
    </div>
  );
}
