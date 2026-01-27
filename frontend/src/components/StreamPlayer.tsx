"use client";

import { MJPEGPlayer } from "./MJPEGPlayer";
import { HLSPlayer } from "./HLSPlayer";

export type StreamMode = "mjpeg" | "hls";

interface StreamPlayerProps {
  cameraId: string;
  mode: StreamMode;
  className?: string;
  detectionGrid?: boolean[][];
  showGrid?: boolean;
  onConnected?: () => void;
  onError?: (error: string) => void;
}

export function StreamPlayer({
  cameraId,
  mode,
  className = "",
  detectionGrid,
  showGrid = false,
  onConnected,
  onError,
}: StreamPlayerProps) {
  if (mode === "hls") {
    return (
      <HLSPlayer
        cameraId={cameraId}
        className={className}
        onConnected={onConnected}
        onError={onError}
      />
    );
  }

  return (
    <MJPEGPlayer
      cameraId={cameraId}
      className={className}
      detectionGrid={detectionGrid}
      showGrid={showGrid}
      onConnected={onConnected}
      onError={onError}
    />
  );
}
