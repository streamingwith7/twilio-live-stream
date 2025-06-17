export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const phoneNumber = searchParams.get('phoneNumber')

    if (!phoneNumber) {
      const activeCalls = await prisma.callRecord.findMany({
        where: {
          isActive: true
        },
        orderBy: {
          startTime: 'desc'
        },
        include: {
          transcriptions: {
            orderBy: {
              timestamp: 'asc'
            }
          }
        }
      })

      const callsByPhone = activeCalls.reduce((acc: { [x: string]: any[] }, call: { phoneNumber: string | number }) => {
        if (!acc[call.phoneNumber]) {
          acc[call.phoneNumber] = []
        }
        acc[call.phoneNumber].push(call)
        return acc
      }, {} as Record<string, typeof activeCalls>)

      return NextResponse.json(callsByPhone)
    } else {
      const calls = await prisma.callRecord.findMany({
        where: {
          phoneNumber,
          isActive: true
        },
        orderBy: {
          startTime: 'desc'
        },
        include: {
          transcriptions: {
            orderBy: {
              timestamp: 'asc'
            }
          }
        }
      })

      return NextResponse.json(calls)
    }
  } catch (error) {
    console.error('Error fetching calls:', error)
    return NextResponse.json(
      { error: 'Failed to fetch calls' },
      { status: 500 }
    )
  }
} 