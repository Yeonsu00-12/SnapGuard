"use client";

import { useAddSiteStore } from "@/stores/useAddSiteStore";

export default function ToggleSiteTab() {
  const { isNewSite, setIsNewSite, existingSites } = useAddSiteStore();

  return (
    <div className="flex gap-2 p-1 bg-slate-100 rounded-2xl">
      <button
        onClick={() => setIsNewSite(true)}
        className={`flex-1 py-3 px-4 rounded-xl font-bold text-sm transition-all ${
          isNewSite
            ? "bg-white text-slate-800 shadow-md"
            : "text-slate-500 hover:text-slate-700"
        }`}
      >
        새 매장 생성
      </button>
      <button
        onClick={() => existingSites.length > 0 && setIsNewSite(false)}
        disabled={existingSites.length === 0}
        className={`flex-1 py-3 px-4 rounded-xl font-bold text-sm transition-all ${
          !isNewSite
            ? "bg-white text-slate-800 shadow-md"
            : existingSites.length === 0
            ? "text-slate-300 cursor-not-allowed"
            : "text-slate-500 hover:text-slate-700"
        }`}
      >
        기존 매장 선택
      </button>
    </div>
  );
}
