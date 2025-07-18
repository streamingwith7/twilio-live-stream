import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  { params }: { params: { key: string } }
) {
  try {
    const prompt = await prisma.prompt.findUnique({
      where: { 
        key: params.key,
        isActive: true 
      }
    });

    if (!prompt) {
      return NextResponse.json({ error: 'Active prompt not found' }, { status: 404 });
    }

    return NextResponse.json({ prompt });
  } catch (error) {
    console.error('Error fetching prompt by key:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
} 