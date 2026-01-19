'use client';

/**
 * ModeSelector - wybór trybu chatu (Solo/Duo/Team)
 */

import { CHAT_MODES } from '@/lib/constants';
import type { ChatMode } from '@/lib/types';
import { cn } from '@/lib/utils';

interface ModeSelectorProps {
  mode: ChatMode;
  onChange: (mode: ChatMode) => void;
  disabled?: boolean;
  size?: 'sm' | 'md';
}

export function ModeSelector({ mode, onChange, disabled, size = 'md' }: ModeSelectorProps) {
  const modes: ChatMode[] = ['solo', 'duo', 'team'];

  return (
    <div className="flex gap-1 p-1 bg-zinc-800 rounded-lg">
      {modes.map((m) => {
        const info = CHAT_MODES[m];
        const isActive = mode === m;

        return (
          <button
            key={m}
            onClick={() => onChange(m)}
            disabled={disabled}
            title={info.description}
            className={cn(
              'flex items-center gap-1.5 px-3 py-1.5 rounded-md transition-all',
              'text-sm font-medium',
              size === 'sm' && 'px-2 py-1 text-xs',
              isActive
                ? 'bg-zinc-700 text-white'
                : 'text-zinc-400 hover:text-white hover:bg-zinc-700/50',
              disabled && 'opacity-50 cursor-not-allowed'
            )}
          >
            <span className="text-base">{info.icons}</span>
            <span className="hidden sm:inline">{info.label}</span>
          </button>
        );
      })}
    </div>
  );
}
