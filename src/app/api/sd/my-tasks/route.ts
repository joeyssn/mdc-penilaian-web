import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { fail, openPeriod, publishedMembers } from '@/lib/sd/access';
import { getSession } from '@/lib/session';
import { categoryOf, peerTargets, SUBJECT_LABEL, type MemberLite } from '@/lib/sd/rules';

export const dynamic = 'force-dynamic';

// Everything the logged-in user may evaluate right now, split by source. Each person sees only their own tasks.
export async function GET() {
  const session = await getSession();
  if (!session) return fail('Not authenticated', 401);
  const period = await openPeriod();
  const empty = { period: null as any, group: null as any, groups: [] as any[], membership: [] as any[], peer: { targets: [] as any[], submitted: [] as any[] }, supervisor: { pending: [] as any[], submitted: [] as any[] }, student: { pending: [] as any[], submitted: [] as any[] }, mySupervisors: [] as string[] };
  if (!period) return NextResponse.json(empty);

  const out = { ...empty, period: { id: period.id, name: period.name } };
  const done = await prisma.sdEvaluation.findMany({ where: { periodId: period.id, evaluatorId: session.id }, select: { type: true, targetId: true, submittedAt: true } });
  const doneSet = (t: string) => new Set(done.filter(d => d.type === t).map(d => d.targetId));

  // Peer: a teacher may belong to several published groups; targets are collected from all of them.
  if (session.role === 'TEACHER') {
    const all = await publishedMembers(period.id);
    const submittedIds = doneSet('PEER');
    const groupIds = [...new Set(all.filter(m => m.teacherId === session.id).map(m => m.groupId))];
    const groups: any[] = [], membership: any[] = [];
    const targets = new Map<string, any>(), submitted = new Map<string, any>();
    for (const gid of groupIds) {
      const gm = all.filter(m => m.groupId === gid);
      const g0 = gm[0].group;
      const nameOf = new Map(gm.map(m => [m.teacherId, m.teacher.name]));
      groups.push({ id: g0.id, name: g0.name, classOne: g0.classOne, classTwo: g0.classTwo });
      for (const m of gm.filter(x => x.teacherId === session.id)) {
        membership.push({ group: g0.name, className: m.className, subject: SUBJECT_LABEL[m.subject], category: categoryOf(m.subject), partner: gm.find(x => x.id === m.partnerId)?.teacher.name ?? null });
      }
      for (const t of peerTargets(session.id, gm as unknown as MemberLite[])) {
        const row = { teacherId: t.teacherId, name: nameOf.get(t.teacherId), className: t.className, subject: SUBJECT_LABEL[t.subject as keyof typeof SUBJECT_LABEL], category: t.category, isPartner: t.isPartner, group: g0.name };
        const bucket = submittedIds.has(t.teacherId) ? submitted : targets;
        const prev = bucket.get(t.teacherId);
        if (!prev || (row.isPartner && !prev.isPartner)) bucket.set(t.teacherId, row);
      }
    }
    out.group = groups[0] ?? null;      // kept for older callers
    out.groups = groups;
    out.membership = membership;
    out.peer.targets = [...targets.values()];
    out.peer.submitted = [...submitted.values()];
    const sups = await prisma.supervisorAssignment.findMany({ where: { periodId: period.id, teacherId: session.id, active: true }, include: { supervisor: { select: { name: true } } } });
    out.mySupervisors = sups.map(s => s.supervisor.name);
  }

  // Supervisor: anyone holding an active supervisor assignment
  const sa = await prisma.supervisorAssignment.findMany({ where: { periodId: period.id, supervisorId: session.id, active: true }, include: { teacher: { select: { id: true, name: true } } } });
  const sDone = doneSet('SUPERVISOR');
  out.supervisor.pending = sa.filter(a => !sDone.has(a.teacherId)).map(a => ({ teacherId: a.teacher.id, name: a.teacher.name }));
  out.supervisor.submitted = sa.filter(a => sDone.has(a.teacherId)).map(a => ({ teacherId: a.teacher.id, name: a.teacher.name }));

  // Student: only teachers the Vice Principal assigned to this student
  if (session.role === 'STUDENT') {
    const st = await prisma.studentAssignment.findMany({ where: { periodId: period.id, studentId: session.id }, include: { teacher: { select: { id: true, name: true } } } });
    const tDone = doneSet('STUDENT');
    out.student.pending = st.filter(a => !tDone.has(a.teacherId)).map(a => ({ teacherId: a.teacher.id, name: a.teacher.name }));
    out.student.submitted = st.filter(a => tDone.has(a.teacherId)).map(a => ({ teacherId: a.teacher.id, name: a.teacher.name }));
  }
  return NextResponse.json(out);
}
