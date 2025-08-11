import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function POST(request: NextRequest) {
  try {
    const userId = request.headers.get('x-user-id');
    const { feedbackId, sectionName, sectionKey, agreement, comment } = await request.json();

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!feedbackId || !sectionName || !agreement || !comment) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Verify the feedback exists (we don't need to check ownership for manager comments)
    const feedback = await prisma.offlineCallFeedback.findUnique({
      where: {
        id: feedbackId
      }
    });

    if (!feedback) {
      return NextResponse.json({ error: 'Feedback not found' }, { status: 404 });
    }

    // Check if a comment already exists for this section by this manager
    const existingComment = await prisma.managerComment.findFirst({
      where: {
        offlineCallFeedbackId: feedbackId,
        sectionName: sectionName,
        sectionKey: sectionKey || null,
        managerId: userId
      }
    });

    let managerComment;

    if (existingComment) {
      // Update existing comment
      managerComment = await prisma.managerComment.update({
        where: {
          id: existingComment.id
        },
        data: {
          agreement,
          comment,
          updatedAt: new Date()
        },
        include: {
          manager: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true
            }
          }
        }
      });
    } else {
      // Create new comment
      managerComment = await prisma.managerComment.create({
        data: {
          offlineCallFeedbackId: feedbackId,
          sectionName,
          sectionKey: sectionKey || null,
          agreement,
          comment,
          managerId: userId
        },
        include: {
          manager: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true
            }
          }
        }
      });
    }

    return NextResponse.json({ 
      message: existingComment ? 'Comment updated successfully' : 'Comment created successfully', 
      comment: managerComment 
    });
  } catch (error) {
    console.error('Error managing comment:', error);
    return NextResponse.json({ error: 'Failed to manage comment' }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    const userId = request.headers.get('x-user-id');
    const url = new URL(request.url);
    const feedbackId = url.searchParams.get('feedbackId');

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!feedbackId) {
      return NextResponse.json({ error: 'Feedback ID is required' }, { status: 400 });
    }

    const comments = await prisma.managerComment.findMany({
      where: {
        offlineCallFeedbackId: feedbackId
      },
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
    });

    return NextResponse.json(comments);
  } catch (error) {
    console.error('Error fetching comments:', error);
    return NextResponse.json({ error: 'Failed to fetch comments' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const userId = request.headers.get('x-user-id');
    const url = new URL(request.url);
    const commentId = url.searchParams.get('id');

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!commentId) {
      return NextResponse.json({ error: 'Comment ID is required' }, { status: 400 });
    }

    // Verify the comment belongs to the manager before deleting
    const comment = await prisma.managerComment.findFirst({
      where: {
        id: commentId,
        managerId: userId
      }
    });

    if (!comment) {
      return NextResponse.json({ error: 'Comment not found or unauthorized' }, { status: 404 });
    }

    await prisma.managerComment.delete({
      where: {
        id: commentId
      }
    });

    return NextResponse.json({ message: 'Comment deleted successfully' });
  } catch (error) {
    console.error('Error deleting comment:', error);
    return NextResponse.json({ error: 'Failed to delete comment' }, { status: 500 });
  }
} 