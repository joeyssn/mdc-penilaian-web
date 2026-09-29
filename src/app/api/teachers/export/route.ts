import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import * as XLSX from 'xlsx';

export async function GET() {
  try {
    // Fetch teachers and staff members
    const staffMembers = await prisma.user.findMany({
      where: {
        role: {
          in: ['TEACHER', 'STAFF', 'HRD', 'KARYAWAN', 'VICE_PRINCIPAL', 'PRINCIPAL', 'DIRECTOR'],
        },
      },
      select: {
        nip: true,
        name: true,
        email: true,
        role: true,
        department: true,
      },
      orderBy: { name: 'asc' },
    });

    // Format data for Excel sheet
    const exportData = staffMembers.map((member) => ({
      'NIP / Staff ID': member.nip || '-',
      'Full Name': member.name,
      'Email Domain': member.email,
      'Role': member.role,
      'Department': member.department || '-',
    }));

    // Create Excel Workbook
    const worksheet = XLSX.utils.json_to_sheet(exportData);
    
    // Auto-fit column widths
    const colWidths = [
      { wch: 18 }, // NIP
      { wch: 30 }, // Full Name
      { wch: 35 }, // Email
      { wch: 18 }, // Role
      { wch: 22 }, // Department
    ];
    worksheet['!cols'] = colWidths;

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Teachers & Staff');

    // Buffer output
    const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'buffer' });

    return new NextResponse(excelBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="Data_Teachers_Staff_${new Date().toISOString().split('T')[0]}.xlsx"`,
      },
    });
  } catch (error) {
    console.error('Error exporting teacher data:', error);
    return NextResponse.json({ error: 'Failed to export teacher/staff data' }, { status: 500 });
  }
}