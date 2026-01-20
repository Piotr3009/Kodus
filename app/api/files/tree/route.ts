/**
 * API endpoint do pobierania drzewa struktury projektu
 * GET /api/files/tree
 */

import { NextResponse } from 'next/server';
import { getProjectTree } from '@/lib/files';

export async function GET() {
  try {
    const tree = await getProjectTree();

    return NextResponse.json({ tree });
  } catch (error) {
    console.error('Błąd budowania drzewa plików:', error);

    const message = error instanceof Error ? error.message : 'Nieznany błąd';

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
