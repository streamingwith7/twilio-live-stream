import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const phoneNumber = searchParams.get('phoneNumber')

    if (!phoneNumber) {
      // Get all active calls grouped by phone number
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

      // Group calls by phone number
      const callsByPhone = activeCalls.reduce((acc, call) => {
        if (!acc[call.phoneNumber]) {
          acc[call.phoneNumber] = []
        }
        acc[call.phoneNumber].push(call)
        return acc
      }, {} as Record<string, typeof activeCalls>)

      return NextResponse.json(callsByPhone)
    } else {
      // Get active calls for specific phone number
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