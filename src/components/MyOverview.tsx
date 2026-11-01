'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { resolveProfile } from '@/lib/weights';
import ScoresLockedNotice from '@/components/ScoresLockedNotice';

type ScoreStats = { average: number; totalEvaluations: number; letterGrade: string };
type MyScores = { peer: ScoreStats; student: ScoreStats; locked?: boolean };

// The same rating block the teacher / staff dashboards show: Final Evaluation Rating plus Student, Scores from Others,
// Observation and Attendance cards, weighted by the profile of the logged-in role.
export default function MyOverview() {
  const [myScores, setMyScores] = useState<MyScores | null>(null);
  const [myWeights, setMyWeights] = useState({ studentWeight: 25, peerWeight: 25, observationWeight: 25, attendanceWeight: 25 });
  const [myAbsence, setMyAbsence] = useState<number | null>(null);
  const [myObsAvg, setMyObsAvg] = useState<number | null>(null);

  useEffect(() => { (async () => {
    try {
      const meRes = await fetch('/api/me'); if (!meRes.ok) return;
      const meData = await meRes.json();

      const scoreRes = await fetch('/api/me/scores');
      if (scoreRes.ok) { const d = await scoreRes.json(); if (!d.error) setMyScores(d); }

      const wRes = await fetch('/api/settings/weights'); const wData = await wRes.json().catch(() => null);
      if (Array.isArray(wData)) {
        const w = resolveProfile(wData, meData.role, meData.level);
        if (w) setMyWeights({ studentWeight: Number(w.studentWeight) || 0, peerWeight: Number(w.peerWeight) || 0, observationWeight: Number(w.observationWeight) || 0, attendanceWeight: Number(w.attendanceWeight) || 0 });
      }

      const absRes = await fetch('/api/absences'); const absData = await absRes.json().catch(() => null);
      if (Array.isArray(absData)) { const mine = absData.find((a: any) => a.userId === meData.id); if (mine) setMyAbsence(mine.attendanceScore); }

      const obsRes = await fetch('/api/observasi'); const obsData = await obsRes.json().catch(() => null);
      if (Array.isArray(obsData)) {
        const mine = obsData.filter((o: any) => o.targetId === meData.id && o.isApproved);
        if (mine.length) setMyObsAvg(mine.reduce((sum: number, o: any) => sum + o.finalScore, 0) / mine.length);
      }
    } catch {}
  })(); }, []);

  let activeWeightSum = 0; let accumulatedScore = 0;
  const sScore = myScores?.student?.average || 0;
  const pScore = myScores?.peer?.average || 0;
  const oScore = myObsAvg || 0;
  const aScore = myAbsence || 0;
  if (myWeights.studentWeight > 0 && sScore > 0) { activeWeightSum += myWeights.studentWeight; accumulatedScore += sScore * myWeights.studentWeight; }
  if (myWeights.peerWeight > 0 && pScore > 0) { activeWeightSum += myWeights.peerWeight; accumulatedScore += pScore * myWeights.peerWeight; }
  if (myWeights.observationWeight > 0 && oScore > 0) { activeWeightSum += myWeights.observationWeight; accumulatedScore += oScore * myWeights.observationWeight; }
  if (myWeights.attendanceWeight > 0 && aScore > 0) { activeWeightSum += myWeights.attendanceWeight; accumulatedScore += aScore * myWeights.attendanceWeight; }
  const trueOverallAvg = activeWeightSum > 0 ? (accumulatedScore / activeWeightSum).toFixed(2) : '-.-';

  return (
    <div className="text-gray-900 [color-scheme:light]">
  {myScores?.locked && (
      <>
        <ScoresLockedNotice />
        <div className="mt-6">
          <Link href="/self-reflection" className="block w-full bg-[#008c99] hover:bg-[#007b87] text-white font-bold py-4 rounded-xl shadow-md text-center transition-all">Complete My Self-Reflection</Link>
        </div>
      </>
    )}
    {myScores && !myScores.locked && (
      <>
        <div className="bg-[#053b50] rounded-2xl px-6 py-6 md:px-8 md:py-6 text-white flex flex-col md:flex-row justify-between items-center gap-4 mb-6 shadow-md border border-gray-800">
          <div>
            <h2 className="text-xl md:text-2xl font-bold tracking-wide">Final Evaluation Rating</h2>
            <p className="text-sm font-medium opacity-90 mt-1 text-gray-300">Your overall score based on the metrics below</p>
          </div>
          <div className="text-center md:text-right">
            <div className="text-5xl md:text-5xl font-extrabold tracking-tight text-[#e99a24]">{trueOverallAvg}</div>
            <div className="text-sm font-bold opacity-90 mt-1">out of 4.0</div>
          </div>
        </div>
  
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {myWeights.studentWeight > 0 && (
            <div className="bg-white rounded-2xl shadow-sm p-6 border border-gray-100 flex flex-col justify-between">
              <div>
                <h3 className="text-lg font-extrabold text-black">Student Rating</h3>
                <p className="text-gray-500 font-medium mb-4 text-xs">Weight: {myWeights.studentWeight}%</p>
                <div className="flex justify-between items-end mb-3">
                  <div className="text-3xl font-extrabold text-[#008c99] tracking-tight">{sScore > 0 ? sScore.toFixed(1) : '-.-'}</div>
                </div>
              </div>
              <div className="w-full bg-[#e6e6e6] rounded-full h-3"><div className="bg-[#008c99] h-3 rounded-full transition-all duration-1000" style={{ width: `${(sScore / 4) * 100}%` }}></div></div>
            </div>
          )}
          {myWeights.peerWeight > 0 && (
            <div className="bg-white rounded-2xl shadow-sm p-6 border border-gray-100 flex flex-col justify-between">
              <div>
                <h3 className="text-lg font-extrabold text-black">Scores from Others</h3>
                <p className="text-gray-500 font-medium mb-4 text-xs">Weight: {myWeights.peerWeight}%</p>
                <div className="flex justify-between items-end mb-3">
                  <div className="text-3xl font-extrabold text-[#f39c12] tracking-tight">{pScore > 0 ? pScore.toFixed(1) : '-.-'}</div>
                  <div className="text-xs font-bold text-[#f39c12]">({myScores.peer.totalEvaluations} reviews)</div>
                </div>
              </div>
              <div className="w-full bg-[#e6e6e6] rounded-full h-3"><div className="bg-[#f39c12] h-3 rounded-full transition-all duration-1000" style={{ width: `${(pScore / 4) * 100}%` }}></div></div>
            </div>
          )}
          {myWeights.observationWeight > 0 && (
            <div className="bg-white rounded-2xl shadow-sm p-6 border border-gray-100 flex flex-col justify-between">
              <div>
                <h3 className="text-lg font-extrabold text-black">Observation</h3>
                <p className="text-gray-500 font-medium mb-4 text-xs">Weight: {myWeights.observationWeight}%</p>
                <div className="flex justify-between items-end mb-3">
                  <div className="text-3xl font-extrabold text-green-600 tracking-tight">{oScore > 0 ? oScore.toFixed(2) : '-.-'}</div>
                </div>
              </div>
              <div className="w-full bg-[#e6e6e6] rounded-full h-3"><div className="bg-green-600 h-3 rounded-full transition-all duration-1000" style={{ width: `${(oScore / 4) * 100}%` }}></div></div>
            </div>
          )}
          {myWeights.attendanceWeight > 0 && (
            <div className="bg-white rounded-2xl shadow-sm p-6 border border-gray-100 flex flex-col justify-between">
              <div>
                <h3 className="text-lg font-extrabold text-black">Attendance</h3>
                <p className="text-gray-500 font-medium mb-4 text-xs">Weight: {myWeights.attendanceWeight}%</p>
                <div className="flex justify-between items-end mb-3">
                  <div className="text-3xl font-extrabold text-teal-600 tracking-tight">{aScore > 0 ? aScore.toFixed(1) : '-.-'}</div>
                </div>
              </div>
              <div className="w-full bg-[#e6e6e6] rounded-full h-3"><div className="bg-teal-600 h-3 rounded-full transition-all duration-1000" style={{ width: `${(aScore / 4) * 100}%` }}></div></div>
            </div>
          )}
        </div>
  
        <div className="mt-6">
          <Link href="/self-reflection" className="block w-full bg-[#008c99] hover:bg-[#007b87] text-white font-bold py-4 rounded-xl shadow-md text-center transition-all">Complete My Self-Reflection</Link>
        </div>
      </>
    )}
    </div>
  );
}
