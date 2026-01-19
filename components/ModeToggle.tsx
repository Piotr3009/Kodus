/**
 * ModeToggle - przełącznik między trybem prostym (tylko Claude) a pełnym (3 LLM)
 */

'use client';

import { Sparkles, Bot, Wand2, Zap } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import type { TaskMode } from '@/lib/types';
import { cn } from '@/lib/utils';

interface ModeToggleProps {
  mode: TaskMode;
  onChange: (mode: TaskMode) => void;
}

export function ModeToggle({ mode, onChange }: ModeToggleProps) {
  const isFullMode = mode === 'full';

  const handleChange = (checked: boolean) => {
    onChange(checked ? 'full' : 'simple');
  };

  return (
    <div
      className={cn(
        'flex items-center justify-between gap-4 p-3 rounded-lg border transition-colors',
        isFullMode ? 'bg-primary/10 border-primary/30' : 'bg-muted/30 border-border'
      )}
    >
      {/* Lewa strona - etykieta i opis */}
      <div className="flex items-center gap-3">
        {isFullMode ? (
          <div className="flex items-center gap-1">
            <Sparkles className="h-4 w-4 text-orange-500" />
            <Bot className="h-4 w-4 text-green-500" />
            <Wand2 className="h-4 w-4 text-blue-500" />
          </div>
        ) : (
          <Zap className="h-5 w-5 text-yellow-500" />
        )}
        <div>
          <Label
            htmlFor="mode-toggle"
            className="font-medium cursor-pointer"
          >
            {isFullMode ? 'Tryb pełny' : 'Tryb prosty'}
          </Label>
          <p className="text-xs text-muted-foreground">
            {isFullMode
              ? 'Claude + GPT review + Gemini review'
              : 'Tylko Claude (szybciej)'}
          </p>
        </div>
      </div>

      {/* Prawa strona - switch */}
      <Switch
        id="mode-toggle"
        checked={isFullMode}
        onCheckedChange={handleChange}
      />
    </div>
  );
}

export default ModeToggle;
