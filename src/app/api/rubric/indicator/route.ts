import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { denyUnlessRole, RUBRIC_EDITOR_ROLES } from "@/lib/session";

export async function POST(req: Request) {
  const denied = await denyUnlessRole(RUBRIC_EDITOR_ROLES);
  if (denied) return denied;
  try {
    const { text, weight, categoryId } = await req.json();
    const indicator = await prisma.rubricindicator.create({
      data: { 
        id: crypto.randomUUID(), // <-- ADD THIS LINE
        text, 
        weight, 
        categoryId, 
        order: 0,
        createdAt: new Date(), // <-- Add this
        updatedAt: new Date()  // <-- Add this
      },
    });
    return NextResponse.json(indicator);
  } catch (error) {
    console.error("❌ CREATE INDICATOR ERROR:", error);
    return NextResponse.json({ error: "Failed to create indicator" }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  const denied = await denyUnlessRole(RUBRIC_EDITOR_ROLES);
  if (denied) return denied;
  try {
    const { id, text, weight } = await req.json();
    const indicator = await prisma.rubricindicator.update({
      where: { id },
      data: { text, weight },
    });
    return NextResponse.json(indicator);
  } catch (error) {
    console.error("❌ UPDATE INDICATOR ERROR:", error);
    return NextResponse.json({ error: "Failed to update indicator" }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  const denied = await denyUnlessRole(RUBRIC_EDITOR_ROLES);
  if (denied) return denied;
  try {
    const { id } = await req.json();
    await prisma.rubricindicator.delete({
      where: { id },
    });
    return NextResponse.json({ message: "Deleted successfully" });
  } catch (error) {
    console.error("❌ DELETE INDICATOR ERROR:", error);
    return NextResponse.json({ error: "Failed to delete indicator" }, { status: 500 });
  }
}