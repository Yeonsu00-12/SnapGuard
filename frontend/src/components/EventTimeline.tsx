"use client";

import { Calendar, MessageSquare, Siren } from "lucide-react";
import Image from "next/image";

interface EventTimelineProps {
  alarms: Alarm[];
  reportedAlarms: Map<string, string>;
  onAlarmClick?: (alarm: Alarm) => void;
  onReportClick?: (alarm: Alarm) => void;
  onEmergencyClick?: (alarm: Alarm) => void;
}

export default function EventTimeline({
  alarms,
  reportedAlarms,
  onAlarmClick,
  onReportClick,
  onEmergencyClick,
}: EventTimelineProps) {
  const formatDateTime = (dateString: string) => {
    const date = new Date(dateString);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    const hours = String(date.getHours()).padStart(2, "0");
    const minutes = String(date.getMinutes()).padStart(2, "0");

    return `${year}/${month}/${day} ${hours}:${minutes}`;
  };

  // 이벤트 타입에 따른 아이콘 반환
  const getEventIcon = (eventType: string) => {
    // 기본 경고 아이콘
    return (
      <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24">
        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 15h2v-2h-2v2zm0-4h2V7h-2v6z" />
      </svg>
    );
  };

  // 이벤트 타입 한글 변환
  const getEventTypeLabel = (eventType: string) => {
    const labels: Record<string, string> = {
      "MOTION_DETECTED": "움직임 감지",
      "INTRUSION": "침입 감지",
      "LINE_CROSSING": "라인 통과",
      "MOTION": "움직임",
    };
    return labels[eventType] || eventType.replace(/_/g, " ");
  };

  // 스냅샷 URL 가져오기 (snapshotWithBox 우선)
  const getSnapshotUrl = (alarm: Alarm) => {
    const path = alarm.snapshotPath;
    if (!path) return null;
    const baseUrl = process.env.NEXT_PUBLIC_API_URL?.replace("/api", "") || "";
    const relativePath = path.includes("/uploads/")
      ? path.substring(path.indexOf("/uploads/"))
      : path;
    return `${baseUrl}${relativePath}`;
  };

  return (
    <>
      {/* <div className="text-end text-sm text-gray-600">
        알림 발생 <strong className="text-red-500">{alarms.length}건</strong>
      </div> */}
      <div className="space-y-3">
        {alarms.length === 0 ? (
          <div className="bg-white rounded-[28px] p-8 text-center border border-slate-100">
            <div className="w-12 h-12 rounded-full bg-green-50 flex items-center justify-center mx-auto mb-3">
              <svg className="w-6 h-6 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <p className="text-gray-400">이벤트가 없습니다.</p>
          </div>
        ) : (
          alarms.map((alarm, index) => (
            <div
              key={alarm.id}
              onClick={() => onAlarmClick?.(alarm)}
              className={`relative bg-white rounded-2xl p-4 border drop-shadow hover:border-gray-600 transition-all cursor-pointer ${index === 0 && alarm.status === "NEW" ? "ring-2 ring-red-500 ring-offset-2" : ""
                }`}
            >
              {/* 최신 배지 - NEW 상태일 때만 표시 */}
              {index === 0 && alarm.status === "NEW" && (
                <div className="absolute -top-2 -left-2 px-2 py-1 bg-red-500 text-white text-[10px] font-black rounded-full animate-pulse">
                  최신
                </div>
              )}
              <div className="flex items-center gap-4">
                {/* Thumbnail with Detection Overlay */}
                <div className={`relative flex-shrink-0 w-24 h-24 bg-gray-900 rounded-md overflow-hidden`}>
                  {getSnapshotUrl(alarm) ? (
                    <Image
                      width={96}
                      height={96}
                      src={getSnapshotUrl(alarm)!}
                      alt="Event"
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <svg className="w-8 h-8 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                    </div>
                  )}
                </div>

                {/* Info */}
                <div className="flex-1 flex min-w-0 flex-col gap-6 justify-between h-full">
                  <div>
                    <div className="flex items-center flex-row gap-2 justify-between">
                      <div className="flex flex-row gap-2 items-center">
                        <p className="text-md font-bold text-text">{(alarm.camera as any).site?.name || alarm.siteName || ""}</p>
                        <p className="text-xs text-gray-400">{alarm.camera.name}</p>
                      </div>
                    </div>
                  </div>
                  <div>
                    {/* Event Type Badge */}
                    <div className="flex items-center gap-2">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium ${Boolean(alarm.severity)
                        && "bg-red-100 text-red-700"
                        }`}>
                        {getEventIcon(alarm.eventType)}
                        {getEventTypeLabel(alarm.eventType)}
                      </span>
                    </div>
                    <div className="flex flex-row justify-between items-center">
                      {/* DateTime */}
                      <div className="text-xs text-gray-400 whitespace-nowrap flex flex-row items-center">
                        <Calendar className="inline w-3 h-3 mr-1" />
                        <p>{formatDateTime(alarm.detectionTime)}</p>
                      </div>
                      {/* Call Button / 신고완료 표시 */}
                      {reportedAlarms.has(alarm.id) ? (
                        <div className="flex-shrink-0 flex flex-col">
                          <span className="text-xs font-bold text-blue-600">
                            {reportedAlarms.get(alarm.id)} 신고완료
                          </span>
                        </div>
                      ) : (
                        <div className="flex-shrink-0 flex flex-col items-center justify-center">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onEmergencyClick?.(alarm);
                            }}
                            className=" flex flex-row items-center gap-1 bg-red-100 rounded-md py-1 px-2 hover:bg-red-50 transition"
                          >
                            <MessageSquare className="w-3 h-3 text-red-500" fill="red" />
                            <span className="text-xs text-red-500 font-semibold">신고</span>
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </>
  );
}