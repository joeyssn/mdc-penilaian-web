import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    const dummyStudents = [
      { 
        name: 'Andi (SMP 9A)', 
        email: 'andi@mdc.sch.id',
        nis_niy: 'S-9A', 
        password: 'S-9A', 
        role: 'STUDENT' as const, 
        department: 'UMUM' as const,
        grade: 9,
        level: 'SMP',
        className: '9A', // Uses letters
        gender: 'Laki-Laki' 
      },
      { 
        name: 'Rina (SMA 10.2)', 
        email: 'rina@mdc.sch.id',
        nis_niy: 'S-10.2', 
        password: 'S-10.2', 
        role: 'STUDENT' as const, 
        department: 'UMUM' as const,
        grade: 10,
        level: 'SMA',
        className: '10.2', // Uses decimals
        gender: 'Perempuan' 
      },
      { 
        name: 'Budi (SMA 11.1 IPA)', 
        email: 'budi11@mdc.sch.id',
        nis_niy: 'S-11.1', 
        password: 'S-11.1', 
        role: 'STUDENT' as const, 
        department: 'IPA' as const,
        grade: 11,
        level: 'SMA',
        className: '11.1 IPA', 
        gender: 'Laki-Laki' 
      },
    ];

    const result = await prisma.user.createMany({
      data: dummyStudents,
      skipDuplicates: true, 
    });

    return NextResponse.json({ success: true, message: `Added ${result.count} test students with Class Names!` });
  } catch (error) {
    return NextResponse.json({ error: "Failed to seed" }, { status: 500 });
  }
}