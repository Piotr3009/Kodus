/**
 * Moduł do pobierania plików i archiwów ZIP
 * Obsługuje pobieranie pojedynczych plików i pakowanie wielu do ZIP
 */

import JSZip from 'jszip';

/**
 * Pobiera pojedynczy plik jako download
 * @param content - zawartość pliku
 * @param filename - nazwa pliku z rozszerzeniem
 */
export function downloadFile(content: string, filename: string): void {
  // Określ MIME type na podstawie rozszerzenia
  const ext = filename.split('.').pop()?.toLowerCase() || 'txt';
  const mimeTypes: Record<string, string> = {
    ts: 'text/typescript',
    tsx: 'text/typescript',
    js: 'text/javascript',
    jsx: 'text/javascript',
    json: 'application/json',
    html: 'text/html',
    css: 'text/css',
    md: 'text/markdown',
    py: 'text/x-python',
    sql: 'application/sql',
    txt: 'text/plain',
  };

  const mimeType = mimeTypes[ext] || 'text/plain';

  // Utwórz blob i link do pobrania
  const blob = new Blob([content], { type: `${mimeType};charset=utf-8` });
  const url = URL.createObjectURL(blob);

  // Utwórz tymczasowy link i kliknij
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();

  // Cleanup
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Pobiera wiele plików jako archiwum ZIP
 * @param files - tablica plików do spakowania
 * @param zipName - nazwa pliku ZIP (domyślnie: 'kodus-files.zip')
 */
export async function downloadAsZip(
  files: { name: string; content: string }[],
  zipName: string = 'kodus-files.zip'
): Promise<void> {
  if (files.length === 0) {
    throw new Error('Brak plików do spakowania');
  }

  const zip = new JSZip();

  // Dodaj każdy plik do archiwum
  for (const file of files) {
    zip.file(file.name, file.content);
  }

  // Wygeneruj archiwum jako blob
  const blob = await zip.generateAsync({
    type: 'blob',
    compression: 'DEFLATE',
    compressionOptions: { level: 6 },
  });

  // Pobierz archiwum
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = zipName.endsWith('.zip') ? zipName : `${zipName}.zip`;
  document.body.appendChild(link);
  link.click();

  // Cleanup
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Pobiera pliki z edytora jako ZIP
 * @param files - pliki z edytora (EditorFile[])
 * @param projectName - nazwa projektu (opcjonalna)
 */
export async function downloadEditorFilesAsZip(
  files: { name: string; content: string }[],
  projectName?: string
): Promise<void> {
  const zipName = projectName
    ? `${projectName.toLowerCase().replace(/\s+/g, '-')}.zip`
    : 'kodus-project.zip';

  await downloadAsZip(files, zipName);
}
