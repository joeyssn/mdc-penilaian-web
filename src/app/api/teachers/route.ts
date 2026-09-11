import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const teachers = await prisma.user.findMany({
      // We now fetch DIRECTOR and PRINCIPAL separately
      where: { role: { in: ['TEACHER', 'STAFF', 'DIRECTOR', 'PRINCIPAL', 'ADMIN','VICE_PRINCIPAL_KESISWAAN','VICE_PRINCIPAL_KURIKULUM','KARYAWAN'] } }, 
      select: { 
        id: true, 
        name: true, 
        role: true, 
        gender: true,
        email: true,
        nis_niy: true,
        department: true 
      }
    });

    return NextResponse.json(teachers);
  } catch (error) {
    console.error("API TEACHERS ERROR:", error);
    return NextResponse.json({ error: "Failed to fetch teachers" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const { name, email, gender, role, department, nis_niy } = await req.json();

    const newUser = await prisma.user.create({
      data: {
        id: crypto.randomUUID(), 
        name,
        email: email || null,
        gender: gender || null,
        department: department || 'UMUM',
        role, // We can just pass the role directly now!
        nis_niy, 
        password: nis_niy, 
      }
    });
    
    return NextResponse.json(newUser);
  } catch (error: any) {
    if (error.code === 'P2002') {
      return NextResponse.json({ error: "A user with this NIY already exists!" }, { status: 400 });
    }
    console.error("❌ CREATE TEACHER ERROR:", error);
    return NextResponse.json({ error: "Failed to create teacher" }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  try {
    const { id, name, email, gender, role, department, nis_niy } = await req.json();

    const updatedUser = await prisma.user.update({
      where: { id },
      data: {
        name,
        email: email || null,
        gender: gender || null,
        department: department || 'UMUM',
        role, // We can just pass the role directly now!
        nis_niy,
      }
    });
    
    return NextResponse.json(updatedUser);
  } catch (error: any) {
    if (error.code === 'P2002') {
      return NextResponse.json({ error: "Another user is already using this NIY!" }, { status: 400 });
    }
    console.error("❌ UPDATE TEACHER ERROR:", error);
    return NextResponse.json({ error: "Failed to update teacher" }, { status: 500 });
  }
  
}

export async function DELETE(req: Request) {
  try {
    const { id } = await req.json();
    await prisma.user.delete({ where: { id } });
    return NextResponse.json({ message: "Deleted successfully" });
  } catch (error) {
    console.error("❌ DELETE TEACHER ERROR:", error);
    return NextResponse.json({ error: "Failed to delete teacher" }, { status: 500 });
  }
}