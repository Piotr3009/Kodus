/**
 * API Route: /api/files/add
 * Pobiera zawartość pojedynczego pliku do kontekstu AI
 */

import { NextRequest, NextResponse } from 'next/server';
import { getFileForContext } from '@/lib/files';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { path } = body;

    if (!path || typeof path !== 'string') {
      return NextResponse.json(
        { error: 'Brak ścieżki pliku' },
        { status: 400 }
      );
    }

    const content = await getFileForContext(path);

    return NextResponse.json({
      content,
      path,
    });
  } catch (error) {
    console.error('Error getting file for context:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Błąd pobierania pliku' },
      { status: 500 }
    );
  }
}
