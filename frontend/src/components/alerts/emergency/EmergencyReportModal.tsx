"use client";

import { useState, useEffect } from "react";

interface EmergencyReportModalProps {
  alarm: Alarm;
  onClose: () => void;
  reportedAlarms: Map<string, string>; // alarmId -> reported time
  onReport: (alarmId: string, time: string) => void;
}

export default function EmergencyReportModal({
  alarm,
  onClose,
  reportedAlarms,
  onReport,
}: EmergencyReportModalProps) {
  const [step, setStep] = useState<"preview" | "confirm" | "complete">("preview");
  const [currentTime, setCurrentTime] = useState("");

  const siteName = (alarm.camera as any).site?.name || alarm.siteName || alarm.camera.name;
  const siteAddress = (alarm.camera as any).site?.address || "주소 정보 없음";
  const cameraName = alarm.camera.name;
  const eventType = alarm.eventType.replace(/_/g, " ");

  // 이미 신고된 알람인지 확인
  const alreadyReported = reportedAlarms.has(alarm.id);
  const reportedTime = reportedAlarms.get(alarm.id);

  useEffect(() => {
    const time = new Date(alarm.detectionTime);
    setCurrentTime(
      time.toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" })
    );
  }, [alarm.detectionTime]);

  const handleReport = () => {
    if (alreadyReported) return;
    setStep("confirm");
  };

  const handleConfirmReport = () => {
    // 신고 처리
    const reportTime = new Date().toLocaleTimeString("ko-KR", {
      hour: "2-digit",
      minute: "2-digit",
    });
    onReport(alarm.id, reportTime);
    setStep("complete");

    // SMS 메시지 생성
    const message = `[침입 신고]
주소: ${siteAddress}
시간: ${currentTime}
카메라: ${cameraName}
상황: 영업 외 시간 ${eventType} 감지

* CCTV로 상황 확인 후 신고합니다.`;

    // SMS 앱 열기 (내용 미리 채움)
    const phoneNumber = "01065724924"; // 112 대신 실제 신고 번호 사용
    const smsUrl = `sms:${phoneNumber}?body=${encodeURIComponent(message)}`;
    window.location.href = smsUrl;
  };

  const handleCancelReport = () => {
    setStep("preview");
  };

  return (
    <div
      className="fixed inset-0 bg-black/80 z-[70] flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-3xl w-full max-w-md overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-blue-500 px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-red-500 rounded-full flex items-center justify-center">
              <svg className="w-4 h-4 text-white" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 15h2v-2h-2v2zm0-4h2V7h-2v6z"/>
              </svg>
            </div>
            <span className="text-white font-bold text-lg">메시지 미리보기</span>
          </div>
          <span className="text-white/80 text-sm">{currentTime}</span>
        </div>

        {/* Content */}
        <div className="p-6">
          {step === "preview" && (
            <>
              {/* 이미 신고된 경우 경고 */}
              {alreadyReported && (
                <div className="mb-4 p-4 bg-yellow-50 border border-yellow-200 rounded-xl">
                  <div className="flex items-center gap-2 text-yellow-700">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                    <span className="font-medium">이미 {reportedTime}에 신고가 전송되었습니다</span>
                  </div>
                  <p className="text-yellow-600 text-sm mt-1">중복 신고는 불필요한 공권력 낭비를 초래할 수 있습니다.</p>
                </div>
              )}

              {/* Message Template */}
              <div className="bg-slate-50 rounded-2xl p-5 border border-slate-200">
                <h3 className="font-bold text-slate-800 mb-4">[침입 신고]</h3>

                <div className="space-y-3 text-slate-700">
                  <div className="flex">
                    <span className="w-16 text-slate-500 flex-shrink-0">주소:</span>
                    <span className="font-medium">{siteAddress}</span>
                  </div>
                  <div className="flex">
                    <span className="w-16 text-slate-500 flex-shrink-0">시간:</span>
                    <span className="font-medium">{currentTime}</span>
                  </div>
                  <div className="flex">
                    <span className="w-16 text-slate-500 flex-shrink-0">카메라:</span>
                    <span className="font-medium">{cameraName}</span>
                  </div>
                  <div className="flex">
                    <span className="w-16 text-slate-500 flex-shrink-0">상황:</span>
                    <span className="font-medium">영업 외 시간 {eventType} 감지</span>
                  </div>
                </div>

                <p className="text-slate-400 text-sm mt-4">
                  * 현재 CCTV로 상황 확인 후 신고합니다.
                </p>
              </div>

              {/* Buttons */}
              <div className="mt-6 grid grid-cols-2 gap-3">
                <button
                  onClick={onClose}
                  className="py-4 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-xl font-medium transition-all"
                >
                  취소
                </button>
                <button
                  onClick={handleReport}
                  disabled={alreadyReported}
                  className={`py-4 rounded-xl font-medium transition-all flex items-center justify-center gap-2 ${
                    alreadyReported
                      ? "bg-gray-300 text-gray-500 cursor-not-allowed"
                      : "bg-red-500 hover:bg-red-600 text-white"
                  }`}
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                  </svg>
                  112 신고
                </button>
              </div>
            </>
          )}

          {step === "confirm" && (
            <>
              {/* Confirmation */}
              <div className="text-center py-4">
                <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg className="w-8 h-8 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                </div>
                <h3 className="text-xl font-bold text-slate-800 mb-2">112에 신고하시겠습니까?</h3>
                <p className="text-slate-500">
                  허위 신고는 법적 처벌의 대상이 될 수 있습니다.
                  <br />
                  실제 상황인지 확인 후 신고해주세요.
                </p>
              </div>

              {/* Buttons */}
              <div className="mt-6 grid grid-cols-2 gap-3">
                <button
                  onClick={handleCancelReport}
                  className="py-4 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-xl font-medium transition-all"
                >
                  취소
                </button>
                <button
                  onClick={handleConfirmReport}
                  className="py-4 bg-red-500 hover:bg-red-600 text-white rounded-xl font-bold transition-all"
                >
                  신고하기
                </button>
              </div>
            </>
          )}

          {step === "complete" && (
            <>
              {/* Complete */}
              <div className="text-center py-4">
                <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg className="w-8 h-8 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <h3 className="text-xl font-bold text-slate-800 mb-2">문자 앱이 열렸습니다</h3>
                <p className="text-slate-500">
                  메시지 내용을 확인하고
                  <br />
                  <strong className="text-red-500">전송 버튼</strong>을 눌러주세요.
                </p>
              </div>

              {/* Button */}
              <div className="mt-6">
                <button
                  onClick={onClose}
                  className="w-full py-4 bg-blue-500 hover:bg-blue-600 text-white rounded-xl font-medium transition-all"
                >
                  확인
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
