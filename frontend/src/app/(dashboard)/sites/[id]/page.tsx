"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { api } from "@/lib/api";
import { getStatusColor } from "@/lib/severity";

export default function SiteDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [site, setSite] = useState<Site | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadSite();

    // site-updated 이벤트 리스닝 (개선이 필요함 ..)
    const handleSiteUpdated = () => {
      loadSite();
    };

    // 페이지가 다시 보일 때 새로고침
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        loadSite();
      }
    };

    window.addEventListener("site-updated", handleSiteUpdated);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      window.removeEventListener("site-updated", handleSiteUpdated);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [params.id]);

  const loadSite = async () => {
    try {
      const data = await api.getSite(params.id as string);
      setSite(data);
    } catch (error) {
      console.error("Failed to load site:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteCamera = async (cameraId: string) => {
    if (!confirm("카메라를 삭제하시겠습니까?")) return;
    try {
      await api.deleteCamera(cameraId);
      window.dispatchEvent(new CustomEvent("site-updated"));
      loadSite();
    } catch (error) {
      console.error("카메라 삭제 실패:", error);
    }
  };

  const handleDeleteSite = async () => {
    if (!confirm(`"${site?.name}" 사이트를 삭제하시겠습니까?\n연결된 카메라도 함께 삭제됩니다.`)) return;
    try {
      await api.deleteSite(params.id as string);
      window.dispatchEvent(new CustomEvent("site-updated"));
      router.push("/stores");
    } catch (error) {
      console.error("Failed to delete site:", error);
      alert("사이트 삭제에 실패했습니다.");
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!site) {
    return (
      <div className="text-center py-12">
        <h2 className="text-xl font-semibold text-gray-900">사이트를 찾을 수 없습니다.</h2>
        <Link href="/sites" className="text-blue-600 hover:underline mt-2 inline-block">
          돌아가기
        </Link>
      </div>
    );
  }

  return (
    <div className="mt-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-4 px-2">
        <div className="flex items-center gap-4">
          <button
            onClick={() => router.back()}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <div>
            <h1 className="text-xl font-bold text-gray-900">{site.name}</h1>
            {site.address && <p className="text-gray-500 text-xs">{site.address}</p>}
          </div>
        </div>
        <button
          onClick={handleDeleteSite}
          className="px-4 py-2 text-sm text-red-600 hover:bg-red-50 rounded-lg transition-colors border border-red-200"
        >
          사이트 삭제
        </button>
      </div>

      {/* Site Info */}
      {site.description && (
        <div className="bg-white rounded-lg shadow p-4 mb-6">
          <p className="text-gray-600">{site.description}</p>
        </div>
      )}

      {/* Cameras Section */}
      <div className="bg-white rounded-lg shadow">
        <div className="p-2 px-4 border-b">
          <h2 className="text-md font-semibold">연결된 카메라 ({site.cameras?.length ?? 0})</h2>
        </div>

        {!site.cameras || site.cameras.length === 0 ? (
          <div className="p-8 text-center">
            <p className="text-gray-500 mb-2">카메라를 추가해주세요.</p>
            <p className="text-gray-400 text-sm">카메라 추가는 하단바에 "추가" 버튼을 이용해주세요.</p>
          </div>
        ) : (
          <div className="divide-y">
            {site.cameras.map((camera) => (
              <div key={camera.id} className="p-4 flex items-center justify-between hover:bg-gray-50">
                <div className="flex items-center gap-4">
                  <div className={`w-10 h-10 ${getStatusColor(camera.status)} rounded-lg flex items-center justify-center`}>
                    <svg className={`w-5 h-5 ${getStatusColor(camera.status)}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                    </svg>
                  </div>
                  <div>
                    <div className="flex flex-row gap-2 items-center">
                      <h3 className="font-medium text-gray-900">{camera.name}</h3>
                    </div>
                    <p className="text-sm text-gray-500">IP : {camera.ipAddress}</p>
                    {camera.macAddress && (
                      <p className="text-xs text-gray-500">MAC: {camera.macAddress}</p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => handleDeleteCamera(camera.id)}
                    className="px-3 py-1.5 text-sm text-red-600 hover:bg-red-50 rounded transition-colors border border-red-200"
                  >
                    삭제
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

    </div>
  );
}
