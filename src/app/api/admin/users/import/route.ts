import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth'; // Adjust path to your NextAuth config
import { prisma } from '@/lib/prisma';
import * as XLSX from 'xlsx';

export async function POST(request: Request) {
  try {
    // 1. Verify Admin Session
    const session = await getServerSession(authOptions);
    if (!session || session.user?.role !== 'ADMIN') {
      return NextResponse.json(
        { error: 'Unauthorized access. Only Admins can import data.' },
        { status: 403 }
      );
    }

    // 2. Extract uploaded file
    const formData = await request.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json({ error: 'No Excel file provided.' }, { status: 400 });
    }

    const bytes = await file.arrayBuffer();
    const workbook = XLSX.read(bytes, { type: 'array' });
    const worksheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows: any[] = XLSX.utils.sheet_to_json(worksheet);

    if (rows.length === 0) {
      return NextResponse.json({ error: 'Excel file is empty.' }, { status: 400 });
    }

    const importedCount = { created: 0, updated: 0, skipped: 0 };

    // 3. Process records inside a transaction
    await prisma.$transaction(async (tx) => {
      for (const row of rows) {
        const nip = String(row['NIP / Staff ID'] || row['NIP'] || row['nip'] || '').trim();
        const name = String(row['Full Name'] || row['Name'] || row['name'] || '').trim();
        const email = String(row['Email Domain'] || row['Email'] || row['email'] || '').trim();
        const rawRole = String(row['Role'] || row['role'] || 'STAFF').trim().toUpperCase();
        const department = String(row['Department'] || row['department'] || '').trim();

        // Prevent inserting or modifying student accounts via this route
        if (!email || !name || rawRole === 'STUDENT') {
          importedCount.skipped++;
          continue;
        }

        const existingUser = await tx.user.findFirst({
          where: { OR: [{ email }, ...(nip ? [{ nip }] : [])] },
        });

        if (existingUser) {
          if (existingUser.role === 'STUDENT') {
            importedCount.skipped++;
            continue;
          }

          await tx.user.update({
            where: { id: existingUser.id },
            data: {
              name,
              nip: nip || existingUser.nip,
              role: rawRole as any,
              department: department || existingUser.department,
            },
          });
          importedCount.updated++;
        } else {
          await tx.user.create({
            data: {
              email,
              name,
              nip: nip || null,
              role: rawRole as any,
              department: department || null,
              password: '$2a$12$eA83.1X7H.3/12345defaultHashedPassword', // Default hashed password
            },
          });
          importedCount.created++;
        }
      }
    });

    return NextResponse.json({
      message: `Admin Sync Complete: ${importedCount.created} created, ${importedCount.updated} updated. (${importedCount.skipped} skipped)`,
      stats: importedCount,
    });
  } catch (error) {
    console.error('Error importing master users:', error);
    return NextResponse.json({ error: 'Failed to process Excel import.' }, { status: 500 });
  }
}