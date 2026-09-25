import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma'; // Adjust import according to your prisma instance path

// GET: Fetch all role-based evaluation weights
export async function GET() {
  try {
    const weights = await prisma.evaluationWeight.findMany();
    return NextResponse.json(weights, { status: 200 });
  } catch (error) {
    console.error('Error fetching evaluation weights:', error);
    return NextResponse.json(
      { error: 'Failed to fetch evaluation weights.' },
      { status: 500 }
    );
  }
}

// PUT: Bulk update role-based evaluation weights
export async function PUT(request: Request) {
  try {
    const body = await request.json();

    if (!Array.isArray(body)) {
      return NextResponse.json(
        { error: 'Payload must be an array of weight configurations.' },
        { status: 400 }
      );
    }

    // Validate that each entry sums to 100%
    for (const item of body) {
      const studentWeight = Number(item.studentWeight) || 0;
      const peerWeight = Number(item.peerWeight) || 0;
      const selfWeight = Number(item.selfWeight) || 0;
      const observationWeight = Number(item.observationWeight) || 0;
      const attendanceWeight = Number(item.attendanceWeight) || 0;

      const total = studentWeight + peerWeight + selfWeight + observationWeight + attendanceWeight;

      if (total !== 100) {
        return NextResponse.json(
          { error: `Total weight for role "${item.id}" must equal 100%. Currently: ${total}%` },
          { status: 400 }
        );
      }
    }

    // Perform atomic transaction updates across all configured roles
    const updatePromises = body.map((item) =>
      prisma.evaluationWeight.upsert({
        where: { id: item.id },
        update: {
          studentWeight: Number(item.studentWeight) || 0,
          peerWeight: Number(item.peerWeight) || 0,
          selfWeight: Number(item.selfWeight) || 0,
          observationWeight: Number(item.observationWeight) || 0,
          attendanceWeight: Number(item.attendanceWeight) || 0,
        },
        create: {
          id: item.id,
          studentWeight: Number(item.studentWeight) || 0,
          peerWeight: Number(item.peerWeight) || 0,
          selfWeight: Number(item.selfWeight) || 0,
          observationWeight: Number(item.observationWeight) || 0,
          attendanceWeight: Number(item.attendanceWeight) || 0,
        },
      })
    );

    const updatedWeights = await prisma.$transaction(updatePromises);

    return NextResponse.json(updatedWeights, { status: 200 });
  } catch (error) {
    console.error('Error updating evaluation weights:', error);
    return NextResponse.json(
      { error: 'Failed to update evaluation weights.' },
      { status: 500 }
    );
  }
}