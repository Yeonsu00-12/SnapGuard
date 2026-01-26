import { RefreshCw } from "lucide-react";

export default function LoadingSpinner() {
    return (
        <div className="h-full flex flex-col items-center justify-center space-y-8 animate-fade-in text-center">
            <div className="relative">
              <div className="w-40 h-40 bg-blue-50 rounded-full animate-ping absolute inset-0 opacity-40" />
              <div className="w-40 h-40 border-4 border-blue-600 rounded-full flex items-center justify-center bg-white shadow-2xl relative">
                <RefreshCw size={56} className="text-blue-600 animate-spin" />
              </div>
            </div>
            <div>
              <h2 className="text-xl font-bold mb-2 text-slate-800">네트워크 스캔 중...</h2>
              <p className="text-slate-400">
                연결된 CCTV 장비를
                <br />
                찾고 있습니다.
              </p>
            </div>
        </div>
    )
}