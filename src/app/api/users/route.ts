import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";

export const dynamic = 'force-dynamic';

// 1. GET: Fetch all users (used by Admin Students & Admin Users pages)
export async function GET() {
  try {
    const users = await prisma.user.findMany({
      select: {
        id: true,
        name: true,
        nis_niy: true,
        role: true,
        email: true,
        gender: true,
        department: true,
        className: true, // 🚀 Crucial for the Student page
      },
      orderBy: { name: 'asc' }
    });
    return NextResponse.json(users);
  } catch (error) {
    console.error("GET USERS ERROR:", error);
    return NextResponse.json({ error: "Failed to fetch users" }, { status: 500 });
  }
}

// 2. POST: Create a single user manually
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { name, nis_niy, password, role, gender, department, className } = body;

    // Securely hash the password before saving
    const hashedPassword = await bcrypt.hash(password || 'default123', 10);

    const newUser = await prisma.user.create({
      data: {
        name,
        nis_niy,
        password: hashedPassword,
        role,
        gender: gender || null,
        department: department || null,
        className: className || null,
      }
    });

    return NextResponse.json(newUser);
  } catch (error) {
    console.error("POST USER ERROR:", error);
    return NextResponse.json({ error: "Failed to create user. Check if NIS/Username is already taken." }, { status: 500 });
  }
}

// 3. PUT: Update a user (used by your new Edit Student modal!)
export async function PUT(req: Request) {
  try {
    const data = await req.json();
    const { id, name, nis_niy, email, role, department, gender, className, password } = data;

    if (!id) {
      return NextResponse.json({ error: "User ID is required" }, { status: 400 });
    }

    const updateData: any = {};
    if (name !== undefined) updateData.name = name;
    if (nis_niy !== undefined) updateData.nis_niy = nis_niy;
    if (email !== undefined) updateData.email = email;
    if (role !== undefined) updateData.role = role;
    if (department !== undefined) updateData.department = department;
    if (gender !== undefined) updateData.gender = gender;
    
    // 🚀 Update the class name for students
    if (className !== undefined) updateData.className = className;

    // If the admin decides to reset their password through the edit modal
    if (password) {
      updateData.password = await bcrypt.hash(password, 10);
    }

    const updatedUser = await prisma.user.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json(updatedUser);
  } catch (error) {
    console.error("PUT USER ERROR:", error);
    return NextResponse.json({ error: "Failed to update user data" }, { status: 500 });
  }
}

// 4. DELETE: Remove a user (used by the Delete button)
export async function DELETE(req: Request) {
  try {
    // Read the ID securely from the URL parameters (e.g., ?id=123)
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: "User ID is required" }, { status: 400 });
    }

    await prisma.user.delete({
      where: { id }
    });

    return NextResponse.json({ message: "User deleted successfully" });
  } catch (error) {
    console.error("DELETE USER ERROR:", error);
    return NextResponse.json({ error: "Failed to delete user" }, { status: 500 });
  }
}