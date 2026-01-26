import { SERVER_BASE } from "@/lib/api";
import { AlertCircle, Camera, CheckCircle2, RefreshCw } from "lucide-react";
import Image from "next/image";

export default function ConnetedCamera({ connecting, currentConnectingIp, connectedCameras, selectedCameras, scannedCameras, connectionErrors, cameraNames, testConnections }: {
    connecting: boolean
    currentConnectingIp: string, connectedCameras: Map<string, ConnectedCamera>, selectedCameras: string[], scannedCameras: ScannedCamera[], connectionErrors: Map<string, string>, cameraNames: Map<string, string>, testConnections: () => Promise<void>
}) {
    return (
        <div className="space-y-6 animate-fade-in">
            <div>
                <h2 className="text-2xl font-black tracking-tighter leading-tight text-slate-800">
                    CCTV 연결 확인
                </h2>
                <p className="text-slate-400 mt-2 text-sm">
                    {connecting
                        ? `${currentConnectingIp} 연결 중...`
                        : `${connectedCameras.size}/${selectedCameras.length}대 연결 성공`}
                </p>
            </div>

            <div className="space-y-3">
                {selectedCameras.map((ip) => {
                    const camera = scannedCameras.find((c) => c.ipAddress === ip);
                    const connected = connectedCameras.get(ip);
                    const connError = connectionErrors.get(ip);
                    const isConnecting = currentConnectingIp === ip;

                    return (
                        <div
                            key={ip}
                            className={`rounded-2xl border-2 p-4 flex items-center gap-4 ${connected
                                ? "border-green-500 bg-green-50"
                                : connError
                                    ? "border-red-500 bg-red-50"
                                    : isConnecting
                                        ? "border-blue-500 bg-blue-50"
                                        : "border-slate-200 bg-slate-50"
                                }`}
                        >
                            {connected?.snapshotUrl ? (
                                <Image
                                    src={`${SERVER_BASE}${connected.snapshotUrl}`}
                                    alt="Camera"
                                    width={80}
                                    height={80}
                                    className="w-20 h-20 rounded-xl object-cover"
                                />
                            ) : (
                                <div className={`w-20 h-20 rounded-xl flex items-center justify-center ${isConnecting ? "bg-blue-200" : connError ? "bg-red-200" : "bg-slate-200"
                                    }`}>
                                    {isConnecting ? (
                                        <RefreshCw size={24} className="text-blue-600 animate-spin" />
                                    ) : connError ? (
                                        <AlertCircle size={24} className="text-red-500" />
                                    ) : (
                                        <Camera size={24} className="text-slate-400" />
                                    )}
                                </div>
                            )}
                            <div className="flex-1">
                                <p className="font-bold text-slate-800">
                                    {cameraNames.get(ip)?.trim() || camera?.model || "CCTV"}
                                </p>
                                <p className="text-xs text-slate-500">{ip}</p>
                                {connected && (
                                    <p className="text-xs text-green-600 font-medium mt-1">
                                        CCTV 연결 성공
                                    </p>
                                )}
                                {connError && (
                                    <p className="text-xs text-red-600 font-medium mt-1">{connError}</p>
                                )}
                            </div>
                            {connected && (
                                <CheckCircle2 size={24} className="text-green-500" />
                            )}
                        </div>
                    );
                })}
            </div>

            {!connecting && connectionErrors.size > 0 && (
                <button
                    onClick={testConnections}
                    className="w-full py-3 bg-slate-200 text-slate-700 rounded-xl font-bold text-sm hover:bg-slate-300 transition-colors"
                >
                    다시 연결 테스트
                </button>
            )}
        </div>
    )
}