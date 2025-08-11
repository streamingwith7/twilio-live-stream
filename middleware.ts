import { NextResponse } from 'next/server'
import { getToken } from 'next-auth/jwt'
import type { NextRequest } from 'next/server'

export async function middleware(req: NextRequest) {
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET })
  
  // Protected routes
  const protectedPaths = [
    '/dashboard',
    '/call-logs',
    '/call-reports',
    '/browser-calling',
    '/make-call',
    '/prompt-management',
    '/transcription',
    '/debug'
  ]
  
  const isProtectedPath = protectedPaths.some(path => 
    req.nextUrl.pathname.startsWith(path)
  )
  
  if (isProtectedPath && !token) {
    return NextResponse.redirect(new URL('/auth/signin', req.url))
  }
  
  if (token?.sub) {
    const response = NextResponse.next()
    response.headers.set('x-user-id', token.sub)
    return response
  }
  
  return NextResponse.next()
}

export const config = {
  matcher: [
    '/dashboard/:path*',
    '/call-logs/:path*',
    '/call-reports/:path*',
    '/browser-calling/:path*',
    '/make-call/:path*',
    '/prompt-management/:path*',
    '/transcription/:path*',
    '/debug/:path*'
  ]
} 