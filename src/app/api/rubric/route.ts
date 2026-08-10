import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = 'force-dynamic'; 

// 1. READ ALL RUBRICS
export async function GET() {
  try {
    const rubrics = await prisma.rubric.findMany({
      include: {
        rubricsection: {
          orderBy: { createdAt: 'asc' }, 
          include: {
            rubriccategory: {
              orderBy: { createdAt: 'asc' }, 
              include: {
                rubricindicator: {
                  orderBy: { createdAt: 'asc' } 
                }
              }
            }
          }
        }
      }
    });

    const formattedRubrics = rubrics.map((rubric) => ({
      ...rubric,
      evaluators: rubric.evaluators ? rubric.evaluators.split(',') : [],
      evaluatees: rubric.evaluatees ? rubric.evaluatees.split(',') : [],
      sections: rubric.rubricsection.map((section) => ({
        ...section,
        categories: section.rubriccategory.map((category) => ({
          ...category,
          indicators: category.rubricindicator
        }))
      }))
    }));

    return NextResponse.json(formattedRubrics);
  } catch (error) {
    console.error("Failed to fetch rubrics:", error);
    return NextResponse.json({ error: "Failed to fetch rubrics" }, { status: 500 });
  }
}

// 2. CREATE A RUBRIC
export async function POST(req: Request) {
  try {
    const { title, description } = await req.json();
    const rubric = await prisma.rubric.create({
      data: { 
        id: crypto.randomUUID(), 
        title, 
        description,
        evaluators: "", // Start empty
        evaluatees: "", // Start empty
        updatedAt: new Date()
      }, 
    });
    return NextResponse.json(rubric);
  } catch (error) {
    console.error("❌ CREATE RUBRIC ERROR:", error);
    return NextResponse.json({ error: "Failed to create rubric" }, { status: 500 });
  }
}

// 3. UPDATE A RUBRIC 
export async function PUT(req: Request) {
  try {
    const { id, title, description, evaluators, evaluatees } = await req.json();
    
    // 🚀 The strict policy check block was completely removed from here!

    const updateData: any = { updatedAt: new Date() };
    if (title !== undefined) updateData.title = title;
    if (description !== undefined) updateData.description = description;
    
    // Convert arrays back to comma-separated strings for MySQL
    if (evaluators !== undefined) updateData.evaluators = evaluators.join(',');
    if (evaluatees !== undefined) updateData.evaluatees = evaluatees.join(',');

    const rubric = await prisma.rubric.update({
      where: { id },
      data: updateData,
    });
    
    return NextResponse.json(rubric);
  } catch (error) {
    console.error("❌ UPDATE RUBRIC ERROR:", error);
    return NextResponse.json({ error: "Failed to update rubric" }, { status: 500 });
  }
}

// 4. DELETE A RUBRIC
export async function DELETE(req: Request) {
  try {
    const { id } = await req.json();
    await prisma.rubric.delete({
      where: { id },
    });
    return NextResponse.json({ message: "Deleted successfully" });
  } catch (error) {
    console.error("❌ DELETE RUBRIC ERROR:", error);
    return NextResponse.json({ error: "Failed to delete rubric" }, { status: 500 });
  }
}