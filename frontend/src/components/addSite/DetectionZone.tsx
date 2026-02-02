import { ChevronLeft, ChevronRight, AlertCircle } from "lucide-react";
import DetectionGrid from "../DetectionGrid";

export default function DetectionZone({ wizard }: { wizard: any }) {
    const {
        currentCameraIndex,
        connectedCameras,
        scannedCameras,
        cameraNames,
        detectionGrids,
        sensitivities,
        configuringDetection,
        error,
        setCurrentCameraIndex,
        setDetectionGrid,
        setSensitivity,
    } = wizard;

    const connectedIps = Array.from(connectedCameras.keys()) as string[];
    const currentIp = connectedIps[currentCameraIndex];
    const currentCamera = scannedCameras.find((c: any) => c.ipAddress === currentIp);
    const connected = connectedCameras.get(currentIp);

    if (!currentIp || !connected) return null;

    return (
        <div className="space-y-6 animate-fade-in">
            <div>
                <h2 className="text-2xl font-black tracking-tighter leading-tight text-slate-800">
                    감지 영역을 설정해주세요
                </h2>
                <p className="text-slate-400 mt-2 text-sm">
                    CCTV {currentCameraIndex + 1} / {connectedCameras.size} - 파란 영역에서만 움직임이
                    감지됩니다
                </p>
            </div>

            <div className="space-y-4">
                <div className="flex items-center justify-between bg-slate-50 p-4 rounded-2xl">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-blue-600 text-white rounded-xl flex items-center justify-center">
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"
                                />
                            </svg>
                        </div>
                        <div>
                            <p className="font-bold text-slate-800">
                                {cameraNames.get(currentIp)?.trim() || currentCamera?.model || "CCTV"}
                            </p>
                            <p className="text-xs text-slate-400">{currentIp}</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => setCurrentCameraIndex(Math.max(0, currentCameraIndex - 1))}
                            disabled={currentCameraIndex === 0}
                            className="p-2 rounded-xl bg-slate-200 text-slate-600 disabled:opacity-30"
                        >
                            <ChevronLeft size={20} />
                        </button>
                        <button
                            onClick={() =>
                                setCurrentCameraIndex(Math.min(connectedIps.length - 1, currentCameraIndex + 1))
                            }
                            disabled={currentCameraIndex === connectedIps.length - 1}
                            className="p-2 rounded-xl bg-slate-200 text-slate-600 disabled:opacity-30"
                        >
                            <ChevronRight size={20} />
                        </button>
                    </div>
                </div>

                {/* 감지 영역 그리드 */}
                <DetectionGrid
                    key={currentIp}
                    snapshotUrl={connected.snapshotUrl || undefined}
                    initialGrid={detectionGrids.get(currentIp)}
                    sensitivity={sensitivities.get(currentIp) || 60}
                    onGridChange={(grid) => setDetectionGrid(currentIp, grid)}
                    onSensitivityChange={(sens) => setSensitivity(currentIp, sens)}
                    disabled={configuringDetection}
                />
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