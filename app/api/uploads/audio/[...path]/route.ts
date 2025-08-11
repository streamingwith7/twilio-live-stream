import { NextRequest, NextResponse } from 'next/server';
import { readFile, stat } from 'fs/promises';
import path from 'path';
import { existsSync } from 'fs';

export async function GET(
  request: NextRequest,
  { params }: { params: { path: string[] } }
) {
  try {
    // Reconstruct the file path
    const filePath = params.path.join('/');
    
    // Security: Only allow access to audio files with the correct naming pattern
    if (!filePath.match(/^[a-zA-Z0-9_-]+\.(mp3|wav|m4a|aac|ogg|webm)$/)) {
      return NextResponse.json({ error: 'Invalid file path' }, { status: 400 });
    }

    const fullPath = path.join(process.cwd(), 'public', 'uploads', 'audio', filePath);
    
    // Check if file exists
    if (!existsSync(fullPath)) {
      return NextResponse.json({ error: 'File not found' }, { status: 404 });
    }

    // Get file stats
    const fileStat = await stat(fullPath);
    
    // Read the file
    const fileBuffer = await readFile(fullPath);
    
    // Determine content type based on file extension
    const ext = path.extname(filePath).toLowerCase();
    const contentTypeMap: { [key: string]: string } = {
      '.mp3': 'audio/mpeg',
      '.wav': 'audio/wav',
      '.m4a': 'audio/mp4',
      '.aac': 'audio/aac',
      '.ogg': 'audio/ogg',
      '.webm': 'audio/webm'
    };
    
    const contentType = contentTypeMap[ext] || 'application/octet-stream';

    // Set appropriate headers
    const headers = new Headers();
    headers.set('Content-Type', contentType);
    headers.set('Content-Length', fileStat.size.toString());
    headers.set('Cache-Control', 'public, max-age=3600'); // Cache for 1 hour
    headers.set('Accept-Ranges', 'bytes');
    
    // Handle range requests for audio seeking
    const range = request.headers.get('range');
    if (range) {
      const parts = range.replace(/bytes=/, "").split("-");
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : fileStat.size - 1;
      
      if (start >= fileStat.size) {
        headers.set('Content-Range', `bytes */${fileStat.size}`);
        return new Response(null, { status: 416, headers });
      }
      
      const chunksize = (end - start) + 1;
      const chunk = fileBuffer.slice(start, end + 1);
      
      headers.set('Content-Range', `bytes ${start}-${end}/${fileStat.size}`);
      headers.set('Content-Length', chunksize.toString());
      
      return new Response(chunk, { status: 206, headers });
    }

    return new Response(fileBuffer, { headers });
    
  } catch (error) {
    console.error('Error serving audio file:', error);
    return NextResponse.json({ error: 'Failed to serve file' }, { status: 500 });
  }
} 