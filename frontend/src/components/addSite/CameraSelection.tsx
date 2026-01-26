import { Check, AlertCircle } from "lucide-react";
import CridentialForm from "./CridentialForm";

export default function CameraSelection({ wizard }: { wizard: any }) {
    const {
        scannedCameras,
        selectedCameras,
        scanning,
        error,
        toggleCamera,
        getCredentials,
        setCameraName,
        setCredential,
        cameraNames,
        scanCameras,
    } = wizard;

    return (
        <div className="space-y-6 animate-fade-in h-full flex flex-col">
            <div>
                <h2 className="text-2xl font-black tracking-tighter leading-tight text-slate-800">
                    CCTV를 선택하고
                    <br />
                    인증정보를 입력해주세요
                </h2>
                <p className="text-slate-400 mt-2 text-sm">
                    {scannedCameras.length}개의 CCTV가 발견되었습니다
                </p>
            </div>

            {scannedCameras.length === 0 ? (
                <div className="bg-slate-100 rounded-[24px] p-8 text-center">
                    <p className="text-slate-500 font-bold mb-4">발견된 CCTV가 없습니다</p>
                    <button
                        onClick={scanCameras}
                        disabled={scanning}
                        className="px-6 py-3 bg-blue-600 text-white rounded-2xl font-bold text-sm hover:bg-blue-700 transition-colors disabled:opacity-50"
                    >
                        {scanning ? "스캔 중..." : "다시 스캔"}
                    </button>
                </div>
            ) : (
                <div className="space-y-3 overflow-y-auto">
                    {scannedCameras.map((cam: ScannedCamera) => {
                        const isSelected = selectedCameras.includes(cam.ipAddress);
                        const creds = getCredentials(cam.ipAddress);

                        return (
                            <div
                                key={cam.ipAddress}
                                className={`rounded-2xl border-2 transition-all overflow-hidden mr-2 ${isSelected
                                    ? "border-blue-600 bg-blue-50/50"
                                    : "border-slate-100 bg-white hover:border-slate-200"
                                    }`}
                            >
                                <div
                                    onClick={() => toggleCamera(cam.ipAddress)}
                                    className="p-4 flex items-center gap-4 cursor-pointer"
                                >
                                    <div
                                        className={`w-12 h-12 rounded-xl flex items-center justify-center ${isSelected ? "bg-blue-600" : "bg-slate-200"
                                            }`}
                                    >
                                        <svg
                                            className={`w-5 h-5 ${isSelected ? "text-white" : "text-slate-500"}`}
                                            fill="none"
                                            stroke="currentColor"
                                            viewBox="0 0 24 24"
                                        >
                                            <path
                                                strokeLinecap="round"
                                                strokeLinejoin="round"
                                                strokeWidth={2}
                                                d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"
                                            />
                                        </svg>
                                    </div>
                                    <div className="flex-1">
                                        <p className="font-bold text-slate-800">{cam.brand}</p>
                                        {cam.macAddress && (
                                            <p className="text-sm text-slate-500 font-bold">
                                                MACAddress: {cam.macAddress}
                                            </p>
                                        )}
                                        <p className="text-xs text-slate-400">IP Address : {cam.ipAddress}</p>
                                    </div>
                                    {isSelected && (
                                        <div className="bg-blue-600 text-white rounded-full p-1.5">
                                            <Check size={16} strokeWidth={4} />
                                        </div>
                                    )}
                                </div>

                                {/* 개별 설정 (선택된 경우만 표시) */}
                                {isSelected && (
                                    <CridentialForm
                                        cameraNames={cameraNames}
                                        cam={cam}
                                        setCameraName={setCameraName}
                                        setCredential={setCredential}
                                        creds={creds}
                                    />
                                )}
                            </div>
                        );
                    })}
                </div>
            )}

            {error && (
                <div className="p-4 bg-red-50 border border-red-100 rounded-2xl text-red-600 text-sm font-bold flex items-center gap-2">
                    <AlertCircle size={18} />
                    {error}
                </div>
            )}
        </div>
    );
}