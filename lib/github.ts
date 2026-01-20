/**
 * Moduł GitHub - integracja z GitHub API
 * Obsługuje pobieranie i wysyłanie plików do repozytoriów
 */

import { Octokit } from '@octokit/rest';

// Leniwa inicjalizacja klienta Octokit
let octokitClient: Octokit | null = null;

function getOctokit(): Octokit {
  if (!octokitClient) {
    const token = process.env.GITHUB_TOKEN;
    if (!token) {
      throw new Error('Brak GITHUB_TOKEN w zmiennych środowiskowych');
    }
    octokitClient = new Octokit({ auth: token });
  }
  return octokitClient;
}

// Typy
export interface GitHubFile {
  name: string;
  path: string;
  sha: string;
  size: number;
  type: 'file' | 'dir';
  content?: string;
  downloadUrl?: string;
}

export interface RepoInfo {
  owner: string;
  repo: string;
  branch: string;
}

/**
 * Parsuje URL repozytorium GitHub
 * Obsługuje formaty: https://github.com/owner/repo, github.com/owner/repo, owner/repo
 */
export function parseRepoUrl(url: string): RepoInfo | null {
  try {
    // Usuń protokół i github.com
    let cleaned = url
      .replace(/^https?:\/\//, '')
      .replace(/^github\.com\//, '')
      .replace(/\.git$/, '')
      .trim();

    // Podziel na owner i repo
    const parts = cleaned.split('/').filter(Boolean);
    if (parts.length < 2) return null;

    return {
      owner: parts[0],
      repo: parts[1],
      branch: 'main', // Domyślna gałąź
    };
  } catch {
    return null;
  }
}

/**
 * Pobiera zawartość pliku z repozytorium
 */
export async function getFileContent(
  owner: string,
  repo: string,
  path: string,
  branch: string = 'main'
): Promise<{ content: string; sha: string }> {
  try {
    const octokit = getOctokit();
    const response = await octokit.repos.getContent({
      owner,
      repo,
      path,
      ref: branch,
    });

    // Sprawdź czy to plik (nie katalog)
    if (Array.isArray(response.data) || response.data.type !== 'file') {
      throw new Error('Ścieżka nie wskazuje na plik');
    }

    const data = response.data as { content: string; sha: string; encoding: string };

    // Dekoduj zawartość z base64
    const content = Buffer.from(data.content, 'base64').toString('utf-8');

    return { content, sha: data.sha };
  } catch (error) {
    console.error('Błąd pobierania pliku z GitHub:', error);
    throw new Error(`Nie udało się pobrać pliku ${path}: ${error instanceof Error ? error.message : 'nieznany błąd'}`);
  }
}

/**
 * Pobiera listę plików z repozytorium
 */
export async function getRepoFiles(
  owner: string,
  repo: string,
  path: string = '',
  branch: string = 'main'
): Promise<GitHubFile[]> {
  try {
    const octokit = getOctokit();
    const response = await octokit.repos.getContent({
      owner,
      repo,
      path,
      ref: branch,
    });

    // Jeśli to pojedynczy plik
    if (!Array.isArray(response.data)) {
      const file = response.data;
      return [{
        name: file.name,
        path: file.path,
        sha: file.sha,
        size: file.size,
        type: file.type as 'file' | 'dir',
        downloadUrl: file.download_url || undefined,
      }];
    }

    // Jeśli to katalog
    return response.data.map((item) => ({
      name: item.name,
      path: item.path,
      sha: item.sha,
      size: item.size,
      type: item.type as 'file' | 'dir',
      downloadUrl: item.download_url || undefined,
    }));
  } catch (error) {
    console.error('Błąd pobierania listy plików z GitHub:', error);
    throw new Error(`Nie udało się pobrać listy plików: ${error instanceof Error ? error.message : 'nieznany błąd'}`);
  }
}

/**
 * Aktualizuje plik w repozytorium
 */
export async function updateFile(
  owner: string,
  repo: string,
  path: string,
  content: string,
  message: string,
  sha: string,
  branch: string = 'main'
): Promise<{ sha: string }> {
  try {
    const octokit = getOctokit();

    // Koduj zawartość do base64
    const encodedContent = Buffer.from(content).toString('base64');

    const response = await octokit.repos.createOrUpdateFileContents({
      owner,
      repo,
      path,
      message,
      content: encodedContent,
      sha,
      branch,
    });

    return { sha: response.data.content?.sha || '' };
  } catch (error) {
    console.error('Błąd aktualizacji pliku w GitHub:', error);
    throw new Error(`Nie udało się zaktualizować pliku ${path}: ${error instanceof Error ? error.message : 'nieznany błąd'}`);
  }
}

/**
 * Tworzy nowy plik w repozytorium
 */
export async function createFile(
  owner: string,
  repo: string,
  path: string,
  content: string,
  message: string,
  branch: string = 'main'
): Promise<{ sha: string }> {
  try {
    const octokit = getOctokit();

    // Koduj zawartość do base64
    const encodedContent = Buffer.from(content).toString('base64');

    const response = await octokit.repos.createOrUpdateFileContents({
      owner,
      repo,
      path,
      message,
      content: encodedContent,
      branch,
    });

    return { sha: response.data.content?.sha || '' };
  } catch (error) {
    console.error('Błąd tworzenia pliku w GitHub:', error);
    throw new Error(`Nie udało się utworzyć pliku ${path}: ${error instanceof Error ? error.message : 'nieznany błąd'}`);
  }
}

/**
 * Usuwa plik z repozytorium
 */
export async function deleteFile(
  owner: string,
  repo: string,
  path: string,
  sha: string,
  message: string,
  branch: string = 'main'
): Promise<void> {
  try {
    const octokit = getOctokit();

    await octokit.repos.deleteFile({
      owner,
      repo,
      path,
      message,
      sha,
      branch,
    });
  } catch (error) {
    console.error('Błąd usuwania pliku z GitHub:', error);
    throw new Error(`Nie udało się usunąć pliku ${path}: ${error instanceof Error ? error.message : 'nieznany błąd'}`);
  }
}

/**
 * Pobiera informacje o repozytorium
 */
export async function getRepoInfo(owner: string, repo: string): Promise<{
  name: string;
  fullName: string;
  defaultBranch: string;
  private: boolean;
}> {
  try {
    const octokit = getOctokit();
    const response = await octokit.repos.get({ owner, repo });

    return {
      name: response.data.name,
      fullName: response.data.full_name,
      defaultBranch: response.data.default_branch,
      private: response.data.private,
    };
  } catch (error) {
    console.error('Błąd pobierania informacji o repozytorium:', error);
    throw new Error(`Nie udało się pobrać informacji o repo: ${error instanceof Error ? error.message : 'nieznany błąd'}`);
  }
}

/**
 * Pobiera rekursywnie wszystkie pliki z repozytorium (drzewo)
 */
export async function getRepoTree(
  owner: string,
  repo: string,
  branch: string = 'main'
): Promise<GitHubFile[]> {
  try {
    const octokit = getOctokit();
    const response = await octokit.git.getTree({
      owner,
      repo,
      tree_sha: branch,
      recursive: 'true',
    });

    return response.data.tree
      .filter((item: { type?: string }) => item.type === 'blob') // Tylko pliki
      .map((item: { path?: string; sha?: string; size?: number; type?: string }) => ({
        name: item.path?.split('/').pop() || '',
        path: item.path || '',
        sha: item.sha || '',
        size: item.size || 0,
        type: 'file' as const,
      }));
  } catch (error) {
    console.error('Błąd pobierania drzewa repozytorium:', error);
    throw new Error(`Nie udało się pobrać drzewa repo: ${error instanceof Error ? error.message : 'nieznany błąd'}`);
  }
}
// ========================================
// DODAJ TEN KOD NA KOŃCU PLIKU lib/github.ts
// ========================================

/**
 * Pobiera kontekst projektu z GitHub dla AI
 */
export async function getGitHubProjectContext(
  owner: string,
  repo: string,
  branch: string = 'main'
): Promise<string> {
  try {
    // 1. Pobierz drzewo plików
    const files = await getRepoTree(owner, repo, branch);
    
    // Filtruj i zbuduj drzewo tekstowe
    const tree = files
      .map(f => f.path)
      .filter(p => 
        !p.includes('node_modules') && 
        !p.includes('.git') &&
        !p.includes('.next') &&
        !p.includes('dist')
      )
      .sort()
      .join('\n');
    
    // 2. Pobierz kluczowe pliki
    const keyFileNames = ['package.json', 'README.md', 'index.html', 'app.js', 'main.js', 'index.js'];
    const keyContents: string[] = [];
    
    for (const keyFileName of keyFileNames) {
      const found = files.find(f => 
        f.path === keyFileName || 
        f.path.endsWith('/' + keyFileName) ||
        f.name === keyFileName
      );
      if (found && found.size < 50000) { // Max 50KB
        try {
          const { content } = await getFileContent(owner, repo, found.path, branch);
          keyContents.push(`--- ${found.path} ---\n${content}`);
        } catch {
          // Ignoruj błędy pojedynczych plików
        }
      }
    }
    
    // 3. Zbuduj kontekst
    let context = `REPOZYTORIUM GITHUB: ${owner}/${repo} (branch: ${branch})\n\n`;
    context += `STRUKTURA PROJEKTU:\n${tree}\n\n`;
    
    if (keyContents.length > 0) {
      context += `KLUCZOWE PLIKI:\n\n${keyContents.join('\n\n')}`;
    }
    
    return context;
  } catch (error) {
    throw new Error(`Nie udało się pobrać kontekstu z GitHub: ${error instanceof Error ? error.message : 'nieznany błąd'}`);
  }
}

/**
 * Pobiera listę plików z GitHub do wyświetlenia w UI
 */
export async function getGitHubFilesList(
  owner: string,
  repo: string,
  path: string = '',
  branch: string = 'main'
): Promise<{ name: string; path: string; type: 'file' | 'dir' }[]> {
  try {
    const files = await getRepoFiles(owner, repo, path, branch);
    
    return files
      .filter(f => 
        !f.name.startsWith('.') || f.name === '.gitignore'
      )
      .map(f => ({
        name: f.name,
        path: f.path,
        type: f.type
      }))
      .sort((a, b) => {
        // Foldery najpierw
        if (a.type === 'dir' && b.type !== 'dir') return -1;
        if (a.type !== 'dir' && b.type === 'dir') return 1;
        return a.name.localeCompare(b.name);
      });
  } catch (error) {
    throw new Error(`Nie udało się pobrać listy plików: ${error instanceof Error ? error.message : 'nieznany błąd'}`);
  }
}

/**
 * Pobiera zawartość pliku z GitHub sformatowaną dla kontekstu AI
 */
export async function getGitHubFileForContext(
  owner: string,
  repo: string,
  path: string,
  branch: string = 'main'
): Promise<string> {
  try {
    const { content } = await getFileContent(owner, repo, path, branch);
    return `--- ${path} ---\n${content}`;
  } catch (error) {
    throw new Error(`Nie udało się pobrać pliku: ${error instanceof Error ? error.message : 'nieznany błąd'}`);
  }
}