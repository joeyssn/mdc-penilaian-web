import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isSdGroupLevel } from "@/lib/weights";
import { denyUnlessRole, getSession, RUBRIC_ASSIGNER_ROLES, RUBRIC_EDITOR_ROLES } from "@/lib/session";

export const dynamic = 'force-dynamic'; 

const SCHOOL_LEVELS = ['SD', 'SMP_SMA'];

// 1. READ ALL RUBRICS
export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  try {
    // SD people only see SD rubrics; everyone else sees SMP / SMA rubrics. Admin and director see all.
    const seesAll = session.role === 'ADMIN' || session.role === 'DIRECTOR';
    const rubricLevel = isSdGroupLevel(session.level) ? 'SD' : 'SMP_SMA';

    const rubrics = await prisma.rubric.findMany({
      where: seesAll ? {} : { schoolLevel: rubricLevel },
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
      // 🚀 The spread operator automatically includes isSelfReflection
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
  const denied = await denyUnlessRole(RUBRIC_EDITOR_ROLES);
  if (denied) return denied;
  try {
    // 🚀 Added isSelfReflection, evaluators, and evaluatees so they actually save!
    const { title, description, isSelfReflection, evaluators, evaluatees, schoolLevel } = await req.json();
    if (schoolLevel !== undefined && !SCHOOL_LEVELS.includes(schoolLevel)) {
      return NextResponse.json({ error: "School level must be SD or SMP_SMA." }, { status: 400 });
    }
    
    const rubric = await prisma.rubric.create({
      data: { 
        id: crypto.randomUUID(), 
        title, 
        description,
        isSelfReflection: isSelfReflection || false, // 🚀 SAVES THE CHECKBOX
        schoolLevel: schoolLevel || "SMP_SMA",
        evaluators: evaluators && Array.isArray(evaluators) ? evaluators.join(',') : "", 
        evaluatees: evaluatees && Array.isArray(evaluatees) ? evaluatees.join(',') : "",
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
    const { id, title, description, evaluators, evaluatees, isSelfReflection, schoolLevel } = await req.json();

    // Assigning a rubric (who evaluates whom) is open to the principal; changing the rubric itself is not.
    const editsContent = title !== undefined || description !== undefined || isSelfReflection !== undefined || schoolLevel !== undefined;
    const denied = await denyUnlessRole(editsContent ? RUBRIC_EDITOR_ROLES : RUBRIC_ASSIGNER_ROLES);
    if (denied) return denied;
    if ((evaluators !== undefined && !Array.isArray(evaluators)) || (evaluatees !== undefined && !Array.isArray(evaluatees))) {
      return NextResponse.json({ error: "evaluators and evaluatees must be arrays" }, { status: 400 });
    }
    
    if (schoolLevel !== undefined && !SCHOOL_LEVELS.includes(schoolLevel)) {
      return NextResponse.json({ error: "School level must be SD or SMP_SMA." }, { status: 400 });
    }

    // A principal can only assign rubrics that belong to their own school level
    if (!editsContent) {
      const session = (await getSession())!;
      if (session.role === 'PRINCIPAL') {
        const target = await prisma.rubric.findUnique({ where: { id }, select: { schoolLevel: true } });
        const myLevel = isSdGroupLevel(session.level) ? 'SD' : 'SMP_SMA';
        if (!target || target.schoolLevel !== myLevel) {
          return NextResponse.json({ error: "You can only assign rubrics for your own school level." }, { status: 403 });
        }
      }
    }

    const updateData: any = { updatedAt: new Date() };
    if (schoolLevel !== undefined) updateData.schoolLevel = schoolLevel;
    if (title !== undefined) updateData.title = title;
    if (description !== undefined) updateData.description = description;
    
    // 🚀 SAVES THE CHECKBOX WHEN EDITING
    if (isSelfReflection !== undefined) updateData.isSelfReflection = isSelfReflection;
    
    // Convert arrays back to comma-separated strings for Database
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
  const denied = await denyUnlessRole(RUBRIC_EDITOR_ROLES);
  if (denied) return denied;
  try {
    // 🚀 FIXED: Reads the ID from the URL (e.g. ?id=123) instead of crashing on req.json()
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: "Rubric ID is required" }, { status: 400 });
    }

    await prisma.rubric.delete({
      where: { id },
    });
    return NextResponse.json({ message: "Deleted successfully" });
  } catch (error) {
    console.error("❌ DELETE RUBRIC ERROR:", error);
    return NextResponse.json({ error: "Failed to delete rubric" }, { status: 500 });
  }
}