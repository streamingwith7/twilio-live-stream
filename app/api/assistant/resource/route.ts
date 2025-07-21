import { NextRequest, NextResponse } from 'next/server';
import { s3Service } from '@/lib/s3-service';
import { deleteFile, uploadFile } from '@/lib/pinecone-service';
import fs from 'fs/promises';
import { v4 as uuidv4 } from 'uuid';

export async function POST(request: NextRequest) {
    const { content } = await request.json();
    const fileName = 'suggestion-review.txt' + uuidv4();
    await fs.writeFile(fileName, content);
    const response = await s3Service.uploadFile({
        originalname: fileName,
        path: fileName,
        mimetype: 'text/plain'
    });
    const pineconeResponse = await uploadFile(response);
    return NextResponse.json(pineconeResponse);
}

export async function DELETE(request: NextRequest) {
    const { fileId } = await request.json();
    const response = await deleteFile(fileId);
    return NextResponse.json(response);
} 