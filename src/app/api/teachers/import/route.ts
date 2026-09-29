import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import * as XLSX from 'xlsx';

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json({ error: 'No Excel file provided' }, { status: 400 });
    }

    // Read uploaded file array buffer
    const bytes = await file.arrayBuffer();
    const workbook = XLSX.read(bytes, { type: 'array' });

    // Read first worksheet
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const rows: any[] = XLSX.utils.sheet_to_json(worksheet);

    if (rows.length === 0) {
      return NextResponse.json({ error: 'Excel file is empty' }, { status: 400 });
    }

    const importedCount = { created: 0, updated: 0 };

    // Process rows inside a database transaction
    await prisma.$transaction(async (tx) => {
      for (const row of rows) {
        // Map excel columns (supports flexible header variations)
        const nip = String(row['NIP / Staff ID'] || row['NIP'] || row['nip'] || '').trim();
        const name = String(row['Full Name'] || row['Name'] || row['name'] || '').trim();
        const email = String(row['Email Domain'] || row['Email'] || row['email'] || '').trim();
        const rawRole = String(row['Role'] || row['role'] || 'STAFF').trim().toUpperCase();
        const department = String(row['Department'] || row['department'] || '').trim();

        if (!email || !name) continue; // Skip invalid rows without basic required info

        // Upsert user by Email or NIP
        const existingUser = await tx.user.findFirst({
          where: { OR: [{ email: email }, ...(nip ? [{ nip: nip }] : [])] },
        });

        if (existingUser) {
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
              // Default temporary password if required by schema
              password: '$2a$12$eA83.1X7H.3/12345defaultHashedPassword', 
            },
          });
          importedCount.created++;
        }
      }
    });

    return NextResponse.json({
      message: `Import successful! ${importedCount.created} created, ${importedCount.updated} updated.`,
      stats: importedCount,
    });
  } catch (error) {
    console.error('Error importing teacher data:', error);
    return NextResponse.json({ error: 'Failed to parse and import Excel file.' }, { status: 500 });
  }
}