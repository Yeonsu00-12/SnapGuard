"use client";

import { useEffect, useState } from "react";
import { api, SERVER_BASE } from "@/lib/api";
import { StreamPlayer, StreamMode } from "@/components/StreamPlayer";
import { useRouter, useSearchParams } from "next/navigation";

export default function LiveViewPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const siteIdFromUrl = searchParams.get("siteId");

  const [cameras, setCameras] = useState<CameraDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [gridSize, setGridSize] = useState(1);
  const [selectedSite, setSelectedSite] = useState<string>(siteIdFromUrl || "");
  const [sites, setSites] = useState<{ id: string; name: string }[]>([]);
  const [detectionGrids, setDetectionGrids] = useState<Map<string, boolean[][]>>(new Map());
  const [showGridOverlay, setShowGridOverlay] = useState<Set<string>>(new Set());
  const [streamingCameras, setStreamingCameras] = useState<Set<string>>(new Set());
  const [streamMode, setStreamMode] = useState<StreamMode>("mjpeg");
  const [isChangingMode, setIsChangingMode] = useState(false);

  // 모드 전환 (스트림 재시작 방지용 딜레이)
  const handleModeChange = async (newMode: StreamMode) => {
    if (newMode === streamMode || isChangingMode) return;

    setIsChangingMode(true);
    setStreamingCameras(new Set()); // 모든 스트림 중지

    // HLS → MJPEG 전환 시 백엔드 HLS 스트림 중지
    if (streamMode === "hls") {
      const targetCameras = selectedSite
        ? cameras.filter((c) => c.site?.id === selectedSite)
        : cameras;

      await Promise.all(
        targetCameras.map((c) =>
          fetch(`${SERVER_BASE}/api/stream/${c.id}/stop`, { method: "POST" }).catch(() => { })
        )
      );
    }

    // 기존 스트림 정리 시간
    await new Promise(r => setTimeout(r, 500));

    setStreamMode(newMode);

    // 새 스트림 시작 전 대기
    await new Promise(r => setTimeout(r, 500));

    // 다시 스트림 시작
    const targetCameras = selectedSite
      ? cameras.filter((c) => c.site?.id === selectedSite)
      : cameras;
    setStreamingCameras(new Set(targetCameras.map((c) => c.id)));

    setIsChangingMode(false);
  };

  useEffect(() => {
    loadData();
  }, []);

  // URL 파라미터 변경 시 selectedSite 업데이트
  useEffect(() => {
    if (siteIdFromUrl) {
      setSelectedSite(siteIdFromUrl);
    }
  }, [siteIdFromUrl]);

  const loadData = async () => {
    try {
      const [camerasData, sitesData] = await Promise.all([
        api.getCameras(),
        api.getSites(),
      ]);
      setCameras(camerasData);
      setSites(sitesData.map((s: any) => ({ id: s.id, name: s.name })));

      // 모션 감지 그리드 로드
      const targetCameras = siteIdFromUrl
        ? camerasData.filter((c: CameraDetails) => c.site?.id === siteIdFromUrl)
        : camerasData;

      for (const camera of targetCameras) {
        loadDetectionGrid(camera.ipAddress, camera.id);
      }

      // 모든 카메라 자동 스트리밍 시작
      setStreamingCameras(new Set(targetCameras.map((c: Camera) => c.id)));
    } catch (error) {
      console.error("Failed to load data:", error);
    } finally {
      setLoading(false);
    }
  };

  // 카메라의 모션 감지 그리드 로드
  const loadDetectionGrid = async (ipAddress: string, cameraId: string) => {
    try {
      const result = await api.getMotionDetection(cameraId);
      if (result.grid) {
        setDetectionGrids((prev) => new Map(prev).set(cameraId, result.grid));
      }
    } catch (error) {
      console.log(`[Live] Could not load detection grid for ${ipAddress}`);
    }
  };

  const toggleStream = (cameraId: string) => {
    setStreamingCameras((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(cameraId)) {
        newSet.delete(cameraId);
      } else {
        newSet.add(cameraId);
      }
      return newSet;
    });
  };

  const filteredCameras = selectedSite
    ? cameras.filter((c) => c.site?.id === selectedSite)
    : cameras;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="mt-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2 items-center">
          <button
            onClick={() => router.back()}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <h1 className="text-xl font-bold text-gray-900">실시간 모니터링</h1>
        </div>

        <div className="flex items-center gap-4 px-4">
          {/* 스트림 모드 토글 */}
          <div className="flex items-center bg-gray-100 rounded-lg p-1">
            <button
              onClick={() => handleModeChange("mjpeg")}
              disabled={isChangingMode}
              className={`px-3 py-1.5 text-sm rounded-md transition-colors ${streamMode === "mjpeg"
                ? "bg-white text-blue-600 shadow-sm font-medium"
                : "text-gray-600 hover:text-gray-900"
                } ${isChangingMode ? "opacity-50 cursor-not-allowed" : ""}`}
            >
              MJPEG
            </button>
            <button
              onClick={() => handleModeChange("hls")}
              disabled={isChangingMode}
              className={`px-3 py-1.5 text-sm rounded-md transition-colors ${streamMode === "hls"
                ? "bg-white text-blue-600 shadow-sm font-medium"
                : "text-gray-600 hover:text-gray-900"
                } ${isChangingMode ? "opacity-50 cursor-not-allowed" : ""}`}
            >
              HLS
            </button>
          </div>

          <select
            value={selectedSite}
            onChange={(e) => setSelectedSite(e.target.value)}
            className="p-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">모든 사이트</option>
            {sites.map((site) => (
              <option key={site.id} value={site.id}>
                {site.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {filteredCameras.length === 0 ? (
        <div className="bg-white rounded-lg shadow p-8 text-center">
          <p className="text-gray-500 text-sm">카메라를 찾을 수 없습니다. 실시간 피드를 보려면 카메라를 추가하세요.</p>
        </div>
      ) : (
        <div
          className="grid gap-4 px-4"
          style={{
            gridTemplateColumns: `repeat(${gridSize}, 1fr)`,
          }}
        >
          {filteredCameras.map((camera) => {
            const isStreaming = streamingCameras.has(camera.id);

            return (
              <div
                key={camera.id}
                className="bg-white rounded-lg shadow overflow-hidden"
              >
                <div className="p-3 bg-gray-50 border-b flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="text-md text-text font-bold">{camera.site?.name || "No Site"}</p>
                      <span className={`px-1.5 py-0.5 text-[10px] rounded font-medium ${streamMode === "mjpeg"
                        ? "bg-green-100 text-green-700"
                        : "bg-purple-100 text-purple-700"
                        }`}>
                        {streamMode.toUpperCase()}
                      </span>
                    </div>
                    <p className="text-xs text-gray-500">{camera.name}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => {
                        setShowGridOverlay((prev) => {
                          const newSet = new Set(prev);
                          if (newSet.has(camera.id)) {
                            newSet.delete(camera.id);
                          } else {
                            newSet.add(camera.id);
                          }
                          return newSet;
                        });
                      }}
                      className={`px-3 py-0.5 rounded-md text-sm transition-colors ${showGridOverlay.has(camera.id)
                        ? "bg-blue-500 text-white"
                        : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                        }`}
                    >
                      {showGridOverlay.has(camera.id) ? "감지 영역 숨기기" : "감지 영역 표시"}
                    </button>
                  </div>
                </div>

                <div className="aspect-video bg-gray-900">
                  {isStreaming ? (
                    <StreamPlayer
                      key={`${camera.id}-${streamMode}`}
                      cameraId={camera.id}
                      mode={streamMode}
                      className="w-full h-full"
                      detectionGrid={detectionGrids.get(camera.id)}
                      showGrid={showGridOverlay.has(camera.id)}
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-gray-500">
                      <div className="text-center">
                        <svg
                          className="w-12 h-12 mx-auto mb-2 opacity-50"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={1.5}
                            d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"
                          />
                        </svg>
                        <p className="text-sm">스트리밍 준비 중</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
