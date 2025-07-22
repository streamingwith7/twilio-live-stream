import { NextRequest, NextResponse } from 'next/server';
import { s3Service } from '@/lib/s3-service';
import { deleteFile, uploadFile } from '@/lib/pinecone-service';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import { v4 as uuidv4 } from 'uuid';

export async function POST(request: NextRequest) {
    const { content } = await request.json();
    const fileName = `suggestion-review-${uuidv4()}.txt`;
    const filePath = path.join(os.tmpdir(), fileName);
    
    try {
        await fs.writeFile(filePath, content);
        const pineconeResponse = await uploadFile(filePath);
        return NextResponse.json(pineconeResponse);
    } finally {
        try {
            await fs.unlink(filePath);
        } catch (error) {
            console.warn('Failed to delete temporary file:', filePath, error);
        }
    }
}

export async function DELETE(request: NextRequest) {
    const { fileId } = await request.json();
    const response = await deleteFile(fileId);
    return NextResponse.json(response);
} 