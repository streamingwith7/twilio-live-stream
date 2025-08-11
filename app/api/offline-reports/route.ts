import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(request: NextRequest) {
  try {
    const userId = request.headers.get('x-user-id');

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const offlineFeedbacks = await prisma.offlineCallFeedback.findMany({
      where: {
        userId: userId
      },
      include: {
        managerComments: {
          include: {
            manager: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true
              }
            }
          },
          orderBy: {
            createdAt: 'desc'
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    return NextResponse.json(offlineFeedbacks);
  } catch (error) {
    console.error('Error fetching offline feedbacks:', error);
    return NextResponse.json({ error: 'Failed to fetch offline feedbacks' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const userId = request.headers.get('x-user-id');
    const url = new URL(request.url);
    const feedbackId = url.searchParams.get('id');

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!feedbackId) {
      return NextResponse.json({ error: 'Feedback ID is required' }, { status: 400 });
    }

    // Verify the feedback belongs to the user before deleting
    const feedback = await prisma.offlineCallFeedback.findFirst({
      where: {
        id: feedbackId,
        userId: userId
      }
    });

    if (!feedback) {
      return NextResponse.json({ error: 'Feedback not found' }, { status: 404 });
    }

    await prisma.offlineCallFeedback.delete({
      where: {
        id: feedbackId
      }
    });

    return NextResponse.json({ message: 'Feedback deleted successfully' });
  } catch (error) {
    console.error('Error deleting offline feedback:', error);
    return NextResponse.json({ error: 'Failed to delete feedback' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const userId = request.headers.get('x-user-id');
    const { feedbackId, recordingUrl } = await request.json();

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!feedbackId) {
      return NextResponse.json({ error: 'Feedback ID is required' }, { status: 400 });
    }

    // Verify the feedback belongs to the user before updating
    const feedback = await prisma.offlineCallFeedback.findFirst({
      where: {
        id: feedbackId,
        userId: userId
      }
    });

    if (!feedback) {
      return NextResponse.json({ error: 'Feedback not found' }, { status: 404 });
    }

    const updatedFeedback = await prisma.offlineCallFeedback.update({
      where: {
        id: feedbackId
      },
      data: {
        recordingUrl: recordingUrl
      }
    });

    return NextResponse.json({ message: 'Recording URL updated successfully', feedback: updatedFeedback });
  } catch (error) {
    console.error('Error updating offline feedback:', error);
    return NextResponse.json({ error: 'Failed to update feedback' }, { status: 500 });
  }
} 