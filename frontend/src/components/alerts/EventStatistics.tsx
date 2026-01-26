"use client";

import { useState, useEffect } from "react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { api } from "@/lib/api";
import { getDateRange } from "@/lib/timeformatter";
import { MoveDownRight, MoveUpRight } from "lucide-react";
import LineChart from "./LineChart";

interface Alarm {
    id: string;
    cameraId: string;
    detectionTime: string;
}

interface Report {
    id: string;
    createdAt: string;
}

interface EventStatisticsProps {
    selectedDate: Date;
}

export default function EventStatistics({ selectedDate }: EventStatisticsProps) {
    const [selectedPeriod, setSelectedPeriod] = useState("1");
    const [loading, setLoading] = useState(true);
    const [totalEvents, setTotalEvents] = useState(0);
    const [prevEvents, setPrevEvents] = useState(0);
    const [reportCount, setReportCount] = useState(0);
    const [eventCameras, setEventCameras] = useState(0);
    const [totalCameras, setTotalCameras] = useState(0);
    const [hourlyData, setHourlyData] = useState<number[]>(Array(24).fill(0));

    useEffect(() => {
        loadStatistics();
    }, [selectedPeriod, selectedDate]);

    const loadStatistics = async () => {
        try {
            setLoading(true);
            const { start, end, prevStart, prevEnd } = getDateRange(selectedPeriod, selectedDate);

            const [currentAlarmsData, prevAlarmsData, camerasData, reportsData] = await Promise.all([
                api.getAlarms({ startDate: start.toISOString(), endDate: end.toISOString(), limit: "10000" }),
                api.getAlarms({ startDate: prevStart.toISOString(), endDate: prevEnd.toISOString(), limit: "10000" }),
                api.getCameras(),
                api.getReports(),
            ]);

            setTotalEvents(currentAlarmsData.total || currentAlarmsData.alarms.length);
            setPrevEvents(prevAlarmsData.total || prevAlarmsData.alarms.length);
            setTotalCameras(camerasData.length);

            const uniqueCameras = new Set(currentAlarmsData.alarms.map((a: Alarm) => a.cameraId));
            setEventCameras(uniqueCameras.size);

            const filteredReports = (reportsData as Report[]).filter((report) => {
                const reportDate = new Date(report.createdAt);
                return reportDate >= start && reportDate <= end;
            });
            setReportCount(filteredReports.length);

            // 시간대별 이벤트 집계
            const hourCounts = Array(24).fill(0);
            currentAlarmsData.alarms.forEach((alarm: Alarm) => {
                const hour = new Date(alarm.detectionTime).getHours();
                hourCounts[hour]++;
            });
            setHourlyData(hourCounts);
        } catch (error) {
            console.error("Failed to load statistics:", error);
        } finally {
            setLoading(false);
        }
    };

    const getChangeRate = () => {
        if (prevEvents === 0) return { rate: totalEvents > 0 ? 100 : 0, isIncrease: totalEvents > 0 };
        const rate = Math.round(((totalEvents - prevEvents) / prevEvents) * 100);
        return { rate: Math.abs(rate), isIncrease: rate >= 0 };
    };

    const { rate, isIncrease } = getChangeRate();
    const periodLabel = selectedPeriod === "1" ? "지난일" : selectedPeriod === "7" ? "저번주" : "저번달";

    return (
        <div className="flex flex-col gap-6 w-full">
            <Tabs value={selectedPeriod} onValueChange={setSelectedPeriod} className="w-full flex justify-end">
                <TabsList>
                    <TabsTrigger value="1">오늘</TabsTrigger>
                    <TabsTrigger value="7">이번주</TabsTrigger>
                    <TabsTrigger value="30">이번달</TabsTrigger>
                </TabsList>
            </Tabs>

            {loading ? (
                <div className="flex flex-col gap-4">
                    <div className="grid grid-cols-2 gap-4">
                        {[1, 2].map((i) => (
                            <div key={i} className="bg-white p-6 rounded-xl border border-slate-100 shadow-sm animate-pulse">
                                <div className="h-4 bg-slate-200 rounded w-24 mb-3"></div>
                                <div className="h-8 bg-slate-200 rounded w-16 mb-2"></div>
                                <div className="h-3 bg-slate-200 rounded w-32"></div>
                            </div>
                        ))}
                    </div>
                    <div className="bg-white p-6 rounded-xl border border-slate-100 shadow-sm animate-pulse h-64"></div>
                </div>
            ) : (
                <div className="flex flex-col gap-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div className="bg-white p-6 rounded-xl border border-slate-100 shadow-sm">
                            <p className="text-xs font-medium text-slate-500 mb-2">총 발생 이벤트</p>
                            <p className="text-3xl font-bold text-slate-800 mb-2">{totalEvents.toLocaleString()}건</p>
                            <p className={`flex flex-row items-center text-sm gap-1 ${isIncrease ? "text-red-500" : Number(isIncrease) === 0 ? "text-text" : "text-blue-500"}`}>
                                {isIncrease ? <MoveUpRight size={14} /> : Number(isIncrease) === 0 ? "" : <MoveDownRight size={14} />}
                                {periodLabel} 대비 {isIncrease ? "+" : Number(isIncrease) === 0 ? "" : "-"}{rate}%
                            </p>
                            <p className="text-sm text-slate-500 mt-2">신고 건수: {reportCount}건</p>
                        </div>

                        <div className="bg-white p-6 rounded-xl border border-slate-100 shadow-sm">
                            <p className="text-xs font-medium text-slate-500 mb-2">총 감지된 카메라</p>
                            <p className="text-3xl font-bold text-slate-800 mb-2">{eventCameras}대</p>
                            <p className="text-sm text-slate-500">전체 {totalCameras}대 가동중</p>
                        </div>
                    </div>

                    <LineChart hourlyData={hourlyData} />
                </div>
            )}
        </div>
    );
}
