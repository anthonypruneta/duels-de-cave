import React from 'react';
import CardBorderCanvas from './CardBorderCanvas';
import { resolveBorderId, getBorderGlowClass } from '../data/borders';
import { getRealBorderImageSrc } from '../utils/realBorderImageSrc';

const SIZE_MAP = {
  xs: 'w-7 h-7',
  sm: 'w-9 h-9',
  md: 'w-14 h-14',
  lg: 'w-28 h-28',
};

/**
 * Portrait participant tournoi (arbre, liste, champion) avec bordures Canvas + PNG comme en combat.
 */
export default function TournamentParticipantPortrait({
  imageUrl,
  equippedBorder,
  equippedRealBorder,
  size = 'xs',
  className = '',
  lost = false,
  alt = '',
}) {
  const resolved = resolveBorderId(equippedBorder);
  const hasCanvas = resolved && resolved !== 'default';
  const glowCls = hasCanvas ? (getBorderGlowClass(resolved) || '') : '';
  const realSrc = getRealBorderImageSrc(equippedRealBorder);
  const box = SIZE_MAP[size] || SIZE_MAP.xs;
  const imgFit = size === 'lg' ? 'object-contain' : 'object-cover';

  if (!imageUrl) {
    return (
      <div
        className={`${box} rounded-md bg-stone-800/80 flex items-center justify-center text-stone-600 text-[10px] shrink-0 ${lost ? 'opacity-30 grayscale' : ''} ${className}`}
      >
        ?
      </div>
    );
  }

  return (
    <div
      className={`relative ${box} rounded-md overflow-hidden shrink-0 ${glowCls} ${lost ? 'opacity-30 grayscale' : ''} ${className}`}
    >
      <img
        src={imageUrl}
        alt={alt}
        className={`relative z-[1] w-full h-full ${imgFit}`}
      />
      {hasCanvas && <CardBorderCanvas borderId={resolved} imageSrc={imageUrl} />}
      {realSrc ? (
        <img
          src={realSrc}
          alt=""
          className="absolute inset-0 w-full h-full object-contain pointer-events-none z-[5]"
        />
      ) : null}
    </div>
  );
}
