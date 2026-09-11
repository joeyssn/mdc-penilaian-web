import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import bcrypt from 'bcryptjs';

export async function POST(req: Request) {
  try {
    const studentsData = await req.json();

    if (!Array.isArray(studentsData) || studentsData.length === 0) {
      return NextResponse.json({ error: "No data provided" }, { status: 400 });
    }

    // 1. Fetch existing users to compare against
    const existingUsers = await prisma.user.findMany({
      select: { email: true, nis_niy: true }
    });
    
    // Create fast lookup sets for emails and NIS
    const existingEmails = new Set(existingUsers.map(u => u.email));
    const existingNis = new Set(existingUsers.map(u => u.nis_niy));

    const validStudentsToInsert = [];
    let duplicateCount = 0;

    // 2. Filter out duplicates
    for (const student of studentsData) {
      // Clean up the input
      const rawInput = String(student.email || student.username || student.nis || Math.random().toString(36).substring(7)).trim().toLowerCase();
      
      const generatedEmail = rawInput.includes('@') ? rawInput : `${rawInput}@mdc.sch.id`;
      
      // If they typed a full email in Excel, extract just the prefix for the NIS
      const nis_niy = rawInput.includes('@') ? rawInput.split('@')[0] : rawInput;

      // 🚀 THE DUPLICATE CHECK
      if (existingEmails.has(generatedEmail) || existingNis.has(nis_niy)) {
        duplicateCount++;
        continue; // Skip this student and move to the next one!
      }

      // If it is a new student, hash the password and prepare them for insertion
      const rawPassword = student.password ? String(student.password) : 'student123';
      const hashedPassword = await bcrypt.hash(rawPassword, 10);

      validStudentsToInsert.push({
        name: String(student.name || 'Unknown Student'),
        nis_niy: nis_niy, 
        email: generatedEmail,
        password: hashedPassword,
        role: 'STUDENT',
        gender: student.gender ? String(student.gender) : null,
        className: student.kelas || null,
      });

      // Add to our lookup sets so we don't insert duplicates that are within the same Excel file!
      existingEmails.add(generatedEmail);
      existingNis.add(nis_niy);
    }

    // 3. Check if there is actually anyone new to insert
    if (validStudentsToInsert.length === 0) {
      return NextResponse.json({ 
        message: `No new students imported. All ${duplicateCount} students were already in the database!`,
        count: 0
      });
    }

    // 4. Safely insert the new students
    const result = await prisma.user.createMany({
      data: validStudentsToInsert,
      skipDuplicates: true, // Double protection at the database level
    });

    return NextResponse.json({ 
      message: `Successfully imported ${result.count} new students! (${duplicateCount} duplicates skipped).`, 
      count: result.count 
    });

  } catch (error: any) {
    console.error("❌ BULK IMPORT ERROR:", error);
    return NextResponse.json({ error: "Failed to import students. Check console for details." }, { status: 500 });
  }
}