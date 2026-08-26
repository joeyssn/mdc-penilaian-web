import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

const DEFAULT_ROLES = ['Teacher', 'Staff', 'Vice-Principal', 'Director/Principal', 'Karyawan']; // 🚀 Added Karyawan
export async function GET() {
  try {
    let settings = await prisma.weightSettings.findMany();
    
    // Auto-create defaults for any missing roles in the database
    for (const role of DEFAULT_ROLES) {
      if (!settings.find((s: any) => s.id === role)) {
        const newSetting = await prisma.weightSettings.create({
          data: { id: role, studentWeight: 25, peerWeight: 25, observationWeight: 25, attendanceWeight: 25 }
        });
        settings.push(newSetting);
      }
    }
    return NextResponse.json(settings);
  } catch (error) {
    return NextResponse.json({ error: "Failed to fetch weights" }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  try {
    const data = await req.json(); // Now receives an array of roles
    
    for (const d of data) {
      await prisma.weightSettings.upsert({
        where: { id: d.id },
        update: { 
          studentWeight: d.studentWeight, 
          peerWeight: d.peerWeight, 
          observationWeight: d.observationWeight, 
          attendanceWeight: d.attendanceWeight 
        },
        create: { 
          id: d.id, 
          studentWeight: d.studentWeight, 
          peerWeight: d.peerWeight, 
          observationWeight: d.observationWeight, 
          attendanceWeight: d.attendanceWeight 
        }
      });
    }
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: "Failed to update weights" }, { status: 500 });
  }
}