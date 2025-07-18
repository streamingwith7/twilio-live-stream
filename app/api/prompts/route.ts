import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type');
    const active = searchParams.get('active');
    
    const where: any = {};
    if (type) where.type = type;
    if (active === 'true') where.isActive = true;
    if (active === 'false') where.isActive = false;

    const prompts = await prisma.prompt.findMany({
      where,
      orderBy: [
        { isActive: 'desc' },
        { type: 'asc' },
        { name: 'asc' }
      ]
    });

    return NextResponse.json({ prompts });
  } catch (error) {
    console.error('Error fetching prompts:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { key, name, description, type, content, variables, isActive } = body;

    if (!key || !name || !type || !content) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Check if key already exists
    const existingPrompt = await prisma.prompt.findUnique({
      where: { key }
    });

    if (existingPrompt) {
      return NextResponse.json({ error: 'Prompt key already exists' }, { status: 400 });
    }

    const prompt = await prisma.prompt.create({
      data: {
        key,
        name,
        description,
        type,
        content,
        variables: variables || null,
        isActive: isActive !== undefined ? isActive : true,
        createdBy: 'user', // TODO: Get from auth
      }
    });

    return NextResponse.json({ prompt }, { status: 201 });
  } catch (error) {
    console.error('Error creating prompt:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
} 