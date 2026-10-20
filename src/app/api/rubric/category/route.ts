import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { denyUnlessRole, RUBRIC_EDITOR_ROLES } from "@/lib/session";

export async function POST(req: Request) {
  const denied = await denyUnlessRole(RUBRIC_EDITOR_ROLES);
  if (denied) return denied;
  try {
    const { title, sectionId } = await req.json();
    const category = await prisma.rubriccategory.create({
      data: { 
        id: crypto.randomUUID(), // <-- ADD THIS LINE
        title, 
        sectionId, 
        order: 0,
        createdAt: new Date(), // <-- Add this
        updatedAt: new Date()  // <-- Add this
      },
    });
    return NextResponse.json(category);
  } catch (error) {
    console.error("❌ CREATE CATEGORY ERROR:", error);
    return NextResponse.json({ error: "Failed to create category" }, { status: 500 });
  }
}
export async function PUT(req: Request) {
  const denied = await denyUnlessRole(RUBRIC_EDITOR_ROLES);
  if (denied) return denied;
  try {
    const { id, title } = await req.json();
    const category = await prisma.rubriccategory.update({
      where: { id },
      data: { title },
    });
    return NextResponse.json(category);
  } catch (error) {
    console.error("❌ UPDATE CATEGORY ERROR:", error);
    return NextResponse.json({ error: "Failed to update category" }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  const denied = await denyUnlessRole(RUBRIC_EDITOR_ROLES);
  if (denied) return denied;
  try {
    const { id } = await req.json();
    await prisma.rubriccategory.delete({
      where: { id },
    });
    return NextResponse.json({ message: "Deleted successfully" });
  } catch (error) {
    console.error("❌ DELETE CATEGORY ERROR:", error);
    return NextResponse.json({ error: "Failed to delete category" }, { status: 500 });
  }
}