"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { api } from "@/lib/api";
import EventTimeline from "@/components/EventTimeline";
import ReportModal from "@/components/ReportModal";
import EmergencyReportModal from "@/components/alerts/emergency/EmergencyReportModal";
import DetailAlarm from "@/components/alerts/DetailAlarm";
import AlertHeader from "@/components/alerts/AlertHeader";
import DateContainer from "@/components/alerts/Date";
import FilterTag from "@/components/alerts/FilterTag";
import EventStatistics from "@/components/alerts/EventStatistics";

export default function AlertsPage() {
  const searchParams = useSearchParams();
  const [alarms, setAlarms] = useState<Alarm[]>([]);
  const [cameras, setCameras] = useState<Camera[]>([]);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [selectedCamera, setSelectedCamera] = useState<string | null>(null);
  const [selectedAlarm, setSelectedAlarm] = useState<Alarm | null>(null);
  const [reportAlarm, setReportAlarm] = useState<Alarm | null>(null);
  const [emergencyAlarm, setEmergencyAlarm] = useState<Alarm | null>(null);
  const [reportedAlarms, setReportedAlarms] = useState<Map<string, string>>(new Map());
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState('list');

  // URL에서 alarmId 쿼리 파라미터 처리
  useEffect(() => {
    const alarmId = searchParams.get("alarmId");
    if (alarmId) {
      // 특정 알람 상세 조회
      api.getAlarm(alarmId).then((alarm) => {
        setSelectedAlarm(alarm);
        // 해당 알람의 날짜로 이동
        setSelectedDate(new Date(alarm.detectionTime));
      }).catch((error) => {
        console.error("Failed to load alarm:", error);
      });
    }
  }, [searchParams]);

  useEffect(() => {
    loadData();
  }, [selectedDate, selectedCamera]);

  const loadData = async () => {
    try {
      const startDate = new Date(selectedDate);
      startDate.setHours(0, 0, 0, 0);

      const endDate = new Date(selectedDate);
      endDate.setHours(23, 59, 59, 999);

      const params: any = {
        limit: "100",
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
      };

      if (selectedCamera) {
        params.cameraId = selectedCamera;
      }

      const [alarmsData, camerasData] = await Promise.all([
        api.getAlarms(params),
        api.getCameras(),
      ]);

      setAlarms(alarmsData.alarms);
      setCameras(camerasData);
    } catch (error) {
      console.error("Failed to load alarms:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleAlarmClick = async (alarm: Alarm) => {
    setSelectedAlarm(alarm);

    // NEW 상태인 경우 ACKNOWLEDGED로 변경
    if (alarm.status === "NEW") {
      try {
        await api.updateAlarmStatus(alarm.id, "ACKNOWLEDGED");
        // 알람 목록에서 상태 업데이트
        setAlarms((prev) =>
          prev.map((a) => (a.id === alarm.id ? { ...a, status: "ACKNOWLEDGED" } : a))
        );
        // 알람 읽음 이벤트 발생 (BottomNav 카운트 업데이트)
        window.dispatchEvent(new CustomEvent("alarm-read"));
      } catch (error) {
        console.error("Failed to update alarm status:", error);
      }
    }
  };

  const closeModal = () => {
    setSelectedAlarm(null);
  };

  if (loading && alarms.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="p-4 space-y-4">
      {/* Header */}
      <AlertHeader selectedDate={selectedDate} alarms={alarms} viewMode={viewMode} setViewMode={setViewMode} />

      {/* Date Navigation */}
      <DateContainer selectedDate={selectedDate} setSelectedDate={setSelectedDate} viewMode={viewMode} setViewMode={setViewMode} />

      {viewMode === 'list' ?
        (<>
          {/* Camera Filter */}
          <FilterTag selectedCamera={selectedCamera} setSelectedCamera={setSelectedCamera} cameras={cameras} />

          {/* Event Timeline */}
          <EventTimeline
            reportedAlarms={reportedAlarms}
            alarms={alarms}
            onAlarmClick={handleAlarmClick}
            onEmergencyClick={(alarm) => setEmergencyAlarm(alarm)}
          />
        </>) : (
          <EventStatistics selectedDate={selectedDate} />
        )}

      {/* Report Modal */}
      {reportAlarm && (
        <ReportModal
          alarm={reportAlarm}
          onClose={() => setReportAlarm(null)}
        />
      )}

      {/* Emergency Report Modal (112) */}
      {emergencyAlarm && (
        <EmergencyReportModal
          alarm={emergencyAlarm}
          onClose={() => setEmergencyAlarm(null)}
          reportedAlarms={reportedAlarms}
          onReport={(alarmId, time) => {
            setReportedAlarms(new Map(reportedAlarms.set(alarmId, time)));
          }}
        />
      )}

      {/* Event Detail Modal */}
      {selectedAlarm && (
        <DetailAlarm selectedAlarm={{ ...selectedAlarm, videoPath: null }} closeModal={() => setSelectedAlarm(null)} onReportClick={(alarm) => setReportAlarm(alarm)} />
      )}
    </div>
  );
}
