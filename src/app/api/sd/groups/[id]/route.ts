import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { writeAudit } from '@/lib/audit';
import { validateClasses, validateGroupForPublish, validateMember, validatePartnership, type MemberLite, type Subject } from '@/lib/sd/rules';
import { normLevel, scopeOf } from '@/lib/levelScope';
import { can, fail, isSdUser, requireRole, GROUP_MANAGE_ROLES } from '@/lib/sd/access';

type Ctx = { params: Promise<{ id: string }> };
const lite = (m: any): MemberLite => ({ id: m.id, groupId: m.groupId, teacherId: m.teacherId, className: m.className, subject: m.subject, partnerId: m.partnerId });

// All edits go through one endpoint: PATCH { action, ... }. Draft groups are freely editable;
// a published group must be unpublished first (explicit, audited), so live eligibility never changes silently.
export async function PATCH(req: Request, ctx: Ctx) {
  const guard = await requireRole(GROUP_MANAGE_ROLES); if (guard.error) return guard.error;
  const session = guard.session;
  const { id } = await ctx.params;
  const body = await req.json();
  const action: string = body.action;

  const group = await prisma.teacherGroup.findUnique({ where: { id }, include: { members: true, period: true } });
  const scope = scopeOf(session);
  if (!group || (scope && group.level && normLevel(group.level) !== scope)) return fail('Group not found.', 404);
  if (group.period.status === 'CLOSED') return fail('This period is closed. Its groups are read-only.', 409);

  const sensitive = ['publish', 'unpublish', 'deactivate'].includes(action);
  if (sensitive && !(await can(session, 'publish'))) return fail('Only the Principal (or an Admin SD with the publish permission) can do this.', 403);
  if (!sensitive && group.status === 'PUBLISHED') return fail('Unpublish the group before changing it.', 409);

  switch (action) {
    case 'update': {
      const classOne = body.classOne ?? group.classOne, classTwo = body.classTwo ?? group.classTwo;
      const errs = validateClasses(classOne, classTwo);
      if (errs.length) return fail(errs);
      const orphan = group.members.filter(m => ![classOne, classTwo].some(c => c.trim().toUpperCase() === m.className.trim().toUpperCase()));
      if (orphan.length) return fail('Remove the teachers of the dropped class first.');
      const u = await prisma.teacherGroup.update({ where: { id }, data: { name: body.name?.trim() || group.name, classOne: classOne.trim(), classTwo: classTwo.trim() } });
      await writeAudit(session, 'SD_GROUP_UPDATED', 'TeacherGroup', id, { classOne, classTwo });
      return NextResponse.json(u);
    }
    case 'addMember': {
      const { teacherId, className, subject } = body;
      const errs = validateMember(group, className ?? '', subject ?? '');
      if (errs.length) return fail(errs);
      const teacher = await prisma.user.findUnique({ where: { id: teacherId } });
      if (!teacher || teacher.role !== 'TEACHER' || !isSdUser(teacher)) return fail('Only SD / TK teacher accounts can join a group.');
      if (group.level && normLevel(teacher.level) !== normLevel(group.level)) return fail(`${teacher.name} belongs to ${teacher.level}, not ${group.level}.`);
      try {
        const m = await prisma.groupMember.create({ data: { groupId: id, teacherId, className: className.trim(), subject: subject as Subject } });
        await writeAudit(session, 'SD_MEMBER_ADDED', 'TeacherGroup', id, { teacherId, className, subject });
        return NextResponse.json(m);
      } catch { return fail('That class already has a teacher for this subject in the group.', 409); }
    }
    case 'removeMember': {
      const m = group.members.find(x => x.id === body.memberId);
      if (!m) return fail('Member not found.', 404);
      await prisma.groupMember.delete({ where: { id: m.id } }); // partner link is set to null by the database
      await writeAudit(session, 'SD_MEMBER_REMOVED', 'TeacherGroup', id, { teacherId: m.teacherId, className: m.className, subject: m.subject });
      return NextResponse.json({ ok: true });
    }
    case 'setPartner': {
      const a = group.members.find(x => x.id === body.memberId), b = group.members.find(x => x.id === body.partnerMemberId);
      if (!a || !b) return fail('Both partners must be members of this group.');
      const errs = validatePartnership(lite(a), lite(b));
      if (errs.length) return fail(errs);
      await prisma.$transaction(async tx => {
        // Free any previous partner of either side so partnerships stay one-to-one.
        await tx.groupMember.updateMany({ where: { id: { in: [a.partnerId, b.partnerId].filter(Boolean) as string[] } }, data: { partnerId: null } });
        await tx.groupMember.update({ where: { id: a.id }, data: { partnerId: null } });
        await tx.groupMember.update({ where: { id: b.id }, data: { partnerId: null } });
        await tx.groupMember.update({ where: { id: a.id }, data: { partnerId: b.id } });
        await tx.groupMember.update({ where: { id: b.id }, data: { partnerId: a.id } });
      });
      await writeAudit(session, 'SD_PARTNER_SET', 'TeacherGroup', id, { a: a.id, b: b.id });
      return NextResponse.json({ ok: true });
    }
    case 'clearPartner': {
      const a = group.members.find(x => x.id === body.memberId);
      if (!a) return fail('Member not found.', 404);
      await prisma.groupMember.updateMany({ where: { id: { in: [a.id, a.partnerId].filter(Boolean) as string[] } }, data: { partnerId: null } });
      await writeAudit(session, 'SD_PARTNER_CLEARED', 'TeacherGroup', id, { memberId: a.id });
      return NextResponse.json({ ok: true });
    }
    case 'validate':
      return NextResponse.json({ errors: validateGroupForPublish(group, group.members.map(lite)) });
    case 'publish': {
      if (group.status === 'PUBLISHED') return fail('Already published.');
      const errs = validateGroupForPublish(group, group.members.map(lite));
      // A class belongs to one live group per period.
      const clash = await prisma.teacherGroup.findFirst({
        where: { periodId: group.periodId, id: { not: id }, status: 'PUBLISHED', OR: [{ classOne: { in: [group.classOne, group.classTwo] } }, { classTwo: { in: [group.classOne, group.classTwo] } }] },
      });
      if (clash) errs.push(`A class of this group is already used by published group "${clash.name}".`);
      if (errs.length) return fail(errs, 422);
      await prisma.teacherGroup.update({ where: { id }, data: { status: 'PUBLISHED' } });
      await writeAudit(session, 'SD_GROUP_PUBLISHED', 'TeacherGroup', id, { members: group.members.length });
      return NextResponse.json({ ok: true });
    }
    case 'unpublish':
    case 'deactivate': {
      await prisma.teacherGroup.update({ where: { id }, data: { status: action === 'unpublish' ? 'DRAFT' : 'INACTIVE' } });
      await writeAudit(session, action === 'unpublish' ? 'SD_GROUP_UNPUBLISHED' : 'SD_GROUP_DEACTIVATED', 'TeacherGroup', id);
      return NextResponse.json({ ok: true });
    }
    default:
      return fail('Unknown action.');
  }
}

export async function DELETE(_: Request, ctx: Ctx) {
  const guard = await requireRole(GROUP_MANAGE_ROLES); if (guard.error) return guard.error;
  const { id } = await ctx.params;
  const g = await prisma.teacherGroup.findUnique({ where: { id }, include: { _count: { select: { evaluations: true } } } });
  const sc = scopeOf(guard.session);
  if (!g || (sc && g.level && normLevel(g.level) !== sc)) return fail('Group not found.', 404);
  if (g.status !== 'DRAFT') return fail('Only draft groups can be deleted. Deactivate a published group instead.', 409);
  if (g._count.evaluations > 0) return fail('This group already has evaluations and cannot be deleted.', 409);
  await prisma.teacherGroup.delete({ where: { id } });
  await writeAudit(guard.session, 'SD_GROUP_DELETED', 'TeacherGroup', id, { name: g.name });
  return NextResponse.json({ ok: true });
}
