"use client";

import { MapPin, Search, Store } from "lucide-react";
import { useAddSiteStore } from "@/stores/useAddSiteStore";

export default function AddSiteForm() {
  const {
    siteName,
    setSiteName,
    siteAddress,
    detailAddress,
    setDetailAddress,
    setShowPostcode
  } = useAddSiteStore();

  return (
    <>
      <div className="space-y-2">
        <label className="text-[11px] font-black text-slate-400 uppercase tracking-wider">
          매장 이름 *
        </label>
        <div className="relative">
          <Store
            size={18}
            className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300"
          />
          <input
            type="text"
            value={siteName}
            onChange={(e) => setSiteName(e.target.value)}
            placeholder="예: 강남본점 무인매장"
            className="w-full pl-12 pr-4 py-2 bg-slate-50 border-2 border-transparent focus:border-blue-600 rounded-md outline-none font-bold text-slate-800 transition-all placeholder:text-slate-300 placeholder:text-sm"
          />
        </div>
      </div>

      <div className="space-y-2">
        <label className="text-[11px] font-black text-slate-400 uppercase tracking-wider">
          매장 주소 *
        </label>
        <div className="flex gap-2 items-center">
          <div className="relative flex-1">
            <MapPin
              size={18}
              className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300"
            />
            <input
              type="text"
              value={siteAddress}
              readOnly
              placeholder="주소를 검색해주세요"
              className="w-full pl-12 pr-4 py-2 bg-slate-50 border-2 border-transparent rounded-md outline-none font-bold text-slate-800 transition-all placeholder:text-slate-300 cursor-pointer placeholder:text-sm"
              onClick={() => setShowPostcode(true)}
            />
          </div>
          <button
            type="button"
            onClick={() => setShowPostcode(true)}
            className="p-2 bg-blue-600 hover:bg-blue-700 text-white text-sm py-3 rounded-md font-bold transition-all flex items-center gap-2"
          >
            <Search size={18} />
            검색
          </button>
        </div>
        <input
          type="text"
          value={detailAddress}
          onChange={(e) => setDetailAddress(e.target.value)}
          placeholder="상세 주소 (동/호수)"
          className="w-full px-4 py-2 bg-slate-50 border-2 border-transparent focus:border-blue-600 rounded-md outline-none font-bold text-slate-800 transition-all placeholder:text-slate-300 placeholder:text-sm"
        />
      </div>
    </>
  );
}
