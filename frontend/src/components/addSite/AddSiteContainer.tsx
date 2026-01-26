"use client";

import { AlertCircle, Wifi } from "lucide-react";
import { useAddSiteStore } from "@/stores/useAddSiteStore";
import AddSiteForm from "./AddSiteForm";
import AlreadySite from "./AlreadySite";
import SelectedAddress from "./SelectedAddress";
import ToggleSiteTab from "./ToggleSiteTab";

export default function AddSiteContainer() {
  const { isNewSite, showPostcode, error } = useAddSiteStore();

  return (
    <div className="space-y-8 animate-fade-in">
      <div>
        <h2 className="text-xl font-black leading-tight tracking-tighter text-slate-800">
          새로운 매장 또는 기존 매장에 CCTV를
          <br />
          추가합니다
        </h2>
        <p className="text-slate-400 mt-2 text-sm">매장을 선택하거나 새로 생성해주세요</p>
      </div>

      {/* 매장 선택 방식 탭 */}
      <ToggleSiteTab />

      <div className="space-y-5">
        {isNewSite ? (
          <>
            {/* 새 매장 생성 폼 */}
            <AddSiteForm />

            {/* 다음 우편번호 모달 */}
            {showPostcode && <SelectedAddress />}
          </>
        ) : (
          <>
            {/* 기존 매장 선택 */}
            <AlreadySite />
          </>
        )}
      </div>

      <div className="bg-blue-600 rounded-[24px] p-5 text-white shadow-xl shadow-blue-100 flex gap-4">
        <Wifi size={24} className="shrink-0 text-blue-200" />
        <p className="text-sm font-medium leading-relaxed">
          같은 Wi-Fi 환경에 있는 CCTV를 자동으로 스캔합니다. 매장 내 네트워크에
          연결되어 있는지 확인해 주세요.
        </p>
      </div>

      {error && (
        <div className="p-4 bg-red-50 border border-red-100 rounded-2xl text-red-600 text-sm font-bold flex items-center gap-2">
          <AlertCircle size={18} />
          {error}
        </div>
      )}
    </div>
  );
}
