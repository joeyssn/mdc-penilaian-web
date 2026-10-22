import { computeFinal, isSdGroupLevel, resolveProfile } from '@/lib/weights';

// One row of the master report, already scored. NaN = no score yet.
export type MasterRow = {
  id: string;
  name: string;
  role: string;
  group: 'SD' | 'SMP'; // SD = SD + TK, SMP = SMP + SMA (and anyone without a school level)
  student: number;
  peer: number;
  self: number;
  supervisor: number;
  leader: number;      // SD / TK: leaders score. Taken from the principal / vice principal observation
  observation: number; // SMP / SMA observation
  attendance: number;  // HRD
  main: number | null; // SD / TK main evaluation
  final: number | null;
  incomplete: boolean;
  missing: string[];
};

type ReportInput = {
  id: string; name: string; role: string; roleKey?: string; level?: string | null;
  studentAvg: string; peerAvg: string; selfAvg: string; supervisorAvg?: string;
};

type WeightsById = Record<string, any>;

export function buildMasterRows(
  report: ReportInput[],
  weights: WeightsById,
  observations: { targetId: string; averageScore: number }[],
  absences: { userId: string; attendanceScore: number }[]
): MasterRow[] {
  const profiles = Object.entries(weights).map(([id, w]) => ({ id, ...w }));
  const fallback = { studentWeight: 20, peerWeight: 20, selfWeight: 20, observationWeight: 20, attendanceWeight: 20 };

  return report
    .filter(r => r.role.toUpperCase() !== 'STUDENT' && r.role.toUpperCase() !== 'ADMIN')
    .map(r => {
      const student = parseFloat(r.studentAvg);
      const peer = parseFloat(r.peerAvg);
      const self = parseFloat(r.selfAvg);
      const supervisor = parseFloat(r.supervisorAvg ?? '-'); // NaN until a supervisor has scored
      const obs = observations.find(o => o.targetId === r.id);
      const observation = obs ? obs.averageScore : NaN;
      const abs = absences.find(a => a.userId === r.id);
      const attendance = abs ? abs.attendanceScore : NaN;

      const matched = resolveProfile(profiles, r.roleKey || r.role, r.level);
      const result = computeFinal(
        matched ? matched.id : 'DEFAULT',
        matched ? { selfWeight: 0, ...matched } : fallback,
        { student, peer, self, observation, attendance, leader: observation, supervisor }
      );

      return {
        id: r.id, name: r.name, role: r.role,
        group: isSdGroupLevel(r.level) ? 'SD' : 'SMP',
        student, peer, self, supervisor, leader: observation, observation, attendance,
        main: result.main, final: result.final, incomplete: result.incomplete, missing: result.missing,
      } as MasterRow;
    })
    .sort((a, b) => a.name.localeCompare(b.name));
}
