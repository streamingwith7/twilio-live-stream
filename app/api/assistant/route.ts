import { NextRequest, NextResponse } from 'next/server';
import { chat } from '@/lib/pinecone-service';

export async function POST(request: NextRequest) {
  const { messages, system } = await request.json();
  const response = await chat(system, messages);
  return NextResponse.json(response);
}