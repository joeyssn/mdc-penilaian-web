import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = 'force-dynamic';

// 1. READ ALL TEACHERS
export async function GET() {
  try {
    // Only fetch users who are exactly 'TEACHER'
    const teachers = await prisma.user.findMany({
      where: {
        role: 'TEACHER'
      },
      select: {
        id: true,
        name: true,
        role: true,
        gender: true,
        department: true, // MUST include this for the IPA/IPS logic to work!
      }
    });

    return NextResponse.json(teachers);
  } catch (error) {
    // This will print the exact error to your terminal if it fails again
    console.error("API TEACHERS ERROR:", error);
    return NextResponse.json({ error: "Failed to fetch teachers" }, { status: 500 });
  }
}

// 2. CREATE A TEACHER
export async function POST(req: Request) {
  try {
    const { name, email, gender, role, nis_niy } = await req.json();
    
    const newUser = await prisma.user.create({
      data: {
        id: crypto.randomUUID(), 
        name,
        email: email || null,  // Saves email if provided
        gender: gender || null, // Saves gender if provided
        role,
        nis_niy, 
        password: nis_niy, 
      }
    });
    
    return NextResponse.json(newUser);
  } catch (error) {
    console.error("❌ CREATE TEACHER ERROR:", error);
    return NextResponse.json({ error: "Failed to create teacher" }, { status: 500 });
  }
}

// 3. EDIT A TEACHER
export async function PUT(req: Request) {
  try {
    const { id, name, email, gender, role, nis_niy } = await req.json();
    
    const updatedUser = await prisma.user.update({
      where: { id },
      data: {
        name,
        email: email || null,
        gender: gender || null,
        role,
        nis_niy,
      }
    });
    
    return NextResponse.json(updatedUser);
  } catch (error) {
    console.error("❌ UPDATE TEACHER ERROR:", error);
    return NextResponse.json({ error: "Failed to update teacher" }, { status: 500 });
  }
}

// 4. DELETE A TEACHER
export async function DELETE(req: Request) {
  try {
    const { id } = await req.json();
    
    await prisma.user.delete({
      where: { id }
    });
    
    return NextResponse.json({ message: "Deleted successfully" });
  } catch (error) {
    console.error("❌ DELETE TEACHER ERROR:", error);
    return NextResponse.json({ error: "Failed to delete teacher" }, { status: 500 });
  }
}