'use client';

/**
 * TechStackSelector - multi-select do wyboru technologii projektu
 * Zapisuje do projektu przez Supabase
 */

import { useState, useCallback, useEffect } from 'react';
import { Check, X, ChevronDown, Code2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { cn } from '@/lib/utils';

// Dostępne technologie
const TECH_OPTIONS = [
  // Frontend frameworks
  { value: 'React', category: 'Frontend' },
  { value: 'Vue', category: 'Frontend' },
  { value: 'Angular', category: 'Frontend' },
  { value: 'Svelte', category: 'Frontend' },
  { value: 'Next.js', category: 'Frontend' },
  { value: 'Nuxt', category: 'Frontend' },
  // Backend
  { value: 'Node.js', category: 'Backend' },
  { value: 'Express', category: 'Backend' },
  { value: 'Python', category: 'Backend' },
  { value: 'FastAPI', category: 'Backend' },
  { value: 'Django', category: 'Backend' },
  // Languages
  { value: 'TypeScript', category: 'Language' },
  { value: 'JavaScript', category: 'Language' },
  // Styling
  { value: 'Tailwind', category: 'Styling' },
  // Databases
  { value: 'PostgreSQL', category: 'Database' },
  { value: 'MongoDB', category: 'Database' },
  { value: 'Supabase', category: 'Database' },
  { value: 'Firebase', category: 'Database' },
];

interface TechStackSelectorProps {
  projectId: string;
  initialStack?: string[];
  onUpdate?: (stack: string[]) => void;
  disabled?: boolean;
}

export function TechStackSelector({
  projectId,
  initialStack = [],
  onUpdate,
  disabled = false,
}: TechStackSelectorProps) {
  const [selectedTech, setSelectedTech] = useState<string[]>(initialStack);
  const [isOpen, setIsOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Synchronizuj z initialStack
  useEffect(() => {
    setSelectedTech(initialStack);
  }, [initialStack]);

  // Toggle technologii
  const toggleTech = useCallback(
    async (tech: string) => {
      if (disabled) return;

      const newStack = selectedTech.includes(tech)
        ? selectedTech.filter((t) => t !== tech)
        : [...selectedTech, tech];

      setSelectedTech(newStack);
      setError(null);

      // Zapisz do Supabase
      setIsSaving(true);
      try {
        const { error: updateError } = await supabase
          .from('projects')
          .update({ tech_stack: newStack })
          .eq('id', projectId);

        if (updateError) throw updateError;

        onUpdate?.(newStack);
      } catch (err) {
        console.error('Błąd zapisywania tech stack:', err);
        setError('Nie udało się zapisać');
        // Przywróć poprzedni stan
        setSelectedTech(selectedTech);
      } finally {
        setIsSaving(false);
      }
    },
    [selectedTech, projectId, onUpdate, disabled]
  );

  // Usuń technologię
  const removeTech = useCallback(
    async (tech: string) => {
      if (disabled) return;
      await toggleTech(tech);
    },
    [toggleTech, disabled]
  );

  // Grupuj technologie po kategorii
  const groupedOptions = TECH_OPTIONS.reduce(
    (acc, opt) => {
      if (!acc[opt.category]) acc[opt.category] = [];
      acc[opt.category].push(opt.value);
      return acc;
    },
    {} as Record<string, string[]>
  );

  return (
    <div className="relative">
      {/* Etykieta */}
      <label className="flex items-center gap-2 text-sm font-medium text-zinc-400 mb-2">
        <Code2 size={14} />
        Tech Stack
        {isSaving && (
          <span className="text-xs text-zinc-500 animate-pulse">Zapisuję...</span>
        )}
      </label>

      {/* Wybrane technologie (tagi) */}
      <div className="flex flex-wrap gap-1.5 mb-2 min-h-[32px]">
        {selectedTech.length === 0 ? (
          <span className="text-sm text-zinc-600 italic">Brak wybranych</span>
        ) : (
          selectedTech.map((tech) => (
            <span
              key={tech}
              className="inline-flex items-center gap-1 px-2 py-0.5 bg-purple-500/20 text-purple-300 rounded text-sm"
            >
              {tech}
              {!disabled && (
                <button
                  onClick={() => removeTech(tech)}
                  className="hover:text-purple-100 transition-colors"
                  title={`Usuń ${tech}`}
                >
                  <X size={12} />
                </button>
              )}
            </span>
          ))
        )}
      </div>

      {/* Dropdown trigger */}
      <button
        onClick={() => !disabled && setIsOpen(!isOpen)}
        disabled={disabled}
        className={cn(
          'flex items-center justify-between w-full px-3 py-2',
          'bg-zinc-800 border border-zinc-700 rounded-lg',
          'text-sm text-zinc-300 transition-colors',
          disabled
            ? 'opacity-50 cursor-not-allowed'
            : 'hover:border-zinc-600 cursor-pointer'
        )}
      >
        <span>Wybierz technologie...</span>
        <ChevronDown
          size={16}
          className={cn('transition-transform', isOpen && 'rotate-180')}
        />
      </button>

      {/* Dropdown menu */}
      {isOpen && !disabled && (
        <>
          {/* Overlay */}
          <div
            className="fixed inset-0 z-10"
            onClick={() => setIsOpen(false)}
          />

          {/* Menu */}
          <div className="absolute z-20 mt-1 w-full max-h-[300px] overflow-auto bg-zinc-800 border border-zinc-700 rounded-lg shadow-xl">
            {Object.entries(groupedOptions).map(([category, techs]) => (
              <div key={category}>
                {/* Kategoria header */}
                <div className="px-3 py-1.5 text-xs font-medium text-zinc-500 bg-zinc-900/50 sticky top-0">
                  {category}
                </div>

                {/* Opcje */}
                {techs.map((tech) => {
                  const isSelected = selectedTech.includes(tech);

                  return (
                    <button
                      key={tech}
                      onClick={() => toggleTech(tech)}
                      className={cn(
                        'flex items-center justify-between w-full px-3 py-2',
                        'text-sm transition-colors text-left',
                        isSelected
                          ? 'bg-purple-500/20 text-purple-300'
                          : 'text-zinc-300 hover:bg-zinc-700'
                      )}
                    >
                      <span>{tech}</span>
                      {isSelected && <Check size={14} className="text-purple-400" />}
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
        </>
      )}

      {/* Error */}
      {error && <p className="text-xs text-red-400 mt-1">{error}</p>}
    </div>
  );
}
