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
    const { callSid, tipId, comment, userSuggestion } = await request.json();

    // Handle user suggestion creation
    if (userSuggestion) {
      return await handleUserSuggestion(callSid, userSuggestion);
    }

    // Handle comment addition to existing tips
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
    if (!reportData) {
      return NextResponse.json({ error: 'No report data found' }, { status: 400 });
    }

    // Find the tip or user suggestion and add the comment
    let targetIndex = -1;
    let targetType = '';
    
    if (reportData.tipHistory) {
      targetIndex = reportData.tipHistory.findIndex((tip: any) => tip.id === tipId);
      if (targetIndex !== -1) {
        targetType = 'tip';
      }
    }
    
    // If not found in tips, try user suggestions
    if (targetIndex === -1 && reportData.userSuggestions) {
      targetIndex = reportData.userSuggestions.findIndex((suggestion: any) => suggestion.id === tipId);
      if (targetIndex !== -1) {
        targetType = 'userSuggestion';
      }
    }
    
    if (targetIndex === -1) {
      return NextResponse.json({ error: 'Tip or suggestion not found' }, { status: 404 });
    }

    // Add the new comment with timestamp
    const newComment = {
      id: Date.now().toString(),
      text: comment,
      timestamp: new Date().toISOString(),
      author: 'User', 
    };

    // Initialize comments array if it doesn't exist and add comment
    if (targetType === 'tip') {
      if (!reportData.tipHistory[targetIndex].comments) {
        reportData.tipHistory[targetIndex].comments = [];
      }
      reportData.tipHistory[targetIndex].comments.push(newComment);
    } else if (targetType === 'userSuggestion') {
      if (!reportData.userSuggestions[targetIndex].comments) {
        reportData.userSuggestions[targetIndex].comments = [];
      }
      reportData.userSuggestions[targetIndex].comments.push(newComment);
    }

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

async function handleUserSuggestion(callSid: string, userSuggestion: any) {
  try {
    const { suggestion, reasoning, conversationTurnIndex } = userSuggestion;

    if (!suggestion || !reasoning || conversationTurnIndex === undefined) {
      return NextResponse.json({ error: 'Missing required fields for suggestion' }, { status: 400 });
    }

    // Get the current report
    const report = await prisma.callReport.findUnique({
      where: { callSid },
    });

    if (!report) {
      return NextResponse.json({ error: 'Call report not found' }, { status: 404 });
    }

    // Parse the report data
    const reportData = report.reportData as any;
    if (!reportData) {
      return NextResponse.json({ error: 'No report data found' }, { status: 400 });
    }

    // Initialize userSuggestions array if it doesn't exist
    if (!reportData.userSuggestions) {
      reportData.userSuggestions = [];
    }

    // Create the new user suggestion
    const newUserSuggestion = {
      id: Date.now().toString(),
      suggestion,
      reasoning,
      timestamp: new Date().toISOString(),
      author: 'User',
      conversationTurnIndex,
      comments: [],
    };

    reportData.userSuggestions.push(newUserSuggestion);

    // Update the report in the database
    await prisma.callReport.update({
      where: { callSid },
      data: {
        reportData: reportData,
        updatedAt: new Date(),
      },
    });

    return NextResponse.json({ 
      success: true, 
      userSuggestion: newUserSuggestion,
      message: 'User suggestion added successfully' 
    });
  } catch (error) {
    console.error('Error adding user suggestion:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
} 