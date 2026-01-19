'use client';

/**
 * TypingIndicator - pokazuje kto aktualnie "pisze"
 * Animowane kropki + avatar AI
 */

import { AI_PERSONALITIES } from '@/lib/constants';
import type { AISender } from '@/lib/types';

interface TypingIndicatorProps {
  sender: AISender;
  queue?: AISender[];
}

export function TypingIndicator({ sender, queue = [] }: TypingIndicatorProps) {
  const info = AI_PERSONALITIES[sender];

  return (
    <div className="flex items-center gap-3 p-4 bg-zinc-900/50 rounded-lg">
      {/* Avatar */}
      <div
        className="flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center text-lg animate-pulse"
        style={{ backgroundColor: info.bgColor }}
      >
        {info.avatar}
      </div>

      {/* Info */}
      <div className="flex-1">
        <div className="flex items-center gap-2">
          <span className="font-medium" style={{ color: info.color }}>
            {info.displayName}
          </span>
          <span className="text-xs text-zinc-500">pisze...</span>
        </div>

        {/* Animowane kropki */}
        <div className="flex gap-1 mt-1">
          <span
            className="w-2 h-2 rounded-full animate-bounce"
            style={{ backgroundColor: info.color, animationDelay: '0ms' }}
          />
          <span
            className="w-2 h-2 rounded-full animate-bounce"
            style={{ backgroundColor: info.color, animationDelay: '150ms' }}
          />
          <span
            className="w-2 h-2 rounded-full animate-bounce"
            style={{ backgroundColor: info.color, animationDelay: '300ms' }}
          />
        </div>
      </div>

      {/* Kolejka */}
      {queue.length > 0 && (
        <div className="flex items-center gap-1 text-xs text-zinc-500">
          <span>Następni:</span>
          {queue.map((q) => (
            <span key={q} title={AI_PERSONALITIES[q].displayName}>
              {AI_PERSONALITIES[q].avatar}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
