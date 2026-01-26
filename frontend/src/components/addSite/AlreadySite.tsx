"use client";

import { Check, RefreshCw, Store } from "lucide-react";
import { useAddSiteStore } from "@/stores/useAddSiteStore";

export default function AlreadySite() {
  const {
    loadingSites,
    existingSites,
    selectedSiteId,
    setSelectedSiteId
  } = useAddSiteStore();

  return (
    <div className="space-y-2">
      <label className="text-sm font-bold text-slate-400 uppercase tracking-wider">
        기존 매장 선택 *
      </label>
      {loadingSites ? (
        <div className="flex items-center justify-center py-8">
          <RefreshCw size={24} className="animate-spin text-blue-600" />
        </div>
      ) : existingSites.length === 0 ? (
        <div className="bg-slate-50 rounded-2xl p-6 text-center">
          <Store size={32} className="mx-auto text-slate-300 mb-2" />
          <p className="text-slate-500 font-medium">등록된 매장이 없습니다</p>
          <p className="text-slate-400 text-sm mt-1">새 매장을 생성해주세요</p>
        </div>
      ) : (
        <div className="space-y-2 max-h-60 overflow-y-auto">
          {existingSites.map((site) => (
            <div
              key={site.id}
              onClick={() => setSelectedSiteId(site.id)}
              className={`p-4 rounded-2xl cursor-pointer transition-all flex items-center gap-3 ${
                selectedSiteId === site.id
                  ? "bg-blue-50 border-2 border-blue-600"
                  : "bg-slate-50 border-2 border-transparent hover:border-slate-200"
              }`}
            >
              <div
                className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                  selectedSiteId === site.id
                    ? "bg-blue-600 text-white"
                    : "bg-slate-200 text-slate-500"
                }`}
              >
                <Store size={20} />
              </div>
              <div className="flex-1">
                <p className="font-bold text-slate-800">{site.name}</p>
                {site.address && (
                  <p className="text-xs text-slate-400">{site.address}</p>
                )}
              </div>
              {selectedSiteId === site.id && (
                <Check size={20} className="text-blue-600" />
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
