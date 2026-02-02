"use client";

import { useEffect, useRef, useState } from "react";
import Hls from "hls.js";
import { api } from "@/lib/api";

interface HLSPlayerProps {
  cameraId: string;
  className?: string;
  onConnected?: () => void;
  onError?: (error: string) => void;
}

export function HLSPlayer({
  cameraId,
  className = "",
  onConnected,
  onError,
}: HLSPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [hlsUrl, setHlsUrl] = useState<string | null>(null);
  const mountTimeRef = useRef<number>(0);

  // HLS 스트림 시작
  const startStream = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch(`/api/stream/${cameraId}/start`, {
        method: "POST",
      });
      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || "스트림 시작 실패");
      }

      const elapsed = ((performance.now() - mountTimeRef.current) / 1000).toFixed(2);
      console.log(`[HLS] ⏱️ +${elapsed}s: API 응답 받음, HLS URL 설정`);
      setHlsUrl(data.hlsUrl);
    } catch (err: any) {
      console.error("[HLS] Start error:", err);
      setError(err.message || "스트림 시작 실패");
      onError?.(err.message);
      setLoading(false);
    }
  };

  // HLS.js 인스턴스만 정리 (백엔드 스트림은 유지)
  const cleanupHls = () => {
    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }
  };

  // 스트림 시작 (백엔드 스트림은 계속 유지됨 - 모드 전환 시 live/page.tsx에서 stop 호출)
  useEffect(() => {
    // 타이밍 측정 시작
    mountTimeRef.current = performance.now();
    console.log(`[HLS] ⏱️ 시작: 컴포넌트 마운트`);

    startStream();

    return () => {
      // 컴포넌트 unmount 시 hls.js만 정리, 백엔드 FFmpeg는 계속 유지
      cleanupHls();
    };
  }, [cameraId]);

  // HLS 플레이어 초기화 (playlist 준비될 때까지 폴링)
  useEffect(() => {
    if (!hlsUrl || !videoRef.current) return;

    const video = videoRef.current;
    let cancelled = false;
    let pollCount = 0;
    const maxPolls = 15; // 최대 15번 (약 15초)

    // playlist가 준비될 때까지 폴링
    const pollForPlaylist = async () => {
      while (!cancelled && pollCount < maxPolls) {
        pollCount++;
        try {
          const res = await fetch(hlsUrl, { method: "HEAD" });
          if (res.ok) {
            const elapsed = ((performance.now() - mountTimeRef.current) / 1000).toFixed(2);
            console.log(`[HLS] ⏱️ +${elapsed}s: Playlist 준비됨 (${pollCount}번 폴링)`);
            initializeHls();
            return;
          }
        } catch (err) {
          // 아직 준비 안 됨
        }
        const elapsed = ((performance.now() - mountTimeRef.current) / 1000).toFixed(2);
        console.log(`[HLS] ⏱️ +${elapsed}s: Playlist 대기 중... (${pollCount}/${maxPolls})`);
        await new Promise(r => setTimeout(r, 1000));
      }

      if (!cancelled) {
        setError("스트림 준비 시간 초과");
        setLoading(false);
      }
    };

    const initializeHls = () => {
      if (cancelled) return;

      if (Hls.isSupported()) {
        const hls = new Hls({
          liveSyncDuration: 1,
          liveMaxLatencyDuration: 5,
          lowLatencyMode: true,
          maxBufferLength: 2,
          maxMaxBufferLength: 3,
        });

        hlsRef.current = hls;

        hls.loadSource(hlsUrl);
        hls.attachMedia(video);

        hls.on(Hls.Events.MANIFEST_PARSED, () => {
          const elapsed = ((performance.now() - mountTimeRef.current) / 1000).toFixed(2);
          console.log(`[HLS] ⏱️ +${elapsed}s: 🎬 영상 재생 시작! (진입 시간: ${elapsed}초)`);
          video.play().catch(() => {});
          setLoading(false);
          onConnected?.();
        });

        hls.on(Hls.Events.ERROR, (event, data) => {
          console.error("[HLS] Error:", data);
          if (data.fatal) {
            setError("스트림 연결 실패");
            onError?.("스트림 연결 실패");
            setLoading(false);
          }
        });
      } else if (video.canPlayType("application/vnd.apple.mpegurl")) {
        // Safari 네이티브 HLS
        video.src = hlsUrl;
        video.addEventListener("loadedmetadata", () => {
          video.play().catch(() => {});
          setLoading(false);
          onConnected?.();
        });
      } else {
        setError("HLS를 지원하지 않는 브라우저입니다");
        setLoading(false);
      }
    };

    pollForPlaylist();

    return () => {
      cancelled = true;
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
    };
  }, [hlsUrl]);

  const handleRetry = async () => {
    setError(null);
    cleanupHls();
    // 백엔드 스트림 재시작
    try {
      await fetch(`/api/stream/${cameraId}/stop`, { method: "POST" });
    } catch (err) {
      // ignore
    }
    startStream();
  };

  return (
    <div className={`relative bg-black overflow-hidden ${className}`}>
      <video
        ref={videoRef}
        className="w-full h-full object-contain"
        muted
        autoPlay
        playsInline
        style={{ display: loading || error ? "none" : "block" }}
      />

      {/* Loading */}
      {loading && !error && (
        <div className="absolute inset-0 flex items-center justify-center bg-black">
          <div className="text-center text-white">
            <div className="w-8 h-8 border-2 border-white border-t-transparent rounded-full animate-spin mx-auto mb-2" />
            <p className="text-sm">HLS 스트림 준비 중...</p>
            <p className="text-xs text-gray-400 mt-1">playlist 대기 중...</p>
          </div>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/80">
          <div className="text-center text-white p-4">
            <svg
              className="w-10 h-10 mx-auto mb-2 text-red-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            <p className="text-sm">{error}</p>
            <button
              onClick={handleRetry}
              className="mt-3 px-4 py-1 bg-blue-600 text-white text-sm rounded hover:bg-blue-700"
            >
              다시 시도
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
