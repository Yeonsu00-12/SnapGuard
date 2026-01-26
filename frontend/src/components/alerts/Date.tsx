import { BarChart3, Calendar, List } from "lucide-react";
import { useState } from "react";

export default function DateContainer({ selectedDate, setSelectedDate, viewMode, setViewMode }: { selectedDate: Date; setSelectedDate: (date: Date) => void; viewMode: string; setViewMode: (mode: string) => void }) {
    return (
        <div className="flex flex-row justify-between items-center w-full gap-4">
            <div className="flex w-full items-center justify-center gap-4 py-1 bg-white rounded-lg">
                <button
                    onClick={() => {
                        const newDate = new Date(selectedDate);
                        newDate.setDate(newDate.getDate() - 1);
                        setSelectedDate(newDate);
                    }}
                    className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-gray-100 transition-colors"
                >
                    <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                    </svg>
                </button>

                <button
                    onClick={() => setSelectedDate(new Date())}
                    className="text-center min-w-[140px] flex flex-row gap-2 items-center justify-center"
                >
                    <Calendar className="text-blue-500" size={18} />
                    <p className="text-md font-bold text-gray-900">
                        {selectedDate.toLocaleDateString("ko-KR", { month: "long", day: "numeric" })}
                    </p>
                    <p className="text-xs text-gray-400">
                        ({selectedDate.toDateString() === new Date().toDateString()
                            ? "오늘"
                            : selectedDate.toLocaleDateString("ko-KR", { weekday: "long" }).slice(0, 1)})
                    </p>
                </button>

                <button
                    onClick={() => {
                        const newDate = new Date(selectedDate);
                        newDate.setDate(newDate.getDate() + 1);
                        // 미래 날짜는 오늘까지만
                        if (newDate <= new Date()) {
                            setSelectedDate(newDate);
                        }
                    }}
                    disabled={selectedDate.toDateString() === new Date().toDateString()}
                    className={`w-10 h-10 flex items-center justify-center rounded-full transition-colors ${selectedDate.toDateString() === new Date().toDateString()
                        ? "text-gray-300 cursor-not-allowed"
                        : "hover:bg-gray-100 text-gray-600"
                        }`}
                >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                </button>
            </div>
            {/* <div className="flex flex-row gap-2 bg-slate-200/60 p-2 rounded-md text-sm whitespace-nowrap">
                <button onClick={() => setViewMode('list')} className={`px-2 py-1 rounded-md cursor-pointer transition-colors ${viewMode === 'list' ? 'bg-white text-blue-600 shadow-sm ring-1 ring-black/5' : 'text-slate-500 hover:bg-slate-200/50'}`}>
                    <List size={16} className="inline-block mr-1" />
                    목록
                </button>
                <button onClick={() => setViewMode('chart')} className={`px-2 py-1 rounded-md cursor-pointer transition-colors ${viewMode === 'chart' ? 'bg-white text-blue-600 shadow-sm ring-1 ring-black/5' : 'text-slate-500 hover:bg-slate-200/50'}`}>
                    <BarChart3 size={16} className="inline-block mr-1" />
                    통계
                </button>
            </div> */}
        </div>
    )
}