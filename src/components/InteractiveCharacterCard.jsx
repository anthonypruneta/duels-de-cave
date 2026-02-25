/**
 * Wrapper pour la carte personnage sur la page d'accueil uniquement.
 * Permet d'observer la carte avec la souris (effet parallax 3D) et de la retourner pour afficher le verso.
 */

import React, { useState, useRef, useCallback } from 'react';

import cardBackImage from '../assets/backgrounds/BG.png';

const PARALLAX_SENSITIVITY = 12;
const PARALLAX_MAX = 15;

export default function InteractiveCharacterCard({ children, className = '' }) {
  const [rotateX, setRotateX] = useState(0);
  const [rotateY, setRotateY] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const cardRef = useRef(null);

  const handleMouseMove = useCallback((e) => {
    const el = cardRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    const percentX = (e.clientX - centerX) / (rect.width / 2);
    const percentY = (e.clientY - centerY) / (rect.height / 2);
    setRotateY(Math.max(-PARALLAX_MAX, Math.min(PARALLAX_MAX, percentX * PARALLAX_SENSITIVITY)));
    setRotateX(Math.max(-PARALLAX_MAX, Math.min(PARALLAX_MAX, -percentY * PARALLAX_SENSITIVITY)));
  }, []);

  const handleMouseLeave = useCallback(() => {
    setRotateX(0);
    setRotateY(0);
  }, []);

  const toggleFlip = useCallback(() => {
    setIsFlipped((prev) => !prev);
  }, []);

  const flipDeg = isFlipped ? 180 : 0;
  const transform = `perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) rotateY(${flipDeg}deg)`;

  return (
    <div
      className={`relative w-full max-w-[340px] mx-auto ${className}`.trim()}
      style={{ perspective: '1200px' }}
    >
      <div
        ref={cardRef}
        className="relative w-full cursor-pointer transition-transform duration-200 ease-out"
        style={{
          transformStyle: 'preserve-3d',
          transform,
        }}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        onClick={toggleFlip}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggleFlip(); } }}
        role="button"
        tabIndex={0}
        aria-label={isFlipped ? 'Retourner la carte (face personnage)' : 'Retourner la carte (voir le verso)'}
      >
        {/* Face avant : contenu de la carte */}
        <div
          className="relative w-full"
          style={{
            backfaceVisibility: 'hidden',
            WebkitBackfaceVisibility: 'hidden',
          }}
        >
          {children}
        </div>

        {/* Face arrière : verso (BG.png) */}
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
        Clique pour retourner la carte · Bouge la souris pour l’observer
      </p>
    </div>
  );
}
