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

export async function POST(request: NextRequest) {
  try {
    const { callSid, tipId, comment } = await request.json();

    if (!callSid || !tipId || !comment) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const report = await prisma.callReport.findUnique({
      where: { callSid },
    });

    if (!report) {
      return NextResponse.json({ error: 'Call report not found' }, { status: 404 });
    }

    const reportData = report.reportData as any;
    if (!reportData || !reportData.tipHistory) {
      return NextResponse.json({ error: 'No tip history found' }, { status: 400 });
    }

    const tipIndex = reportData.tipHistory.findIndex((tip: any) => tip.id === tipId);
    if (tipIndex === -1) {
      return NextResponse.json({ error: 'Tip not found' }, { status: 404 });
    }

    if (!reportData.tipHistory[tipIndex].comments) {
      reportData.tipHistory[tipIndex].comments = [];
    }

    const newComment = {
      id: Date.now().toString(),
      text: comment,
      timestamp: new Date().toISOString(),
      author: 'User', 
    };

    reportData.tipHistory[tipIndex].comments.push(newComment);

    const updatedReport = await prisma.callReport.update({
      where: { callSid },
      data: {
        reportData: reportData,
        updatedAt: new Date(),
      },
    });

    return NextResponse.json({ 
      success: true, 
      comment: newComment,
      message: 'Comment added successfully' 
    });
  } catch (error) {
    console.error('Error adding comment:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
} 