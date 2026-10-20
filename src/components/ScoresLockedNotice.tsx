export default function ScoresLockedNotice() {
  return (
    <div className="bg-amber-50 border-2 border-amber-200 rounded-2xl p-8 text-center shadow-sm">
      <div className="w-14 h-14 bg-amber-100 text-amber-600 rounded-full flex items-center justify-center mx-auto mb-4">
        <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4" /></svg>
      </div>
      <h3 className="text-xl font-extrabold text-amber-800">Your scores are locked</h3>
      <p className="text-amber-700 mt-2">The admin has not released evaluation results yet. They will appear here once they are unlocked.</p>
    </div>
  );
}
