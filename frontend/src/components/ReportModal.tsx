"use client";

import { useState, useRef } from "react";
import Image from "next/image";
import { api } from "@/lib/api";

interface ReportModalProps {
  alarm: Alarm;
  onClose: () => void;
}

export default function ReportModal({ alarm, onClose }: ReportModalProps) {
  const [loading, setLoading] = useState(false);
  const [attentionOf, setAttentionOf] = useState("");
  const [authorizedBy, setAuthorizedBy] = useState("");
  const [incidentType, setIncidentType] = useState("");
  const [incidentSubCategory, setIncidentSubCategory] = useState("");
  const [policeReference, setPoliceReference] = useState("");
  const [createdBy, setCreatedBy] = useState("");
  const [notes, setNotes] = useState("");
  const [reportCreated, setReportCreated] = useState(false);
  const [reportData, setReportData] = useState<any>(null);
  const printRef = useRef<HTMLDivElement>(null);

  const siteName = (alarm.camera as any).site?.name || alarm.siteName || alarm.camera.name;
  const siteAddress = (alarm.camera as any).site?.address || "";

  const formatDateTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString("ko-KR", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  };

  const handleCreateReport = async () => {
    setLoading(true);
    try {
      const report = await api.createReport({
        alarmIds: [alarm.id],
        createdBy: createdBy || undefined,
        attentionOf: attentionOf || undefined,
        authorizedBy: authorizedBy || undefined,
        incidentType: incidentType || undefined,
        incidentSubCategory: incidentSubCategory || undefined,
        policeReference: policeReference || undefined,
        notes: notes || undefined,
      });

      setReportData(report);
      setReportCreated(true);
    } catch (error) {
      console.error("Failed to create report:", error);
      alert("리포트 생성에 실패했습니다.");
    } finally {
      setLoading(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const getSnapshotUrl = () => {
    if (!alarm.snapshotPath) return null;
    const baseUrl = process.env.NEXT_PUBLIC_API_URL?.replace("/api", "") || "";
    const path = alarm.snapshotPath.includes("/uploads/")
      ? alarm.snapshotPath.substring(alarm.snapshotPath.indexOf("/uploads/"))
      : alarm.snapshotPath;
    return `${baseUrl}${path}`;
  };

  return (
    <div
      className="fixed inset-0 bg-black/80 z-[70] flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Print-friendly content */}
        <div ref={printRef} className="p-6 print:p-8">
          {/* Header */}
          <div className="text-center mb-6 border-b pb-4">
            <h1 className="text-xl font-bold text-gray-900">
              보안 사고 보고서
            </h1>
          </div>

          {/* Info Grid */}
          <div className="grid grid-cols-2 gap-4 mb-6">
            <div>
              <label className="text-xs text-gray-400">지점명</label>
              <p className="text-sm text-gray-900">{siteName || "No Data"}</p>
            </div>
            <div>
              <label className="text-xs text-gray-400">발생 시간</label>
              <p className="text-sm text-gray-900">{formatDateTime(alarm.detectionTime)}</p>
            </div>
            <div>
              <label className="text-xs text-gray-400">지점 주소</label>
              <p className="text-sm text-gray-900">{siteAddress || "No Data"}</p>
            </div>
            <div>
              <label className="text-xs text-gray-400">보고서 작성 시간</label>
              <p className="text-sm text-gray-900">{formatDateTime(new Date().toISOString())}</p>
            </div>
            <div>
              <label className="text-xs text-gray-400">Police Reference</label>
              {reportCreated ? (
                <p className="text-sm text-gray-900">{policeReference || "No Data"}</p>
              ) : (
                <input
                  type="text"
                  value={policeReference}
                  onChange={(e) => setPoliceReference(e.target.value)}
                  className="w-full text-sm border rounded px-2 py-1 text-gray-900"
                  placeholder="경찰 참조번호"
                />
              )}
            </div>
            <div>
              <label className="text-xs text-gray-400">Created by</label>
              {reportCreated ? (
                <p className="text-sm text-gray-900">{createdBy || "No Data"}</p>
              ) : (
                <input
                  type="text"
                  value={createdBy}
                  onChange={(e) => setCreatedBy(e.target.value)}
                  className="w-full text-sm border rounded px-2 py-1 text-gray-900"
                  placeholder="작성자"
                />
              )}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4 mb-6">
            <div>
              <label className="text-xs text-gray-400">Incident Type</label>
              {reportCreated ? (
                <span className="inline-block mt-1 px-3 py-1 bg-gray-100 text-gray-600 rounded text-sm">
                  {incidentType || "No Data"}
                </span>
              ) : (
                <select
                  value={incidentType}
                  onChange={(e) => setIncidentType(e.target.value)}
                  className="w-full text-sm border rounded px-2 py-1 text-gray-900"
                >
                  <option value="">선택하세요</option>
                  <option value="침입">침입</option>
                </select>
              )}
            </div>
          </div>

          {/* Events Section */}
          <div className="border-t pt-4 w-full">
            <div className="flex border-b">
              <div className="flex-1 py-2 text-center font-medium text-gray-700 border-b-2 border-blue-500">
                이벤트
              </div>
            </div>

            <div className="py-4 w-full grid grid-cols-2">
              <div className="flex flex-col justify-center">
                {/* Event Item */}
                <div className="text-sm font-medium text-gray-900">
                  {formatDateTime(alarm.detectionTime)}
                </div>
                <div className="text-sm font-medium text-blue-600 mt-1">
                  {siteName}
                </div>
                <div className="text-xs text-gray-600">
                  {alarm.eventType.replace(/_/g, " ")}
                </div>

                {/* Alarm Info */}
                <div className="mt-3 flex items-center gap-2">
                  <span className="text-xs text-gray-500">
                    {formatDateTime(alarm.detectionTime)}
                  </span>
                </div>
                <div className="text-xs text-gray-600 mt-1">
                  {alarm.camera.name}
                </div>
                <div className="mt-1">
                  <span className={`px-2 py-0.5 text-xs rounded bg-green-100 text-green-700
                      }`}>
                    확인됨
                  </span>
                </div>
              </div>

              <div className="flex">
                {/* Snapshot */}
                {getSnapshotUrl() && (
                  <div className="mt-3 rounded-lg overflow-hidden border max-w-[300px]">
                    <Image
                      width={300}
                      height={200}
                      src={getSnapshotUrl()!}
                      alt="Event snapshot"
                      className="w-full h-auto object-cover"
                    />
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Action Buttons (not printed) */}
        <div className="p-4 border-t flex gap-3 print:hidden">
          <button
            onClick={onClose}
            className="flex-1 py-3 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-xl font-medium transition-all"
          >
            닫기
          </button>
          {reportCreated ? (
            <button
              onClick={handlePrint}
              className="flex-1 py-3 bg-blue-500 hover:bg-blue-600 text-white rounded-xl font-medium transition-all flex items-center justify-center gap-2"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
              </svg>
              인쇄 / PDF 저장
            </button>
          ) : (
            <button
              onClick={handleCreateReport}
              disabled={loading}
              className="flex-1 py-3 bg-blue-500 hover:bg-blue-600 text-white rounded-xl font-medium transition-all disabled:opacity-50"
            >
              {loading ? "생성 중..." : "리포트 생성"}
            </button>
          )}
        </div>
      </div>

      {/* Print Styles */}
      <style jsx global>{`
        @media print {
          body * {
            visibility: hidden;
          }
          .print\\:p-8,
          .print\\:p-8 * {
            visibility: visible;
          }
          .print\\:p-8 {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
          }
          .print\\:hidden {
            display: none !important;
          }
        }
      `}</style>
    </div>
  );
}
