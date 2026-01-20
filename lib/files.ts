/**
 * Moduł pomocniczy do obsługi plików projektu
 * Funkcje do listowania, czytania i budowania drzewa plików
 */

import { promises as fs } from 'fs';
import path from 'path';

// Katalog główny projektu
const PROJECT_ROOT = process.cwd();

// Maksymalny rozmiar pliku do odczytu (50KB)
const MAX_FILE_SIZE = 50 * 1024;

// Maksymalna głębokość drzewa
const MAX_TREE_DEPTH = 5;

// Katalogi do ignorowania
const IGNORED_DIRS = ['node_modules', '.next', '.git', 'dist', '.turbo', '.vercel', 'coverage'];

// Pliki do blokowania (zawierające sekrety)
const BLOCKED_FILES = ['.env', '.env.local', '.env.production', '.env.development', 'secrets', 'credentials'];

export interface FileInfo {
  name: string;
  path: string;
  type: 'file' | 'dir';
}

/**
 * Sprawdza czy ścieżka jest bezpieczna (nie wychodzi poza projekt)
 */
export function isPathSafe(inputPath: string): boolean {
  // Sprawdź czy ścieżka nie zawiera ../ lub innych niebezpiecznych wzorców
  if (inputPath.includes('..')) {
    return false;
  }

  // Normalizuj ścieżkę
  const normalizedPath = path.normalize(inputPath);

  // Sprawdź czy nie zaczyna się od /
  if (path.isAbsolute(normalizedPath) && !normalizedPath.startsWith(PROJECT_ROOT)) {
    return false;
  }

  // Buduj pełną ścieżkę
  const fullPath = path.isAbsolute(normalizedPath)
    ? normalizedPath
    : path.join(PROJECT_ROOT, normalizedPath);

  // Sprawdź czy mieści się w katalogu projektu
  const resolvedPath = path.resolve(fullPath);
  const resolvedRoot = path.resolve(PROJECT_ROOT);

  return resolvedPath.startsWith(resolvedRoot);
}

/**
 * Sprawdza czy plik jest zablokowany (zawiera sekrety)
 */
export function isFileBlocked(filePath: string): boolean {
  const fileName = path.basename(filePath).toLowerCase();
  return BLOCKED_FILES.some(blocked => fileName.includes(blocked.toLowerCase()));
}

/**
 * Sprawdza czy katalog powinien być ignorowany
 */
export function isDirIgnored(dirName: string): boolean {
  return IGNORED_DIRS.includes(dirName);
}

/**
 * Listuje pliki i foldery w danej ścieżce
 */
export async function listDirectory(inputPath: string = '.'): Promise<FileInfo[]> {
  // Walidacja ścieżki
  if (!isPathSafe(inputPath)) {
    throw new Error('Nieprawidłowa ścieżka - dostęp zabroniony');
  }

  const fullPath = path.join(PROJECT_ROOT, inputPath);

  try {
    const entries = await fs.readdir(fullPath, { withFileTypes: true });

    const files: FileInfo[] = [];

    for (const entry of entries) {
      // Pomijaj ignorowane katalogi
      if (entry.isDirectory() && isDirIgnored(entry.name)) {
        continue;
      }

      // Pomijaj zablokowane pliki
      if (entry.isFile() && isFileBlocked(entry.name)) {
        continue;
      }

      // Pomijaj ukryte pliki (zaczynające się od .)
      if (entry.name.startsWith('.') && entry.name !== '.gitignore') {
        continue;
      }

      files.push({
        name: entry.name,
        path: path.join(inputPath, entry.name).replace(/\\/g, '/'),
        type: entry.isDirectory() ? 'dir' : 'file',
      });
    }

    // Sortuj: najpierw foldery, potem pliki, alfabetycznie
    files.sort((a, b) => {
      if (a.type !== b.type) {
        return a.type === 'dir' ? -1 : 1;
      }
      return a.name.localeCompare(b.name);
    });

    return files;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      throw new Error(`Ścieżka nie istnieje: ${inputPath}`);
    }
    if ((error as NodeJS.ErrnoException).code === 'ENOTDIR') {
      throw new Error(`To nie jest katalog: ${inputPath}`);
    }
    throw error;
  }
}

/**
 * Czyta zawartość pliku
 */
