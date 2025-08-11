import { NextResponse } from 'next/server'
import { getToken } from 'next-auth/jwt'
import { jwtVerify } from 'jose'
import type { NextRequest } from 'next/server'

// Use the same secret pattern as in auth.ts
const JWT_SECRET = process.env.NEXTAUTH_SECRET || 'fallback-secret'

export async function middleware(req: NextRequest) {

  const protectedApiPaths = [
    '/api/offline-reports',
    '/api/report'
  ]
  const isProtectedApiPath = protectedApiPaths.some(path =>
    req.nextUrl.pathname.startsWith(path)
  )

  if (isProtectedApiPath) {
    const authHeader = req.headers.get('Authorization')

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized - Missing token' }, { status: 401 })
    }

          const token = authHeader.substring(7)

      try {
        const secret = new TextEncoder().encode(JWT_SECRET)
        const { payload } = await jwtVerify(token, secret)
        
        const userId = payload.userId as string
        if (!userId) {
          return NextResponse.json({ error: 'Unauthorized - No user ID in token' }, { status: 401 })
        }
        
        const response = NextResponse.next()
        response.headers.set('x-user-id', userId)
        return response
      } catch (error) {
        return NextResponse.json({ error: 'Unauthorized - Invalid token' }, { status: 401 })
      }
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
    '/debug/:path*',
    '/offline-reports/:path*',
    '/api/offline-reports/:path*',
    '/api/report/:path*'
  ]
} 