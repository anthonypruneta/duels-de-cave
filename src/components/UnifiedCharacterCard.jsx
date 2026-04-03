import React, { useState, useEffect, useRef } from 'react';
import CardBorderCanvas from './CardBorderCanvas';
import { resolveBorderId, getBorderGlowClass } from '../data/borders';
import { getRealBorderImageSrc } from '../utils/realBorderImageSrc';

const BAR_ANIMATION_MS = 500;

function easeOutCubic(t) {
  return 1 - (1 - t) ** 3;
}

function animateValue(from, to, durationMs, onUpdate, onComplete) {
  const start = performance.now();
  let rafId;
  const tick = (now) => {
    const elapsed = now - start;
    const t = Math.min(1, elapsed / durationMs);
    const eased = easeOutCubic(t);
    const value = from + (to - from) * eased;
    onUpdate(value);
    if (t < 1) {
      rafId = requestAnimationFrame(tick);
    } else if (onComplete) {
      onComplete();
    }
  };
  rafId = requestAnimationFrame(tick);
  return () => cancelAnimationFrame(rafId);
}

const UnifiedCharacterCard = ({
  header,
  name,
  title = null,
  image,
  fallback,
  topStats,
  hpText,
  hpPercent,
  hpClass,
  shieldPercent = 0,
  mainStats,
  details,
  cardClassName = '',
  aboveHpBar = null,
  /** 'left' | 'right' | null — place les infos à gauche ou droite de l'image (layout horizontal en combat) */
  infoSide = null,
  /** Masquer la section info sur lg (quand les stats/details sont dans un panneau latéral externe) */
  hideInfoOnLg = false,
  /** ID de bordure cosmétique (ex: 'lava', 'ice') — accepte aussi les anciennes classes CSS */
  borderId = null,
  /** Bordure PNG (overlay UI) — ex: 'or' ou 'or.png' (assets/backgrounds, hors BG/*Old) */
  realBorderId = null,
  /** Contenu overlay sur l'image (ex: brume du miroir) */
  imageOverlayContent = null,
  /** Classe CSS additionnelle sur l'image (ex: 'scale-x-[-1]' pour miroir) */
  imageClassName = '',
  /** Si true, l'effet Canvas bordure n'apparaît que sur l'image (pas sur les stats/infos) */
  borderOnImageOnly = false,
}) => {
  const targetHp = typeof hpPercent === 'number' ? Math.max(0, Math.min(100, hpPercent)) : null;
  const targetShield = Math.max(0, Math.min(100, shieldPercent));

  const [displayedHp, setDisplayedHp] = useState(targetHp ?? 100);
  const [displayedShield, setDisplayedShield] = useState(targetShield);
  const prevTargetHpRef = useRef(targetHp);
  const prevTargetShieldRef = useRef(targetShield);

  useEffect(() => {
    if (targetHp === null) return;
    if (targetHp >= 99.5) {
      setDisplayedHp(100);
      prevTargetHpRef.current = targetHp;
    }
  }, [targetHp]);

  useEffect(() => {
    if (targetHp === null) return;
    if (prevTargetHpRef.current === targetHp) return;
    prevTargetHpRef.current = targetHp;
    if (targetHp >= 99.5) return;
    const cancel = animateValue(displayedHp, targetHp, BAR_ANIMATION_MS, setDisplayedHp);
    return cancel;
  }, [targetHp]);

  useEffect(() => {
    if (prevTargetShieldRef.current === targetShield) return;
    prevTargetShieldRef.current = targetShield;
    const cancel = animateValue(displayedShield, targetShield, BAR_ANIMATION_MS, setDisplayedShield);
    return cancel;
  }, [targetShield]);

  const nameStyle = {
    color: 'rgb(254 243 199)',
    textShadow: '0 0 2px #000, 1px 1px 0 #000, -1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000',
  };

  const resolvedBorder = resolveBorderId(borderId);
  const hasCanvasBorder = resolvedBorder && resolvedBorder !== 'default';
  const isAncient = resolvedBorder === 'ancient';
  const glowCls = hasCanvasBorder ? (getBorderGlowClass(resolvedBorder) || '') : '';
  const baseBorder = hasCanvasBorder && !borderOnImageOnly ? '' : 'border border-stone-600';

  const canvasOverlay = hasCanvasBorder ? <CardBorderCanvas borderId={resolvedBorder} imageSrc={image || null} /> : null;

  const wrapperGlow = borderOnImageOnly ? '' : glowCls;
  // Filtre "vieille télé" : contraste fort + très peu de couleur + légère baisse de luminosité
  const wrapperStyle = isAncient
    ? { filter: 'grayscale(1) contrast(1.42) brightness(0.96) saturate(0.15)' }
    : undefined;

  const realBorderSrc = getRealBorderImageSrc(realBorderId);

  const imageSection = (
    <div
      className={`relative bg-stone-900 flex items-center justify-center overflow-hidden ${infoSide ? 'w-[220px] flex-shrink-0' : ''} ${borderOnImageOnly && glowCls ? glowCls : ''}`}
      style={wrapperStyle}
    >
      {image ? (
        <img
          src={image}
          alt={name}
          className={`relative z-[1] w-full h-auto object-contain ${imageClassName || ''}`}
        />
      ) : (
        <>
          {/* Important : ne pas “créer” une hauteur fixe ici.
              On laisse la taille du contenu `fallback` déterminer la hauteur de la zone image,
              sinon la zone se retrouve trop petite quand l'image n'existe pas. */}
          <div className="relative z-[1] w-full flex items-center justify-center">{fallback}</div>
        </>
      )}
      {imageOverlayContent && (
        <div className="absolute inset-0 z-[2] pointer-events-none flex items-center justify-center overflow-hidden">
          {imageOverlayContent}
        </div>
      )}
      {canvasOverlay}
      {realBorderSrc && (
        <img
          src={realBorderSrc}
          alt=""
          className="absolute inset-0 w-full h-full object-contain pointer-events-none z-[5]"
        />
      )}
      <div className={`absolute ${title ? 'bottom-2' : 'bottom-5'} left-2 right-2 py-1 text-center z-[10]`}>
        <div className="character-card-name font-bold text-lg leading-tight" style={nameStyle}>{name}</div>
        {title && (
          <div className="character-card-name text-sm leading-tight mt-0.5" style={nameStyle}>{title}</div>
        )}
      </div>
    </div>
  );

  const infoSection = (
    <div className={`bg-stone-800 p-3 ${infoSide ? 'flex-1 overflow-y-auto overflow-x-hidden min-w-0' : 'border-t border-stone-600'} ${hideInfoOnLg ? 'lg:hidden' : ''}`}>
      {topStats && (
        <div className="flex justify-between text-xs text-white mb-2 font-bold">
          {topStats}
        </div>
      )}
      {hpText && <div className="text-xs text-stone-400 mb-2">{hpText}</div>}
      {aboveHpBar && <div className="flex flex-wrap gap-1 mb-2 justify-center">{aboveHpBar}</div>}
      {typeof hpPercent === 'number' && (
        <div className="bg-stone-900 h-3 overflow-hidden border border-stone-600 mb-3">
          <div className={`h-full ${hpClass || 'bg-green-500'}`} style={{ width: `${displayedHp}%` }} />
        </div>
      )}
      {(displayedShield > 0 || targetShield > 0) && (
        <div className="mt-1 mb-3 bg-stone-900 h-2 overflow-hidden border border-blue-700">
          <div className="h-full bg-blue-500" style={{ width: `${displayedShield}%` }} />
        </div>
      )}
      {mainStats && <div className="grid grid-cols-2 gap-1 mb-3 text-xs text-gray-300">{mainStats}</div>}
      {details && <div className="space-y-2">{details}</div>}
    </div>
  );

  if (infoSide) {
    return (
      <div className={`w-full ${cardClassName}`.trim()}>
        <div className={`relative shadow-2xl overflow-hidden ${wrapperGlow}`}>
          <div className="absolute top-3 left-1/2 -translate-x-1/2 bg-stone-800 text-amber-200 px-4 py-1 text-[11px] font-bold shadow-lg z-10 border border-stone-600 text-center whitespace-nowrap">
            {header}
          </div>
          <div className={`${baseBorder} bg-stone-900 hidden md:flex md:flex-row`}>
            {infoSide === 'left' ? <>{infoSection}{imageSection}</> : <>{imageSection}{infoSection}</>}
          </div>
          <div className={`${baseBorder} bg-stone-900 md:hidden`}>
            {imageSection}
            {infoSection}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`w-full max-w-[340px] mx-auto ${cardClassName}`.trim()}>
      <div className={`relative shadow-2xl overflow-hidden ${wrapperGlow}`}>
        <div className="absolute top-3 left-1/2 -translate-x-1/2 bg-stone-800 text-amber-200 px-5 py-1 text-xs font-bold shadow-lg z-10 border border-stone-600 text-center whitespace-nowrap">
          {header}
        </div>
        <div className={`${baseBorder} bg-stone-900`}>
          {imageSection}
          {infoSection}
        </div>
      </div>
    </div>
  );
};

export default UnifiedCharacterCard;
