"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { Store, Shield, ChevronRight, MapPin, Camera, Play } from "lucide-react";
import Image from "next/image";

export default function StoresPage() {
  const router = useRouter();
  const [sites, setSites] = useState<Site[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadSites();

    // 페이지가 다시 보일 때마다 데이터 새로고침
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        loadSites();
      }
    };

    const handleFocus = () => {
      loadSites();
    };

    // 사이트 업데이트 이벤트 리스닝
    const handleSiteUpdated = () => {
      loadSites();
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("focus", handleFocus);
    window.addEventListener("site-updated", handleSiteUpdated);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("focus", handleFocus);
      window.removeEventListener("site-updated", handleSiteUpdated);
    };
  }, []);

  const loadSites = async () => {
    try {
      const data = await api.getSites();
      setSites(data);
    } catch (error) {
      console.error("Failed to load sites:", error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-2 px-1">
        <h1 className="text-xl font-black text-slate-800 flex items-center gap-2">
          <Store size={22} /> 내 사이트
        </h1>
        <span className="text-xs text-slate-400">{sites.length}개 사이트</span>
      </div>

      {/* Stores List */}
      {sites.length === 0 ? (
        <div className="bg-white rounded-[28px] p-8 text-center border border-slate-100 shadow-sm">
          <div className="w-14 h-14 rounded-2xl bg-slate-50 flex items-center justify-center mx-auto mb-4">
            <Store size={28} className="text-slate-300" />
          </div>
          <p className="text-slate-500 font-bold">등록된 사이트가 없습니다</p>
          <p className="text-sm text-slate-400 mt-1">
            하단의 추가 버튼을 눌러 사이트를 등록하세요
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {sites.map((site) => (
            <div
              key={site.id}
              className="bg-white rounded-[28px] border border-slate-100 overflow-hidden shadow-sm"
            >
              {/* Store Header */}
              <div
                className="p-5 cursor-pointer active:bg-slate-50 transition-colors"
                onClick={() => router.push(`/sites/${site.id}`)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-2xl flex items-center justify-center bg-blue-50 text-blue-600">
                      <Image src="/images/logo.png" alt="SnapGuard Logo" width={60} height={60} />
                    </div>
                    <div>
                      <h3 className="font-black text-slate-800">{site.name}</h3>
                      {site.address && (
                        <p className="text-[11px] text-slate-400 font-bold flex items-center gap-1 mt-0.5">
                          <MapPin size={12} />
                          {site.address}
                        </p>
                      )}
                    </div>
                  </div>
                  <ChevronRight size={20} className="text-slate-200" />
                </div>

                {/* Camera count */}
                <div className="mt-4 flex items-center gap-2">
                  <div className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-50 rounded-full">
                    <Camera size={14} className="text-slate-400" />
                    <span className="text-xs font-bold text-slate-500">
                      {site._count?.cameras || 0}대 카메라
                    </span>
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="flex border-t border-slate-100">
                {!!site._count?.cameras && site._count.cameras > 0 && (
                  <>
                    <button
                      onClick={() => router.push(`/live?siteId=${site.id}`)}
                      className="flex-1 py-3.5 text-sm font-bold text-blue-600 hover:bg-blue-50 transition-all flex items-center justify-center gap-2"
                    >
                      <Play size={16} fill="currentColor" />
                      실시간 보기
                    </button>

                    <div className="w-px bg-slate-100" />
                  </>
                )}
                <button
                  onClick={() => router.push(`/sites/${site.id}`)}
                  className="flex-1 py-3.5 text-sm font-bold text-slate-500 hover:bg-slate-50 transition-all"
                >
                  상세 정보
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
