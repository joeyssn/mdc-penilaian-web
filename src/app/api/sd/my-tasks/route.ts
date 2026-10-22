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
  const empty = { period: null as any, group: null as any, membership: [] as any[], peer: { targets: [] as any[], submitted: [] as any[] }, supervisor: { pending: [] as any[], submitted: [] as any[] }, student: { pending: [] as any[], submitted: [] as any[] }, mySupervisors: [] as string[] };
  if (!period) return NextResponse.json(empty);

  const out = { ...empty, period: { id: period.id, name: period.name } };
  const done = await prisma.sdEvaluation.findMany({ where: { periodId: period.id, evaluatorId: session.id }, select: { type: true, targetId: true, submittedAt: true } });
  const doneSet = (t: string) => new Set(done.filter(d => d.type === t).map(d => d.targetId));

  // Peer: only teachers who belong to a published group
  if (session.role === 'TEACHER') {
    const all = await publishedMembers(period.id);
    const mine = all.find(m => m.teacherId === session.id);
    if (mine) {
      const groupMembers = all.filter(m => m.groupId === mine.groupId);
      const nameOf = new Map(groupMembers.map(m => [m.teacherId, m.teacher.name]));
      const targets = peerTargets(session.id, groupMembers as unknown as MemberLite[]);
      const submittedIds = doneSet('PEER');
      out.group = { id: mine.group.id, name: mine.group.name, classOne: mine.group.classOne, classTwo: mine.group.classTwo };
      out.membership = groupMembers.filter(m => m.teacherId === session.id).map(m => ({
        className: m.className, subject: SUBJECT_LABEL[m.subject], category: categoryOf(m.subject),
        partner: groupMembers.find(x => x.id === m.partnerId)?.teacher.name ?? null,
      }));
      const row = (t: any) => ({ teacherId: t.teacherId, name: nameOf.get(t.teacherId), className: t.className, subject: SUBJECT_LABEL[t.subject as keyof typeof SUBJECT_LABEL], category: t.category, isPartner: t.isPartner });
      out.peer.targets = targets.filter(t => !submittedIds.has(t.teacherId)).map(row);
      // Submitted ones are not "eligible" any more, but the teacher still sees that they are done.
      out.peer.submitted = peerTargets(session.id, groupMembers as unknown as MemberLite[], new Set()).filter(t => submittedIds.has(t.teacherId)).map(row);
    }
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