export async function readFileContent(inputPath: string): Promise<{ content: string; size: number }> {
  // Walidacja ścieżki
  if (!isPathSafe(inputPath)) {
    throw new Error('Nieprawidłowa ścieżka - dostęp zabroniony');
  }

  // Sprawdź czy plik jest zablokowany
  if (isFileBlocked(inputPath)) {
    throw new Error('Dostęp do tego pliku jest zabroniony ze względów bezpieczeństwa');
  }

  const fullPath = path.join(PROJECT_ROOT, inputPath);

  try {
    // Sprawdź rozmiar pliku
    const stats = await fs.stat(fullPath);

    if (stats.isDirectory()) {
      throw new Error('To jest katalog, nie plik');
    }

    if (stats.size > MAX_FILE_SIZE) {
      throw new Error(`Plik jest za duży (${Math.round(stats.size / 1024)}KB). Maksymalny rozmiar: ${MAX_FILE_SIZE / 1024}KB`);
    }

    // Odczytaj zawartość
    const content = await fs.readFile(fullPath, 'utf-8');

    return {
      content,
      size: stats.size,
    };
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      throw new Error(`Plik nie istnieje: ${inputPath}`);
    }
    throw error;
  }
}

/**
 * Buduje drzewo plików projektu rekurencyjnie
 */
async function buildTree(
  dirPath: string,
  prefix: string = '',
  depth: number = 0
): Promise<string[]> {
  if (depth >= MAX_TREE_DEPTH) {
    return [`${prefix}... (maksymalna głębokość osiągnięta)`];
  }

  const fullPath = path.join(PROJECT_ROOT, dirPath);
  const lines: string[] = [];

  try {
    const entries = await fs.readdir(fullPath, { withFileTypes: true });

    // Filtruj i sortuj
    const filteredEntries = entries.filter(entry => {
      if (entry.isDirectory() && isDirIgnored(entry.name)) return false;
      if (entry.isFile() && isFileBlocked(entry.name)) return false;
      if (entry.name.startsWith('.') && entry.name !== '.gitignore') return false;
      return true;
    }).sort((a, b) => {
      if (a.isDirectory() !== b.isDirectory()) {
        return a.isDirectory() ? -1 : 1;
      }
      return a.name.localeCompare(b.name);
    });

    for (let i = 0; i < filteredEntries.length; i++) {
      const entry = filteredEntries[i];
      const isLast = i === filteredEntries.length - 1;
      const connector = isLast ? '└── ' : '├── ';
      const childPrefix = isLast ? '    ' : '│   ';

      if (entry.isDirectory()) {
        lines.push(`${prefix}${connector}${entry.name}/`);
        const childLines = await buildTree(
          path.join(dirPath, entry.name),
          prefix + childPrefix,
          depth + 1
        );
        lines.push(...childLines);
      } else {
        lines.push(`${prefix}${connector}${entry.name}`);
      }
    }
  } catch (error) {
    lines.push(`${prefix}[błąd odczytu]`);
  }

  return lines;
}

/**
 * Zwraca drzewo plików projektu jako sformatowany string
 */
export async function getProjectTree(): Promise<string> {
  const lines = ['.'];
  const treeLines = await buildTree('.');
  lines.push(...treeLines);
  return lines.join('\n');
}

/**
 * Pobiera kontekst projektu dla AI
 * Zawiera strukturę plików i zawartość kluczowych plików
 */
export async function getProjectContext(): Promise<string> {
  const parts: string[] = [];

  // 1. Pobierz drzewo plików
  try {
    const tree = await getProjectTree();
    parts.push('STRUKTURA PROJEKTU:');
    parts.push(tree);
  } catch (error) {
    parts.push('STRUKTURA PROJEKTU:');
    parts.push('[Błąd pobierania struktury]');
  }

  parts.push('');
  parts.push('KLUCZOWE PLIKI:');

  // 2. Pobierz zawartość kluczowych plików
  const keyFiles = ['package.json', 'lib/types.ts'];

  for (const filePath of keyFiles) {
    try {
      const { content } = await readFileContent(filePath);
      parts.push('');
      parts.push(`--- ${filePath} ---`);
      parts.push(content);
    } catch (error) {
      parts.push('');
      parts.push(`--- ${filePath} ---`);
      parts.push(`[Nie można odczytać pliku: ${error instanceof Error ? error.message : 'nieznany błąd'}]`);
    }
  }

  return parts.join('\n');
}

/**
 * Pobiera zawartość pojedynczego pliku dla kontekstu AI
 */
export async function getFileForContext(filePath: string): Promise<string> {
  const { content } = await readFileContent(filePath);
  return `--- ${filePath} ---\n${content}`;
}
