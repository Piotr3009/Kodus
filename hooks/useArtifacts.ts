'use client';

/**
 * Hook do zarządzania artefaktami (plikami kodu w panelu bocznym)
 * Obsługuje dodawanie, usuwanie, przełączanie między artefaktami
 */

import { useState, useCallback } from 'react';
import type { Artifact, UseArtifactsReturn } from '@/lib/types';

const MAX_ARTIFACTS = 5;

export function useArtifacts(): UseArtifactsReturn {
  const [artifacts, setArtifacts] = useState<Artifact[]>([]);
  const [activeArtifactId, setActiveArtifactId] = useState<string | null>(null);
  const [isOpen, setIsOpen] = useState(false);

  // Generuj unikalne ID
  const generateId = useCallback(() => {
    return `artifact-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }, []);

  // Dodaj nowy artefakt
  const addArtifact = useCallback(
    (filename: string, language: string, content: string) => {
      const newArtifact: Artifact = {
        id: generateId(),
        filename,
        language,
        content,
        createdAt: new Date().toISOString(),
      };

      setArtifacts((prev) => {
        // Sprawdź czy artefakt o tej nazwie już istnieje
        const existingIndex = prev.findIndex((a) => a.filename === filename);

        if (existingIndex !== -1) {
          // Zaktualizuj istniejący artefakt
          const updated = [...prev];
          updated[existingIndex] = {
            ...updated[existingIndex],
            content,
            createdAt: new Date().toISOString(),
          };
          setActiveArtifactId(updated[existingIndex].id);
          return updated;
        }

        // Dodaj nowy artefakt (max 5)
        let newList = [...prev, newArtifact];
        if (newList.length > MAX_ARTIFACTS) {
          // Usuń najstarszy artefakt
          newList = newList.slice(1);
        }
        return newList;
      });

      // Ustaw nowy artefakt jako aktywny i otwórz panel
      setActiveArtifactId(newArtifact.id);
      setIsOpen(true);
    },
    [generateId]
  );

  // Usuń artefakt
  const removeArtifact = useCallback(
    (id: string) => {
      setArtifacts((prev) => {
        const filtered = prev.filter((a) => a.id !== id);

        // Jeśli usunięto aktywny artefakt, ustaw następny
        if (activeArtifactId === id && filtered.length > 0) {
          setActiveArtifactId(filtered[filtered.length - 1].id);
        } else if (filtered.length === 0) {
          setActiveArtifactId(null);
          setIsOpen(false);
        }

        return filtered;
      });
    },
    [activeArtifactId]
  );

  // Ustaw aktywny artefakt
  const setActiveArtifact = useCallback((id: string) => {
    setActiveArtifactId(id);
  }, []);

  // Otwórz panel
  const openPanel = useCallback(() => {
    setIsOpen(true);
  }, []);

  // Zamknij panel
  const closePanel = useCallback(() => {
    setIsOpen(false);
  }, []);

  // Toggle panel
  const togglePanel = useCallback(() => {
    setIsOpen((prev) => !prev);
  }, []);

  // Wyczyść wszystkie artefakty
  const clearArtifacts = useCallback(() => {
    setArtifacts([]);
    setActiveArtifactId(null);
    setIsOpen(false);
  }, []);

  // Pobierz aktywny artefakt
  const activeArtifact = artifacts.find((a) => a.id === activeArtifactId) || null;

  return {
    artifacts,
    activeArtifact,
    isOpen,
    addArtifact,
    removeArtifact,
    setActiveArtifact,
    openPanel,
    closePanel,
    togglePanel,
    clearArtifacts,
  };
}
