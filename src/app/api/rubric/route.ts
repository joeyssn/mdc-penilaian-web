import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isSdGroupLevel } from "@/lib/weights";
import { normLevel } from "@/lib/levelScopeCore";
import { denyUnlessRole, getSession, RUBRIC_ASSIGNER_ROLES, RUBRIC_EDITOR_ROLES, SCHOOL_ASSIGNER_ROLES } from "@/lib/session";

export const dynamic = 'force-dynamic'; 

const SCHOOL_LEVELS = ['SD', 'SMP_SMA'];
// Older rubrics were tagged with the combined "Director/Principal"; they now count as both separate roles.
const splitRoles = (v?: string | null) => (v ? v.split(',').flatMap(r => (r.trim() === 'Director/Principal' ? ['Director', 'Principal'] : [r])) : []);

// 1. READ ALL RUBRICS
export async function GET(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  try {
    // SD people only see SD rubrics; everyone else sees SMP / SMA rubrics. Admin and director see all.
    const seesAll = session.role === 'ADMIN' || session.role === 'DIRECTOR';
    const rubricLevel = isSdGroupLevel(session.level) ? 'SD' : 'SMP_SMA';
    // Roles that see every school (admin, director) can ask for one school's rubrics: /api/rubric?school=SD
    const wanted = new URL(req.url).searchParams.get('school');
    const schoolFilter = seesAll
      ? (wanted && SCHOOL_LEVELS.includes(wanted) ? { schoolLevel: wanted } : {})
      : { schoolLevel: rubricLevel };

    const rubrics = await prisma.rubric.findMany({
      where: schoolFilter,
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

    // A TK / SD / SMP / SMA viewer sees their own school's assignment when one was saved.
    const myLevel = normLevel(session.level);
    // If the RubricLevelAssignment table is not created yet (prisma db push not run), fall back to the shared assignment.
    const overrides = myLevel
      ? await prisma.rubricLevelAssignment.findMany({ where: { level: myLevel, rubricId: { in: rubrics.map(r => r.id) } } }).catch(() => [])
      : [];
    const overrideOf = new Map(overrides.map(o => [o.rubricId, o]));

    const formattedRubrics = rubrics.map((base) => {
      const o = overrideOf.get(base.id);
      const rubric = o ? { ...base, evaluators: o.evaluators, evaluatees: o.evaluatees } : base;
      return {
      ...rubric,
      // 🚀 The spread operator automatically includes isSelfReflection
      evaluators: splitRoles(rubric.evaluators),
      evaluatees: splitRoles(rubric.evaluatees),
      sections: rubric.rubricsection.map((section) => ({
        ...section,
        categories: section.rubriccategory.map((category) => ({
          ...category,
          indicators: category.rubricindicator
        }))
      })),
      levelSpecific: !!o,
      };
    });

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
      if (SCHOOL_ASSIGNER_ROLES.includes(session.role)) {
        const target = await prisma.rubric.findUnique({ where: { id }, select: { schoolLevel: true } });
        const myLevel = isSdGroupLevel(session.level) ? 'SD' : 'SMP_SMA';
        if (!target || target.schoolLevel !== myLevel) {
          return NextResponse.json({ error: "You can only assign rubrics for your own school level." }, { status: 403 });
        }
      }
    }

    // A principal's assignment is saved for their own school only (TK / SD / SMP / SMA are independent).
    if (!editsContent) {
      const session = (await getSession())!;
      const lvl = normLevel(session.level);
      if (SCHOOL_ASSIGNER_ROLES.includes(session.role)) {
        if (!lvl) return NextResponse.json({ error: "Your account has no school level (TK/SD/SMP/SMA)." }, { status: 403 });
        const data = {
          ...(evaluators !== undefined ? { evaluators: evaluators.join(',') } : {}),
          ...(evaluatees !== undefined ? { evaluatees: evaluatees.join(',') } : {}),
        };
        const row = await prisma.rubricLevelAssignment.upsert({
          where: { rubricId_level: { rubricId: id, level: lvl } },
          update: data,
          create: { rubricId: id, level: lvl, evaluators: evaluators !== undefined ? evaluators.join(',') : null, evaluatees: evaluatees !== undefined ? evaluatees.join(',') : null },
        });
        return NextResponse.json(row);
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