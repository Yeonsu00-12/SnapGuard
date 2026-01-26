import { Activity } from "lucide-react";
import { useRouter } from "next/navigation";

export default function AlarmFeedHeader() {
    const router = useRouter();
    return (
        <div className="flex justify-between items-center px-1">
            <h2 className="font-bold text-slate-800 flex items-center gap-2">
                <Activity size={18} className="text-blue-600" /> 실시간 알림 피드
            </h2>
            <button
                onClick={() => router.push("/alerts")}
                className="text-[10px] font-bold text-slate-400"
            >
                전체보기
            </button>
        </div>
    )
}