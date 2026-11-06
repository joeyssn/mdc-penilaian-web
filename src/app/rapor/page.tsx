'use client';
import { Fragment, Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import RoleNav from '@/components/RoleNav';
import { buildMasterRows } from '@/lib/masterReport';
import { profileIdFor, resolveProfile, SD_DEFAULT_WEIGHTS, SMP_DEFAULT_WEIGHTS, TK_DEFAULT_WEIGHTS } from '@/lib/weights';

// Teacher / staff report card ("Rapor"), modelled on Format_Rapor_Guru_SMP.xlsx:
// Student rating + main rating (grouped by competency) + attendance (+ observation when it has a weight) -> Indeks -> Kategori.
const SCHOOL: Record<string, string> = {
  TK: 'Christian Kindergarten', SD: 'Christian Elementary School', SMP: 'Christian Junior High School', SMA: 'Christian Senior High School',
};
const HEAD: Record<string, string> = { TK: 'Kepala TK Kr. MDC', SD: 'Kepala SD Kr. MDC', SMP: 'Kepala SMP Kr. MDC', SMA: 'Kepala SMA Kr. MDC' };
const ROLE: Record<string, string> = {
  TEACHER: 'Guru', STAFF: 'Staff', HRD: 'HRD', KARYAWAN: 'Karyawan', PRINCIPAL: 'Kepala Sekolah',
  VICE_PRINCIPAL_KURIKULUM: 'Wakil Kepala Sekolah Kurikulum', VICE_PRINCIPAL_KESISWAAN: 'Wakil Kepala Sekolah Kesiswaan',
  IT: 'IT', PR: 'PR', ACC: 'Accounting', DIRECTOR: 'Direktur',
};
const kategori = (v: number) => v < 2.5 ? 'D' : v < 2.75 ? 'C' : v < 3 ? 'C+' : v < 3.25 ? 'B' : v < 3.5 ? 'B+' : 'A';
const f = (n: number | null | undefined) => (n == null || isNaN(n as number)) ? '-' : (n as number).toFixed(2);
const TYPE_W: Record<string, string> = { PEER: 'peerWeight', SELF: 'selfWeight', SUPERVISOR: 'supervisorWeight', KOORDINATOR: 'leaderWeight' };

function Rapor() {
  const id = useSearchParams().get('id') || '';
  const [d, setD] = useState<any>(null);
  const [err, setErr] = useState('');

  useEffect(() => {
    if (!id) { setErr('No person selected.'); return; }
    (async () => {
      try {
        const [a, rep, w, abs, obs] = await Promise.all([
          fetch(`/api/director/rapor?userId=${id}`), fetch('/api/director/report'), fetch('/api/settings/weights'), fetch('/api/absences'), fetch('/api/observasi'),
        ]);
        if (!a.ok) return setErr((await a.json().catch(() => null))?.error || 'Could not load the report.');
        const base = await a.json();
        const rows = await rep.json(), weights = await w.json(), absences = await abs.json(), observations = await obs.json();
        const row = (Array.isArray(rows) ? rows : []).find((r: any) => r.id === id);
        const cfg: any = {}; (Array.isArray(weights) ? weights : []).forEach((x: any) => { cfg[x.id] = x; });
        const approved = (Array.isArray(observations) ? observations : []).filter((o: any) => o.isApproved && o.targetId === id);
        const grouped = approved.length ? [{ targetId: id, averageScore: approved.reduce((s: number, o: any) => s + o.finalScore, 0) / approved.length }] : [];
        // Use the saved weight profile; when none is saved for this school yet, use that school's default so the student share is never dropped.
        const lvl = String(base.user.level || '').toUpperCase();
        let prof: any = resolveProfile(Object.values(cfg) as any, row?.roleKey || base.user.role, base.user.level);
        if (!prof) {
          prof = { id: profileIdFor(row?.roleKey || base.user.role, base.user.level), ...(lvl === 'TK' ? TK_DEFAULT_WEIGHTS : lvl === 'SD' ? SD_DEFAULT_WEIGHTS : SMP_DEFAULT_WEIGHTS) };
          cfg[prof.id] = prof;
        }
        const master = row ? buildMasterRows([row], cfg, grouped, Array.isArray(absences) ? absences : [])[0] : null;
        setD({ ...base, master, w: prof, row });
      } catch { setErr('Could not load the report.'); }
    })();
  }, [id]);

  if (err) return <div className="p-10 font-bold text-red-600">{err}</div>;
  if (!d) return <div className="p-10">Loading…</div>;

  const w = d.w, m = d.master;
  const level = String(d.user.level || '').toUpperCase();
  const num = (x: any) => Number(x) || 0;
  const hasStudent = num(w.studentWeight) > 0;
  const hasObs = num(w.observationWeight) > 0;
  const mainPct = num(w.mainWeight) > 0 ? num(w.mainWeight) : Math.max(0, 100 - num(w.studentWeight) - num(w.attendanceWeight) - num(w.observationWeight));

  // value of one question: each evaluator type's average, weighted by the profile (types without an answer are left out)
  const itemValue = (byType: Record<string, number>) => {
    let s = 0, t = 0;
    for (const [type, v] of Object.entries(byType)) { const wt = type in TYPE_W ? num(w[TYPE_W[type]]) || 1 : 1; s += v * wt; t += wt; }
    return t ? s / t : NaN;
  };
  const items = (d.items as any[]).map(i => ({ ...i, value: itemValue(i.byType) }));
  const groups: { name: string; rows: typeof items }[] = [];
  for (const it of items) { const g = groups.find(x => x.name === it.group) ?? (groups.push({ name: it.group, rows: [] }), groups[groups.length - 1]); g.rows.push(it); }
  const valid = items.filter(i => !isNaN(i.value));
  const mainAvg = valid.length ? valid.reduce((s, i) => s + i.value, 0) / valid.length : (m?.main ?? NaN);

  const student = m ? m.student : NaN, attendance = m ? m.attendance : NaN, observation = m ? m.observation : NaN;
  const lines: { no: number; label: string; avg: number; pct: number }[] = [];
  if (hasStudent) lines.push({ no: 0, label: 'Penilaian Siswa', avg: student, pct: num(w.studentWeight) });
  lines.push({ no: 0, label: 'Penilaian Kepala Sekolah, Supervisor, Rekan Kerja, dan Diri Sendiri', avg: mainAvg, pct: mainPct });
  lines.push({ no: 0, label: 'Disiplin Kehadiran', avg: attendance, pct: num(w.attendanceWeight) });
  if (hasObs) lines.push({ no: 0, label: 'Observasi Kelas (disetujui Kepala Sekolah)', avg: observation, pct: num(w.observationWeight) });
  lines.forEach((l, i) => (l.no = i + 1));
  const nk = (l: { avg: number; pct: number }) => isNaN(l.avg) ? NaN : l.avg * l.pct / 100;
  const complete = lines.every(l => !isNaN(l.avg));
  const index = complete ? lines.reduce((s, l) => s + nk(l), 0) : (m?.final ?? NaN);
  const missing = lines.filter(l => isNaN(l.avg)).map(l => l.label);
  const today = new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
  const mainNo = hasStudent ? 2 : 1;
  const span = items.length + groups.length + 1 + (groups.length === 0 ? 1 : 0);

  return (
    <div className="min-h-screen bg-gray-100 print:bg-white">
      <style>{`@media print{.noprint{display:none!important}html,body{display:block!important;height:auto!important;overflow:visible!important;background:#fff!important}.sheet{box-shadow:none!important;margin:0!important;max-width:none!important}tr{break-inside:avoid;page-break-inside:avoid}}`}</style>
      <div className="noprint"><RoleNav /></div>
      <div className="noprint max-w-4xl mx-auto px-6 pt-6 flex justify-end">
        <button onClick={() => window.print()} className="bg-[#008c99] hover:bg-[#007b87] text-white px-5 py-2.5 rounded-lg font-bold shadow">Print / Save PDF</button>
      </div>
      <div className="sheet max-w-4xl mx-auto my-6 bg-white shadow p-10 text-black text-[13px] font-serif">
        <div className="flex justify-between border-b-2 border-black pb-2">
          <div><div className="text-xl font-bold">Masa Depan Cerah</div><div>{SCHOOL[level] || 'Christian School'}</div></div>
          <div className="text-right"><div className="font-bold tracking-widest">CONFIDENTIAL</div><div>Tahun Pelajaran {d.period || '-'}</div></div>
        </div>
        <h1 className="text-center text-lg font-bold underline my-5">PENILAIAN KINERJA {d.user.role === 'TEACHER' ? 'GURU' : 'KARYAWAN'}</h1>
        <table className="mb-4"><tbody>
          <tr><td className="pr-6">Nama</td><td className="pr-2">:</td><td className="font-bold">{d.user.name}</td></tr>
          <tr><td className="pr-6">Jabatan</td><td className="pr-2">:</td><td>{ROLE[d.user.role] || d.user.role}{level ? ` ${level}` : ''}</td></tr>
        </tbody></table>

        <table className="w-full border-collapse border border-black">
          <thead><tr className="bg-gray-200 text-center">
            <th className="border border-black p-1 w-10">No</th><th className="border border-black p-1">Aspek Penilaian</th>
            <th className="border border-black p-1 w-16">Nilai</th><th className="border border-black p-1 w-16">Rata2</th><th className="border border-black p-1 w-20">Persentase</th><th className="border border-black p-1 w-16">NK</th>
          </tr></thead>
          <tbody>
            {hasStudent && (() => { const l = lines[0]; return (
              <tr><td className="border border-black p-1 text-center">{l.no}</td><td className="border border-black p-1 font-bold">{l.label}</td>
                <td className="border border-black p-1 text-center">{f(l.avg)}</td><td className="border border-black p-1 text-center">{f(l.avg)}</td>
                <td className="border border-black p-1 text-center">{l.pct}%</td><td className="border border-black p-1 text-center">{f(nk(l))}</td></tr>); })()}

            <tr><td className="border border-black p-1 text-center align-top" rowSpan={span}>{mainNo}</td>
              <td className="border border-black p-1 font-bold" colSpan={2}>Penilaian Kepala Sekolah, Supervisor, Rekan Kerja, dan Diri Sendiri</td>
              <td className="border border-black p-1 text-center align-middle" rowSpan={span}>{f(mainAvg)}</td>
              <td className="border border-black p-1 text-center align-middle" rowSpan={span}>{mainPct}%</td>
              <td className="border border-black p-1 text-center align-middle" rowSpan={span}>{f(nk({ avg: mainAvg, pct: mainPct }))}</td></tr>
            {groups.length === 0 && <tr><td className="border border-black p-1 italic text-gray-500" colSpan={2}>Belum ada penilaian.</td></tr>}
            {groups.map(g => (
              <Fragment key={g.name}>
                <tr><td className="border border-black p-1 font-bold bg-gray-100" colSpan={2}>{g.name}</td></tr>
                {g.rows.map((r, i) => (
                  <tr key={g.name + i}><td className="border border-black p-1 pl-4">{r.text}</td><td className="border border-black p-1 text-center">{f(r.value)}</td></tr>
                ))}
              </Fragment>
            ))}

            {lines.slice(hasStudent ? 2 : 1).map(l => (
              <tr key={l.label}><td className="border border-black p-1 text-center">{l.no}</td><td className="border border-black p-1 font-bold">{l.label}</td>
                <td className="border border-black p-1 text-center">{f(l.avg)}</td><td className="border border-black p-1 text-center">{f(l.avg)}</td>
                <td className="border border-black p-1 text-center">{l.pct}%</td><td className="border border-black p-1 text-center">{f(nk(l))}</td></tr>
            ))}
          </tbody>
        </table>

        <div className="flex justify-between mt-6">
          <div className="pt-16 whitespace-pre-line">{`Surabaya, ${today}\n\n\n\n${d.principal || '______________________'}\n${HEAD[level] || 'Kepala Sekolah'}`}</div>
          <table className="border-collapse self-start h-fit"><tbody>
            <tr><td className="border border-black px-3 py-1 font-bold">Indeks</td><td className="border border-black px-3 py-1 text-center w-24 font-bold">{f(index)}</td></tr>
            <tr><td className="border border-black px-3 py-1 font-bold">Prestasi</td><td className="border border-black px-3 py-1 text-center">&nbsp;</td></tr>
            <tr><td className="border border-black px-3 py-1 font-bold">Kategori</td><td className="border border-black px-3 py-1 text-center font-bold text-lg">{isNaN(index) ? '-' : kategori(index)}</td></tr>
          </tbody></table>
        </div>
        {missing.length > 0 && <p className="noprint mt-4 text-red-600 text-xs">Belum lengkap: {missing.join(', ')}. Indeks dihitung setelah semua bagian terisi.</p>}
        <p className="mt-6 text-[11px] text-gray-600">Skala 1–4. Kategori: D &lt; 2,50 · C &lt; 2,75 · C+ &lt; 3,00 · B &lt; 3,25 · B+ &lt; 3,50 · A ≥ 3,50.</p>
      </div>
    </div>
  );
}

export default function RaporPage() { return <Suspense fallback={<div className="p-10">Loading…</div>}><Rapor /></Suspense>; }
