import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const callSid = searchParams.get('callSid');

    if (callSid) {
      const report = await prisma.callReport.findUnique({
        where: { callSid },
      });

      if (!report) {
        return NextResponse.json({ error: 'Call report not found' }, { status: 404 });
      }

      return NextResponse.json(report);
    } else {
      const page = parseInt(searchParams.get('page') || '1');
      const limit = parseInt(searchParams.get('limit') || '10');
      const skip = (page - 1) * limit;

      const reports = await prisma.callReport.findMany({
        skip,
        take: limit,
        orderBy: {
          createdAt: 'desc',
        },
      });

      const total = await prisma.callReport.count();

      return NextResponse.json({
        reports,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      });
    }
  } catch (error) {
    console.error('Error fetching call reports:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
} 