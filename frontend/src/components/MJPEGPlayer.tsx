"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { io, Socket } from "socket.io-client";
import { SERVER_BASE } from "@/lib/api";

interface MJPEGPlayerProps {
  cameraId: string;
  className?: string;
  detectionGrid?: boolean[][];
  showGrid?: boolean;
  onConnected?: () => void;
  onError?: (error: string) => void;
}

export function MJPEGPlayer({
  cameraId,
  className = "",
  detectionGrid,
  showGrid = false,
  onConnected,
  onError,
}: MJPEGPlayerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const socketRef = useRef<Socket | null>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [fps, setFps] = useState(0);
  const frameCountRef = useRef(0);
  const lastFpsUpdateRef = useRef(Date.now());
  const mountTimeRef = useRef<number>(0);
  const firstFrameLoggedRef = useRef(false);

  // FPS 계산
  const updateFps = useCallback(() => {
    const now = Date.now();
    const elapsed = now - lastFpsUpdateRef.current;
    if (elapsed >= 1000) {
      setFps(Math.round((frameCountRef.current * 1000) / elapsed));
      frameCountRef.current = 0;
      lastFpsUpdateRef.current = now;
    }
  }, []);

  // 콜백을 ref로 저장하여 useEffect 재실행 방지
  const onConnectedRef = useRef(onConnected);
  onConnectedRef.current = onConnected;

  // 프레임 렌더링 (의존성 최소화)
  const renderFrame = useCallback((base64Data: string) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // 이미지 로드 및 렌더링
    if (!imgRef.current) {
      imgRef.current = new Image();
    }

    const img = imgRef.current;
    img.onload = () => {
      // Canvas 크기 조정 (첫 프레임에서만)
      if (canvas.width !== img.width || canvas.height !== img.height) {
        canvas.width = img.width;
        canvas.height = img.height;
      }

      ctx.drawImage(img, 0, 0);
      frameCountRef.current++;
      updateFps();

      // loading 상태를 함수형 업데이트로 처리하여 의존성 제거
      setLoading((prev) => {
        if (prev) {
          onConnectedRef.current?.();
          return false;
        }
        return prev;
      });
    };

    img.src = `data:image/jpeg;base64,${base64Data}`;
  }, [updateFps]);

  // onError도 ref로 저장
  const onErrorRef = useRef(onError);
  onErrorRef.current = onError;

  // renderFrame을 ref로 저장하여 useEffect 재실행 방지
  const renderFrameRef = useRef(renderFrame);
  renderFrameRef.current = renderFrame;

  useEffect(() => {
    // 타이밍 측정 시작
    mountTimeRef.current = performance.now();
    firstFrameLoggedRef.current = false;
    console.log(`[MJPEG] ⏱️ 시작: 컴포넌트 마운트`);

    const token = localStorage.getItem("token");

    const socket = io(SERVER_BASE, {
      transports: ["websocket", "polling"],
      auth: { token },
    });

    socketRef.current = socket;

    socket.on("connect", () => {
      const elapsed = ((performance.now() - mountTimeRef.current) / 1000).toFixed(2);
      console.log(`[MJPEG] ⏱️ +${elapsed}s: Socket 연결됨, subscribing to camera ${cameraId}`);
      socket.emit("subscribe:stream", { cameraId });
    });

    socket.on("disconnect", () => {
      console.log(`[MJPEG] Disconnected from camera ${cameraId}`);
      setError("연결이 끊어졌습니다");
    });

    socket.on("stream:frame", (data: { cameraId: string; frame: string; timestamp: number }) => {
      if (data.cameraId === cameraId) {
        // 첫 프레임 타이밍 로그
        if (!firstFrameLoggedRef.current) {
          const elapsed = ((performance.now() - mountTimeRef.current) / 1000).toFixed(2);
          console.log(`[MJPEG] ⏱️ +${elapsed}s: 🎬 첫 프레임 수신! (진입 시간: ${elapsed}초)`);
          firstFrameLoggedRef.current = true;
        }
        renderFrameRef.current(data.frame);
        setError(null);
      }
    });

    socket.on("stream:error", (data: { cameraId: string; error: string }) => {
      if (data.cameraId === cameraId) {
        console.error(`[MJPEG] Stream error for ${cameraId}:`, data.error);
        setError(data.error);
        onErrorRef.current?.(data.error);
      }
    });

    socket.on("connect_error", (err) => {
      console.error("[MJPEG] Connection error:", err);
      setError("서버에 연결할 수 없습니다");
    });

    return () => {
      console.log(`[MJPEG] Cleaning up camera ${cameraId}`);
      socket.emit("unsubscribe:stream", { cameraId });
      socket.close();
      socketRef.current = null;
    };
  }, [cameraId]); // cameraId만 의존 - 카메라가 바뀔 때만 재연결

  const handleRetry = () => {
    setError(null);
    setLoading(true);

    if (socketRef.current) {
      socketRef.current.emit("unsubscribe:stream", { cameraId });
      setTimeout(() => {
        socketRef.current?.emit("subscribe:stream", { cameraId });
      }, 500);
    }
  };

  return (
    <div className={`relative bg-black overflow-hidden ${className}`}>
      <canvas
        ref={canvasRef}
        className="w-full h-full object-contain"
        style={{ display: loading || error ? "none" : "block" }}
      />

      {/* Loading Indicator */}
      {loading && !error && (
        <div className="absolute inset-0 flex items-center justify-center bg-black">
          <div className="text-center text-white">
            <div className="w-8 h-8 border-2 border-white border-t-transparent rounded-full animate-spin mx-auto mb-2" />
            <p className="text-sm">스트림 연결 중...</p>
          </div>
        </div>
      )}

      {/* Error Message */}
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

      {/* FPS Indicator */}
      {/* {!loading && !error && (
        <div className="absolute top-2 right-2 bg-black/60 px-2 py-1 rounded text-xs text-white">
          {fps} FPS
        </div>
      )} */}

      {/* Detection Grid Overlay */}
      {showGrid && detectionGrid && !loading && !error && (
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(22, 1fr)",
            gridTemplateRows: "repeat(15, 1fr)",
          }}
        >
          {detectionGrid.map((row, rowIdx) =>
            row.map((cell, colIdx) => (
              <div
                key={`${rowIdx}-${colIdx}`}
                className={`border border-white/10 ${
                  cell ? "bg-blue-500/30" : "bg-transparent"
                }`}
              />
            ))
          )}
        </div>
      )}
    </div>
  );
}
