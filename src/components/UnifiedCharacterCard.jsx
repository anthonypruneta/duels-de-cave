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
  // Nom : police stylisée + contour noir (classe CSS .character-card-name)
  const nameStyle = {
    color: 'rgb(254 243 199)', // amber-100
    textShadow: '0 0 2px #000, 1px 1px 0 #000, -1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000',
  };

  return (
    <div className={`w-full max-w-[340px] mx-auto ${cardClassName}`.trim()}>
      <div className="relative shadow-2xl">
        <div className="absolute top-3 left-1/2 -translate-x-1/2 bg-stone-800 text-amber-200 px-5 py-1 text-xs font-bold shadow-lg z-10 border border-stone-600 text-center whitespace-nowrap">
          {header}
        </div>

        <div className="overflow-visible border border-stone-600 bg-stone-900">
          <div className="relative bg-stone-900 flex items-center justify-center">
            {image ? (
              <img src={image} alt={name} className="w-full h-auto object-contain" />
            ) : (
              <div className="w-full h-48 flex items-center justify-center">{fallback}</div>
            )}
            <div className="absolute bottom-5 left-2 right-2 py-1 text-center">
              <div className="character-card-name font-bold text-lg leading-tight" style={nameStyle}>{name}</div>
            </div>
          </div>

          <div className="bg-stone-800 p-3 border-t border-stone-600">
            {topStats && (
              <div className="flex justify-between text-xs text-white mb-2 font-bold">
                {topStats}
              </div>
            )}
            {hpText && <div className="text-xs text-stone-400 mb-2">{hpText}</div>}
            {typeof hpPercent === 'number' && (
              <div className="bg-stone-900 h-3 overflow-hidden border border-stone-600 mb-3">
                <div className={`h-full transition-all duration-500 ease-out ${hpClass || 'bg-green-500'}`} style={{ width: `${Math.max(0, Math.min(100, hpPercent))}%` }} />
              </div>
            )}
            {shieldPercent > 0 && (
              <div className="mt-1 mb-3 bg-stone-900 h-2 overflow-hidden border border-blue-700">
                <div className="h-full transition-all duration-500 ease-out bg-blue-500" style={{ width: `${shieldPercent}%` }} />
              </div>
            )}

            {mainStats && <div className="grid grid-cols-2 gap-1 mb-3 text-xs text-gray-300">{mainStats}</div>}
            {details && <div className="space-y-2">{details}</div>}
          </div>
        </div>
      </div>
    </div>
  );
};

export default UnifiedCharacterCard;
