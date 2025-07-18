import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const prompt = await prisma.prompt.findUnique({
      where: { id: params.id }
    });

    if (!prompt) {
      return NextResponse.json({ error: 'Prompt not found' }, { status: 404 });
    }

    return NextResponse.json({ prompt });
  } catch (error) {
    console.error('Error fetching prompt:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json();
    const { key, name, description, type, content, variables, isActive } = body;

    if (!name || !type || !content) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Check if key already exists (but allow current prompt to keep its key)
    if (key) {
      const existingPrompt = await prisma.prompt.findFirst({
        where: {
          key,
          NOT: { id: params.id }
        }
      });

      if (existingPrompt) {
        return NextResponse.json({ error: 'Prompt key already exists' }, { status: 400 });
      }
    }

    // Get current version for versioning
    const currentPrompt = await prisma.prompt.findUnique({
      where: { id: params.id }
    });

    if (!currentPrompt) {
      return NextResponse.json({ error: 'Prompt not found' }, { status: 404 });
    }

    // Create version backup if content changed
    if (currentPrompt.content !== content) {
      await prisma.promptVersion.create({
        data: {
          promptId: params.id,
          version: currentPrompt.version,
          content: currentPrompt.content,
          variables: currentPrompt.variables,
          createdBy: 'user', // TODO: Get from auth
        }
      });
    }

    const prompt = await prisma.prompt.update({
      where: { id: params.id },
      data: {
        key: key || currentPrompt.key,
        name,
        description,
        type,
        content,
        variables: variables || null,
        isActive: isActive !== undefined ? isActive : currentPrompt.isActive,
        version: currentPrompt.content !== content ? currentPrompt.version + 1 : currentPrompt.version,
        updatedAt: new Date(),
      }
    });

    return NextResponse.json({ prompt });
  } catch (error) {
    console.error('Error updating prompt:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Check if prompt exists
    const prompt = await prisma.prompt.findUnique({
      where: { id: params.id }
    });

    if (!prompt) {
      return NextResponse.json({ error: 'Prompt not found' }, { status: 404 });
    }

    // Delete all versions first
    await prisma.promptVersion.deleteMany({
      where: { promptId: params.id }
    });

    // Delete the prompt
    await prisma.prompt.delete({
      where: { id: params.id }
    });

    return NextResponse.json({ message: 'Prompt deleted successfully' });
  } catch (error) {
    console.error('Error deleting prompt:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
} 