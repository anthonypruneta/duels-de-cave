import React from 'react';

const UnifiedCharacterCard = ({
  header,
  name,
  image,
  fallback,
  topStats,
  hpText,
  hpPercent,
  hpClass,
  shieldPercent = 0,
  mainStats,
  details,
  cardClassName = ''
}) => {
  return (
    <div className={`relative shadow-2xl overflow-visible ${cardClassName}`.trim()}>
      {header && (
        <div className="absolute top-3 left-1/2 -translate-x-1/2 bg-stone-800 text-stone-200 px-5 py-1.5 text-sm font-bold shadow-lg border border-stone-500 z-10">
          {header}
        </div>
      )}
      <div className="overflow-visible">
        <div className="h-auto relative bg-stone-900 flex items-center justify-center">
          {image ? (
            <img src={image} alt={name} className="w-full h-auto object-contain" />
          ) : (
            <div className="w-full h-48 flex items-center justify-center">{fallback}</div>
          )}
          <div className="absolute bottom-4 left-4 right-4 bg-black/80 p-3">
            <div className="text-white font-bold text-xl text-center">{name}</div>
          </div>
        </div>

        <div className="bg-stone-800 p-4 border-t border-stone-600">
          {(topStats || hpText) && (
            <div className="mb-3">
              {topStats && <div className="flex justify-between text-sm text-white mb-2">{topStats}</div>}
              {hpText && <div className="text-xs text-stone-400 mb-2">{hpText}</div>}
              {typeof hpPercent === 'number' && (
                <div className="bg-stone-900 h-3 overflow-hidden border border-stone-600">
                  <div className={`h-full transition-all duration-500 ${hpClass || 'bg-green-500'}`} style={{ width: `${hpPercent}%` }} />
                </div>
              )}
              {shieldPercent > 0 && (
                <div className="mt-1 bg-stone-900 h-2 overflow-hidden border border-blue-700">
                  <div className="h-full transition-all duration-500 bg-blue-500" style={{ width: `${shieldPercent}%` }} />
                </div>
              )}
            </div>
          )}

          {mainStats && <div className="grid grid-cols-2 gap-2 text-sm mb-3">{mainStats}</div>}
          {details && <div className="space-y-2">{details}</div>}
        </div>
      </div>
    </div>
  );
};

export default UnifiedCharacterCard;
