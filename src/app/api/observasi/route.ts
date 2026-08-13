import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const observations = await prisma.observation.findMany({
      orderBy: { createdAt: 'desc' }
    });
    return NextResponse.json(observations);
  } catch (error) {
    return NextResponse.json({ error: "Failed to fetch observations" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const data = await req.json();
    const newObs = await prisma.observation.create({ data });
    return NextResponse.json(newObs);
  } catch (error) {
    return NextResponse.json({ error: "Failed to save observation" }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  try {
    const data = await req.json();
    const { id, ...updateData } = data;
    const updatedObs = await prisma.observation.update({
      where: { id },
      data: updateData
    });
    return NextResponse.json(updatedObs);
  } catch (error) {
    return NextResponse.json({ error: "Failed to update observation" }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const { id } = await req.json();
    await prisma.observation.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: "Failed to delete observation" }, { status: 500 });
  }
}