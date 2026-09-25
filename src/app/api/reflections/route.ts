import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    // NOTE: Change 'selfReflection' if your table is named 'evaluation' or something else in schema.prisma
    const reflections = await prisma.selfReflection.findMany({
      include: {
        // This is the magic part that shows WHO the rubric is for!
        user: {
          select: { 
            name: true, 
            className: true, 
            nis_niy: true 
          }
        }
      },
      orderBy: {
        id: 'desc'
      }
    });

    return NextResponse.json(reflections);
  } catch (error) {
    console.error("❌ FETCH REFLECTIONS ERROR:", error);
    return NextResponse.json({ error: "Failed to fetch reflections." }, { status: 500 });
  }
}   