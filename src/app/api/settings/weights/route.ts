import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { denyUnlessRole, getSession, RUBRIC_EDITOR_ROLES } from '@/lib/session';
import { WEIGHT_PROFILES, LEGACY_PROFILE_IDS, isSdProfile, validateSdWeights } from '@/lib/weights';

export const dynamic = 'force-dynamic';

const VALID_IDS: string[] = [...WEIGHT_PROFILES];
const FIELDS = ['studentWeight', 'peerWeight', 'selfWeight', 'observationWeight', 'attendanceWeight', 'mainWeight', 'supervisorWeight', 'leaderWeight'] as const;

// GET: all weight profiles (any logged-in user; dashboards need their own profile)
export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  try {
    const weights = await prisma.evaluationWeight.findMany({ orderBy: { id: 'asc' } });
    return NextResponse.json(weights);
  } catch (error) {
    console.error('Error fetching evaluation weights:', error);
    return NextResponse.json({ error: 'Failed to fetch evaluation weights.' }, { status: 500 });
  }
}

// PUT: add or edit profiles (upsert). Each profile must total exactly 100%.
export async function PUT(request: Request) {
  const denied = await denyUnlessRole(RUBRIC_EDITOR_ROLES);
  if (denied) return denied;
  try {
    const body = await request.json();
    if (!Array.isArray(body)) {
      return NextResponse.json({ error: 'Payload must be an array of weight configurations.' }, { status: 400 });
    }

    for (const item of body) {
      if (!VALID_IDS.includes(item.id)) {
        return NextResponse.json({ error: `"${item.id}" is not a valid role.` }, { status: 400 });
      }
      const values = FIELDS.map(f => Number(item[f]) || 0);
      if (values.some(v => v < 0 || v > 100)) {
        return NextResponse.json({ error: `Weights for "${item.id}" must be between 0 and 100.` }, { status: 400 });
      }
      if (isSdProfile(item.id)) {
        const sdError = validateSdWeights(item);
        if (sdError) return NextResponse.json({ error: `${item.id}: ${sdError}` }, { status: 400 });
        continue;
      }
      const total = ['studentWeight', 'peerWeight', 'selfWeight', 'observationWeight', 'attendanceWeight']
        .reduce((a, f) => a + (Number(item[f]) || 0), 0);
      if (total !== 100) {
        return NextResponse.json({ error: `Total weight for "${item.id}" must equal 100%. Currently: ${total}%` }, { status: 400 });
      }
    }

    const ops: any[] = body.map((item) => {
      const data = Object.fromEntries(FIELDS.map(f => [f, Number(item[f]) || 0])) as Record<(typeof FIELDS)[number], number>;
      return prisma.evaluationWeight.upsert({
        where: { id: item.id },
        update: data,
        create: { id: item.id, ...data },
      });
    });

    // Saving the full per-role set replaces the old five group profiles (Teacher, Staff, ...)
    const coversEveryRole = WEIGHT_PROFILES.every(id => body.some((item) => item.id === id));
    if (coversEveryRole) {
      ops.push(prisma.evaluationWeight.deleteMany({ where: { id: { in: LEGACY_PROFILE_IDS } } }));
    }

    await prisma.$transaction(ops);
    return NextResponse.json(await prisma.evaluationWeight.findMany({ orderBy: { id: 'asc' } }));
  } catch (error) {
    console.error('Error updating evaluation weights:', error);
    return NextResponse.json({ error: 'Failed to update evaluation weights.' }, { status: 500 });
  }
}

// DELETE ?id=Teacher : remove a profile. Users it covered fall back to a broader profile, or equal 20% weights.
export async function DELETE(request: Request) {
  const denied = await denyUnlessRole(RUBRIC_EDITOR_ROLES);
  if (denied) return denied;
  try {
    const id = new URL(request.url).searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'Profile id is required.' }, { status: 400 });
    await prisma.evaluationWeight.deleteMany({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting evaluation weight:', error);
    return NextResponse.json({ error: 'Failed to delete weight profile.' }, { status: 500 });
  }
}
