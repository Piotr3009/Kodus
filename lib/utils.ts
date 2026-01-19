/**
 * Funkcje pomocnicze dla AI Agent Dashboard
 */

import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * Łączy klasy CSS z obsługą Tailwind merge
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Debounce funkcji
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout | null = null;

  return (...args: Parameters<T>) => {
    if (timeout) {
      clearTimeout(timeout);
    }
    timeout = setTimeout(() => {
      func(...args);
    }, wait);
  };
}

/**
 * Throttle funkcji
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function throttle<T extends (...args: any[]) => any>(
  func: T,
  limit: number
): (...args: Parameters<T>) => void {
  let inThrottle = false;

  return (...args: Parameters<T>) => {
    if (!inThrottle) {
      func(...args);
      inThrottle = true;
      setTimeout(() => {
        inThrottle = false;
      }, limit);
    }
  };
}

/**
 * Bezpieczne parsowanie JSON
 */
export function safeJsonParse<T>(json: string, fallback: T): T {
  try {
    return JSON.parse(json) as T;
  } catch {
    return fallback;
  }
}

/**
 * Generuje unikalny ID
 */
export function generateId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Skraca tekst do określonej długości
 */
export function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return `${text.substring(0, maxLength - 3)}...`;
}

/**
 * Formatuje datę na czytelny format
 */
export function formatDate(date: string | Date): string {
  const d = new Date(date);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMins = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  // Mniej niż minuta temu
  if (diffMins < 1) {
    return 'przed chwilą';
  }

  // Mniej niż godzina temu
  if (diffMins < 60) {
    return `${diffMins} min temu`;
  }

  // Mniej niż dzień temu
  if (diffHours < 24) {
    return `${diffHours} godz. temu`;
  }

  // Mniej niż tydzień temu
  if (diffDays < 7) {
    return `${diffDays} dni temu`;
  }

  // Format pełnej daty
  return d.toLocaleDateString('pl-PL', {
    day: 'numeric',
    month: 'short',
    year: d.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
  });
}

/**
 * Kopiuje tekst do schowka
 */
export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // Fallback dla starszych przeglądarek
    try {
      const textarea = document.createElement('textarea');
      textarea.value = text;
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      return true;
    } catch {
      return false;
    }
  }
}

/**
 * Pobiera plik ze stringa
 */
export function downloadStringAsFile(content: string, filename: string, mimeType = 'text/plain') {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Sprawdza czy kod zawiera TypeScript/React
 */
export function isReactCode(code: string): boolean {
  return (
    code.includes('import React') ||
    code.includes('from "react"') ||
    code.includes("from 'react'") ||
    code.includes('useState') ||
    code.includes('useEffect') ||
    code.includes('<') && code.includes('/>') ||
    code.includes('export default function')
  );
}

/**
 * Wyciąga rozszerzenie z nazwy pliku
 */
export function getFileExtension(filename: string): string {
  const parts = filename.split('.');
  return parts.length > 1 ? parts.pop()?.toLowerCase() || '' : '';
}

/**
 * Zwraca odpowiedni MIME type dla rozszerzenia
 */
export function getMimeType(extension: string): string {
  const mimeTypes: Record<string, string> = {
    ts: 'application/typescript',
    tsx: 'application/typescript',
    js: 'application/javascript',
    jsx: 'application/javascript',
    json: 'application/json',
    css: 'text/css',
    html: 'text/html',
    md: 'text/markdown',
    sql: 'application/sql',
    txt: 'text/plain',
  };

  return mimeTypes[extension] || 'text/plain';
}
