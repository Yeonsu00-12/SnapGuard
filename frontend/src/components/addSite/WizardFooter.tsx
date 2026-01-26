import { Wifi, RefreshCw, Grid3X3 } from "lucide-react";

export default function WizardFooter({ wizard }: { wizard: any }) {
    return (
        <div className="p-6 border-t bg-white">
            {wizard.step === 1 && (
                <button
                    onClick={wizard.handleStep1Next}
                    className={`w-full py-3 rounded-lg font-bold text-md shadow-lg transition-all ${(wizard.isNewSite && wizard.siteName.trim() && wizard.siteAddress) ||
                        (!wizard.isNewSite && wizard.selectedSiteId)
                        ? "bg-blue-600 text-white shadow-blue-100 hover:bg-blue-700 active:scale-[0.98]"
                        : "bg-slate-200 text-slate-400 shadow-none cursor-not-allowed"
                        }`}
                >
                    다음 단계로 이동
                </button>
            )}

            {wizard.step === 3 && (
                <button
                    onClick={wizard.handleStep3Next}
                    disabled={wizard.selectedCameras.length === 0}
                    className={`w-full py-3 rounded-lg font-bold text-md transition-all ${wizard.selectedCameras.length > 0
                        ? "bg-blue-600 text-white hover:bg-blue-700 active:scale-[0.98]"
                        : "bg-slate-200 text-slate-400 cursor-not-allowed"
                        }`}
                >
                    {wizard.selectedCameras.length > 0 ? (
                        <span className="flex items-center justify-center gap-2">
                            <Wifi size={20} />
                            {wizard.selectedCameras.length}대 연결 테스트
                        </span>
                    ) : (
                        "CCTV를 선택해주세요"
                    )}
                </button>
            )}

            {wizard.step === 4 && (
                <button
                    onClick={wizard.handleStep4Next}
                    disabled={wizard.connecting || wizard.connectedCameras.size === 0}
                    className={`w-full py-3 rounded-lg font-bold text-md transition-all ${!wizard.connecting && wizard.connectedCameras.size > 0
                        ? "bg-blue-600 text-white hover:bg-blue-700 active:scale-[0.98]"
                        : "bg-slate-200 text-slate-400 cursor-not-allowed"
                        }`}
                >
                    {wizard.connecting ? (
                        <span className="flex items-center justify-center gap-2">
                            <RefreshCw size={20} className="animate-spin" />
                            연결 테스트 중...
                        </span>
                    ) : wizard.connectedCameras.size > 0 ? (
                        <span className="flex items-center justify-center gap-2">
                            <Grid3X3 size={20} />
                            감지 영역 설정하기 ({wizard.connectedCameras.size}대)
                        </span>
                    ) : (
                        "연결된 CCTV가 없습니다"
                    )}
                </button>
            )}

            {wizard.step === 5 && (
                <button
                    onClick={wizard.handleComplete}
                    disabled={wizard.saving || wizard.configuringDetection}
                    className="w-full py-3 rounded-lg font-bold text-md transition-all bg-blue-600 text-white hover:bg-blue-700 active:scale-[0.98] disabled:opacity-50"
                >
                    {wizard.saving || wizard.configuringDetection ? (
                        <span className="flex items-center justify-center gap-2">
                            <RefreshCw size={20} className="animate-spin" />
                            {wizard.configuringDetection ? "CCTV 설정 중..." : "저장 중..."}
                        </span>
                    ) : (
                        `${wizard.connectedCameras.size}대 CCTV 설정 완료`
                    )}
                </button>
            )}
        </div>
    );
}