// ========================================
// ZAMIEŃ CAŁY PLIK: app/api/files/list/route.ts
// ========================================

import { NextResponse } from 'next/server';
import { listDirectory } from '@/lib/files';
import { getGitHubFilesList } from '@/lib/github';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const path = searchParams.get('path') || '';
    const owner = searchParams.get('owner');
    const repo = searchParams.get('repo');
    const branch = searchParams.get('branch') || 'main';
    
    let files;
    
    if (owner && repo) {
      // Pobierz z GitHub API
      console.log(`Listowanie plików z GitHub: ${owner}/${repo}/${path}`);
      files = await getGitHubFilesList(owner, repo, path, branch);
    } else {
      // Fallback: pobierz lokalnie
      console.log(`Listowanie plików lokalnie: ${path}`);
      files = await listDirectory(path || '.');
    }
    
    return NextResponse.json({ files });
  } catch (error) {
    console.error('Błąd listowania plików:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Nieznany błąd', files: [] },
      { status: 500 }
    );
  }
}