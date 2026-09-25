import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import bcrypt from 'bcryptjs';

export async function POST(req: Request) {
  try {
    const rawStudentsData = await req.json();

    if (!Array.isArray(rawStudentsData) || rawStudentsData.length === 0) {
      return NextResponse.json({ error: "No data provided" }, { status: 400 });
    }

    const existingUsers = await prisma.user.findMany({
      select: { email: true, nis_niy: true }
    });
    
    const existingEmails = new Set(existingUsers.map(u => u.email));
    const existingNis = new Set(existingUsers.map(u => u.nis_niy));

    const validStudentsToInsert = [];
    let duplicateCount = 0;
    let emptyRowsSkipped = 0;

    for (const rawStudent of rawStudentsData) {
      // 🚀 THE FIX: Convert all Excel column headers to lowercase automatically
      // Now "Name", "NAME", and "name" will all work perfectly!
      const student: any = {};
      for (const key in rawStudent) {
        student[key.toLowerCase().trim()] = rawStudent[key];
      }

      // Check using our newly normalized lowercase keys
      const sName = student.name;
      const sIdentifier = student.email || student.username || student.nis;

      if (!sName && !sIdentifier) {
        emptyRowsSkipped++;
        continue;
      }

      const rawInput = String(sIdentifier || '').trim().toLowerCase();
      if (!rawInput) {
        emptyRowsSkipped++;
        continue; 
      }
      
      const generatedEmail = rawInput.includes('@') ? rawInput : `${rawInput}@mdc.sch.id`;
      const nis_niy = rawInput.includes('@') ? rawInput.split('@')[0] : rawInput;

      if (existingEmails.has(generatedEmail) || existingNis.has(nis_niy)) {
        duplicateCount++;
        continue; 
      }

      const rawPassword = student.password ? String(student.password) : 'student123';
      const hashedPassword = await bcrypt.hash(rawPassword, 10);

      validStudentsToInsert.push({
        name: String(sName || 'Unknown Student'),
        nis_niy: nis_niy, 
        email: generatedEmail,
        password: hashedPassword,
        role: 'STUDENT',
        gender: student.gender ? String(student.gender) : null,
        className: student.kelas || student.class || null,
      });

      existingEmails.add(generatedEmail);
      existingNis.add(nis_niy);
    }

    if (validStudentsToInsert.length === 0) {
      return NextResponse.json({ 
        message: `No new students added. ${duplicateCount} duplicates ignored.`,
        count: 0
      });
    }

    const result = await prisma.user.createMany({
      data: validStudentsToInsert,
      skipDuplicates: true, 
    });

    return NextResponse.json({ 
      message: `Successfully added ${result.count} new students! (${duplicateCount} duplicates ignored).`, 
      count: result.count 
    });

  } catch (error: any) {
    console.error("❌ BULK IMPORT ERROR:", error);
    return NextResponse.json({ error: "Failed to import students. Check console for details." }, { status: 500 });
  }
}