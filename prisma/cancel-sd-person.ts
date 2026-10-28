// Cancel everything the SD evaluation system holds for one person (e.g. an account that was picked by accident).
//   npx tsx prisma/cancel-sd-person.ts "Adam Smith"                 -> only SHOWS what would be removed
//   npx tsx prisma/cancel-sd-person.ts "Adam Smith" --apply         -> removes their assignments
//   npx tsx prisma/cancel-sd-person.ts "Adam Smith" --apply --hide  -> also clears their school level, so they no longer appear in SD screens
//   add --evaluations to also delete SD evaluations they gave or received (history is kept unless you ask)
// The user account itself is never deleted.
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const [name] = process.argv.slice(2).filter(a => !a.startsWith('--'));
const flag = (f: string) => process.argv.includes(f);

async function main() {
  if (!name) throw new Error('Give a name, e.g. npx tsx prisma/cancel-sd-person.ts "Adam Smith"');
  const people = await prisma.user.findMany({ where: { name: { contains: name } }, select: { id: true, name: true, role: true, level: true } });
  if (people.length === 0) return console.log(`No user matches "${name}".`);
  console.table(people);
  const ids = people.map(p => p.id);

  const [ta, sa, ev] = await Promise.all([
    prisma.teacherAssignment.count({ where: { OR: [{ teacherId: { in: ids } }, { evaluatorId: { in: ids } }] } }),
    prisma.studentAssignment.count({ where: { OR: [{ teacherId: { in: ids } }, { studentId: { in: ids } }] } }),
    prisma.sdEvaluation.count({ where: { OR: [{ targetId: { in: ids } }, { evaluatorId: { in: ids } }] } }),
  ]);
  console.log(`Evaluator assignments: ${ta}\nStudent assignments: ${sa}\nSD evaluations: ${ev}${flag('--evaluations') ? '' : ' (kept unless --evaluations)'}`);
  if (!flag('--apply')) return console.log('\nNothing changed. Add --apply to remove the assignments.');

  await prisma.$transaction(async tx => {
    const mine = { OR: [{ targetId: { in: ids } }, { evaluatorId: { in: ids } }] };
    if (flag('--evaluations')) await tx.sdEvaluation.deleteMany({ where: mine });
    // assignments that already have an evaluation are kept as history (deactivated) so the evaluation keeps its link
    const withEval = await tx.sdEvaluation.findMany({ where: { assignmentId: { not: null }, ...mine }, select: { assignmentId: true } });
    const keep = withEval.map(e => e.assignmentId!).filter(Boolean);
    await tx.teacherAssignment.updateMany({ where: { id: { in: keep } }, data: { active: false } });
    await tx.teacherAssignment.deleteMany({ where: { id: { notIn: keep }, OR: [{ teacherId: { in: ids } }, { evaluatorId: { in: ids } }] } });
    const kept = await tx.sdEvaluation.findMany({ where: { studentAssignmentId: { not: null }, ...mine }, select: { studentAssignmentId: true } });
    await tx.studentAssignment.deleteMany({ where: { id: { notIn: kept.map(k => k.studentAssignmentId!) }, OR: [{ teacherId: { in: ids } }, { studentId: { in: ids } }] } });
    if (flag('--hide')) await tx.user.updateMany({ where: { id: { in: ids } }, data: { level: null } });
  });
  console.log('\nDone.' + (flag('--hide') ? ' Their school level was cleared.' : ''));
}
main().catch(e => { console.error(e.message ?? e); process.exit(1); }).finally(() => prisma.$disconnect());
