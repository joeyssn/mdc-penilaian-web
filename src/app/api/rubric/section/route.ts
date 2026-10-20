import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { denyUnlessRole, RUBRIC_EDITOR_ROLES } from "@/lib/session";

export async function POST(req: Request) {
  const denied = await denyUnlessRole(RUBRIC_EDITOR_ROLES);
  if (denied) return denied;
  try {
    const { title, rubricId } = await req.json();
    const section = await prisma.rubricsection.create({
      data: { 
        id: crypto.randomUUID(), // <-- THIS IS THE MISSING LINE
        title, 
        rubricId, 
        order: 0,
        createdAt: new Date(), // <-- Add this
        updatedAt: new Date()  // <-- Add this
      }, 
    });
    return NextResponse.json(section);
  } catch (error) {
    console.error("❌ CREATE SECTION ERROR:", error);
    return NextResponse.json({ error: "Failed to create section" }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  const denied = await denyUnlessRole(RUBRIC_EDITOR_ROLES);
  if (denied) return denied;
  try {
    const { id, title } = await req.json();
    const section = await prisma.rubricsection.update({
      where: { id },
      data: { title },
    });
    return NextResponse.json(section);
  } catch (error) {
    console.error("❌ UPDATE SECTION ERROR:", error);
    return NextResponse.json({ error: "Failed to update section" }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  const denied = await denyUnlessRole(RUBRIC_EDITOR_ROLES);
  if (denied) return denied;
  try {
    const { id } = await req.json();
    await prisma.rubricsection.delete({
      where: { id },
    });
    return NextResponse.json({ message: "Deleted successfully" });
  } catch (error) {
    console.error("❌ DELETE SECTION ERROR:", error);
    return NextResponse.json({ error: "Failed to delete section" }, { status: 500 });
  }
}