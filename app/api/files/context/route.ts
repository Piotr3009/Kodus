// ========================================
// ZAMIEŃ CAŁY PLIK: app/api/files/context/route.ts
// ========================================

import { NextResponse } from 'next/server';
import { getProjectContext } from '@/lib/files';
import { getGitHubProjectContext } from '@/lib/github';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const owner = searchParams.get('owner');
    const repo = searchParams.get('repo');
    const branch = searchParams.get('branch') || 'main';
    
    let context: string;
    
    if (owner && repo) {
      // Pobierz z GitHub API
      console.log(`Pobieranie kontekstu z GitHub: ${owner}/${repo} (${branch})`);
      context = await getGitHubProjectContext(owner, repo, branch);
    } else {
      // Fallback: pobierz lokalnie
      console.log('Pobieranie kontekstu lokalnie');
      context = await getProjectContext();
    }
    
    return NextResponse.json({ context, loaded: true });
  } catch (error) {
    console.error('Błąd pobierania kontekstu:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Nieznany błąd', loaded: false },
      { status: 500 }
    );
  }
}