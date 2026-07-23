import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    // Array of dummy teachers to test the IPA/IPS/UMUM logic
    const dummyTeachers = [
      { name: 'Albert Einstein', nis_niy: 'T-IPA-01', password: '12345', role: 'TEACHER' as const, department: 'IPA' as const, gender: 'Laki-Laki' },
      { name: 'Marie Curie', nis_niy: 'T-IPA-02', password: '12345', role: 'TEACHER' as const, department: 'IPA' as const, gender: 'Perempuan' },
      
      { name: 'Adam Smith', nis_niy: 'T-IPS-01', password: '12345', role: 'TEACHER' as const, department: 'IPS' as const, gender: 'Laki-Laki' },
      { name: 'Rosa Parks', nis_niy: 'T-IPS-02', password: '12345', role: 'TEACHER' as const, department: 'IPS' as const, gender: 'Perempuan' },
      
      { name: 'John Doe', nis_niy: 'T-UMUM-01', password: '12345', role: 'TEACHER' as const, department: 'UMUM' as const, gender: 'Laki-Laki' },
      { name: 'Sarah Connor', nis_niy: 'T-UMUM-02', password: '12345', role: 'TEACHER' as const, department: 'UMUM' as const, gender: 'Perempuan' },
    ];

    // Insert them into the database all at once
    const result = await prisma.user.createMany({
      data: dummyTeachers,
      skipDuplicates: true, // Prevents crashing if you refresh the page
    });

    return NextResponse.json({ 
      success: true, 
      message: `Successfully added ${result.count} dummy teachers!`,
      teachers: dummyTeachers 
    });

  } catch (error) {
    console.error("SEED ERROR:", error);
    return NextResponse.json({ error: "Failed to seed database" }, { status: 500 });
  }
}