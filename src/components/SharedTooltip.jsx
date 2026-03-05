import React, { useState, useRef, useCallback, useEffect } from 'react';
import { createPortal } from 'react-dom';

/** Tooltip partagé (z-[9999]) pour afficher au-dessus des autres éléments. */
/** Rendu dans un portail (document.body) en position fixed pour ne pas être coupé par overflow des parents. */
/** tooltipClassName : optionnel, ex. "whitespace-normal px-4 py-3 leading-relaxed max-w-[320px]" */
export default function SharedTooltip({ children, content, tooltipClassName = '' }) {
  const [visible, setVisible] = useState(false);
  const [coords, setCoords] = useState({ top: 0, left: 0 });
  const triggerRef = useRef(null);

  const updatePosition = useCallback(() => {
    if (!triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    setCoords({
      left: rect.left + rect.width / 2,
      top: rect.top,
    });
  }, []);

  const handleMouseEnter = useCallback(() => {
    if (triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      setCoords({ left: rect.left + rect.width / 2, top: rect.top });
    }
    setVisible(true);
  }, []);

  const handleMouseLeave = useCallback(() => {
    setVisible(false);
  }, []);

  useEffect(() => {
    if (!visible) return;
    const onScrollOrResize = () => updatePosition();
    window.addEventListener('scroll', onScrollOrResize, true);
    window.addEventListener('resize', onScrollOrResize);
    return () => {
      window.removeEventListener('scroll', onScrollOrResize, true);
      window.removeEventListener('resize', onScrollOrResize);
    };
  }, [visible, updatePosition]);

  const baseClasses = 'fixed bg-stone-900 border border-amber-500 rounded-lg text-sm text-white transition-opacity duration-200 pointer-events-none z-[9999] shadow-lg';
  const defaultClasses = 'px-3 py-2 whitespace-nowrap';
  const classes = tooltipClassName ? `${baseClasses} ${tooltipClassName}` : `${baseClasses} ${defaultClasses}`;

  const tooltipEl = visible && content && createPortal(
    <span
      className={classes}
      style={{
        left: coords.left,
        top: coords.top,
        transform: 'translate(-50%, calc(-100% - 8px))',
        opacity: visible ? 1 : 0,
      }}
    >
      {content}
      <span className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-amber-500" />
    </span>,
    document.body
  );

  return (
    <span
      ref={triggerRef}
      className="relative group cursor-help"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {children}
      {tooltipEl}
    </span>
  );
}
