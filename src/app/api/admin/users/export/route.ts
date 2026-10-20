import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth'; // Adjust path to your NextAuth config
import { prisma } from '@/lib/prisma';
import * as XLSX from 'xlsx';

export async function GET() {
  try {
    // 1. Verify Admin Session
    const session = await getServerSession(authOptions);
    if (!session || session.user?.role !== 'ADMIN') {
      return NextResponse.json(
        { error: 'Unauthorized access. Only Admins can export data.' },
        { status: 403 }
      );
    }

    // 2. Fetch all non-student user accounts
    const users = await prisma.user.findMany({
      where: {
        role: {
          not: 'STUDENT',
        },
      },
      select: {
        nip: true,
        name: true,
        email: true,
        role: true,
        department: true,
      },
      orderBy: { role: 'asc' },
    });

    const exportData = users.map((user) => ({
      'NIP / Staff ID': user.nip || '-',
      'Full Name': user.name,
      'Email Domain': user.email,
      'Role': user.role,
      'Department': user.department || '-',
    }));

    const worksheet = XLSX.utils.json_to_sheet(exportData);
    worksheet['!cols'] = [
      { wch: 18 }, // NIP
      { wch: 30 }, // Full Name
      { wch: 35 }, // Email
      { wch: 18 }, // Role
      { wch: 22 }, // Department
    ];

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Non-Student Users');

    const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'buffer' });

    return new NextResponse(excelBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="Admin_Master_Staff_${new Date().toISOString().split('T')[0]}.xlsx"`,
      },
    });
  } catch (error) {
    console.error('Error exporting users:', error);
    return NextResponse.json({ error: 'Failed to export user data.' }, { status: 500 });
  }
}   
