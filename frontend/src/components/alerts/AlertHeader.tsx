import { BarChart3, List } from "lucide-react";

export default function AlertHeader({ selectedDate, alarms, viewMode, setViewMode }: { selectedDate: Date; alarms: any[]; viewMode: string; setViewMode: (mode: string) => void }) {
    return (
        <div className="flex items-center justify-between mb-2">
            <h1 className="text-xl font-bold text-text">{viewMode === 'list' ? '이벤트 목록' : '이벤트 통계'}</h1>
            <div className="flex flex-row gap-2 items-center">
                {/* <span className="text-sm text-gray-400">
                    {selectedDate.toLocaleDateString("ko-KR", { month: "short", day: "numeric" })} · {alarms.length}건
                </span> */}

                <div className="flex flex-row gap-2 p-1 bg-slate-200/60 rounded-md text-sm whitespace-nowrap">
                    <button onClick={() => setViewMode('list')} className={`px-2 py-1 rounded-md cursor-pointer transition-colors ${viewMode === 'list' ? 'bg-white text-blue-600 shadow-sm ring-1 ring-black/5' : 'text-slate-500 hover:bg-slate-200/50'}`}>
                        <List size={16} className="inline-block mr-1" />
                        목록
                    </button>
                    <button onClick={() => setViewMode('chart')} className={`px-2 py-1 rounded-md cursor-pointer transition-colors ${viewMode === 'chart' ? 'bg-white text-blue-600 shadow-sm ring-1 ring-black/5' : 'text-slate-500 hover:bg-slate-200/50'}`}>
                        <BarChart3 size={16} className="inline-block mr-1" />
                        통계
                    </button>
                </div>
            </div>
        </div>
    )
}