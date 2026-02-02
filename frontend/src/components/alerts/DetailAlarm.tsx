"use client";

import { Siren } from "lucide-react";
import Image from "next/image";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "@/components/ui/carousel";

interface DetailAlarmProps {
  selectedAlarm: Alarm & {
    videoPath: string | null;
  };
  closeModal: () => void;
  onReportClick?: (alarm: Alarm) => void;
}

const getMediaUrl = (path: string | null) => {
  if (!path) return null;
  if (path.includes("/uploads/")) {
    return path.substring(path.indexOf("/uploads/"));
  }
  return `/uploads/snapshots/${path.split("/").pop()}`;
};

export default function DetailAlarm({ selectedAlarm, closeModal, onReportClick }: DetailAlarmProps) {
  const snapshotUrl = getMediaUrl(selectedAlarm.snapshotPath ?? null);
  const videoUrl = getMediaUrl(selectedAlarm?.videoPath);

  const mediaItems: { type: "image" | "video"; url: string }[] = [];
  if (snapshotUrl) {
    mediaItems.push({ type: "image", url: snapshotUrl });
  }
  if (videoUrl) {
    mediaItems.push({ type: "video", url: videoUrl });
  }

  const hasMultipleMedia = mediaItems.length > 1;

  return (
    <div
      className="fixed top-0 left-0 right-0 bottom-0 bg-black/80 z-[60] flex items-end justify-center"
      style={{ margin: 0, padding: 0 }}
      onClick={closeModal}
    >
      <div
        className="bg-white rounded-t-3xl w-full max-w-lg max-h-[90vh] overflow-y-auto m-0"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Media Carousel */}
        <div className="relative aspect-video bg-black rounded-t-3xl overflow-hidden">
          {mediaItems.length > 0 ? (
            hasMultipleMedia ? (
              <Carousel className="w-full h-full">
                <CarouselContent className="h-full">
                  {mediaItems.map((item, index) => (
                    <CarouselItem key={index} className="h-full">
                      {item.type === "image" ? (
                        <Image
                          width={400}
                          height={300}
                          src={item.url}
                          alt="Event snapshot"
                          className="w-full h-full object-contain"
                        />
                      ) : (
                        <video
                          src={item.url}
                          controls
                          className="w-full h-full object-contain"
                        >
                          Your browser does not support the video tag.
                        </video>
                      )}
                    </CarouselItem>
                  ))}
                </CarouselContent>
                <CarouselPrevious className="left-2 bg-black/50 border-none text-white hover:bg-black/70" />
                <CarouselNext className="right-2 bg-black/50 border-none text-white hover:bg-black/70" />
              </Carousel>
            ) : (
              // 미디어가 1개일 때
              mediaItems[0].type === "image" ? (
                <Image
                  width={400}
                  height={300}
                  src={mediaItems[0].url}
                  alt="Event snapshot"

                  className="w-full h-full object-contain"
                />
              ) : (
                <video
                  src={mediaItems[0].url}
                  controls
                  className="w-full h-full object-contain"
                >
                  Your browser does not support the video tag.
                </video>
              )
            )
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <svg className="w-12 h-12 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
          )}

          {/* Close button */}
          <button
            onClick={closeModal}
            className="absolute top-4 right-4 w-10 h-10 rounded-full bg-black/50 flex items-center justify-center z-10"
          >
            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="border-b-4 border-red-400" />

        {/* Details */}
        <div className="p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-text">
              {selectedAlarm.camera.site?.name}
            </h2>
            <span
              className={`flex flex-row items-center gap-2 px-3 py-1 rounded-full text-sm font-medium bg-red-500/20 text-red-400`}
            >
              <Siren size={16} />
            </span>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="bg-[#F9F9FB] rounded-xl p-3">
              <p className="text-xs text-[#55566F]">카메라 이름</p>
              <p className="text-sm text-[#14141C] font-medium">{selectedAlarm.camera.name}</p>
            </div>
            <div className="bg-[#F9F9FB] rounded-xl p-3">
              <p className="text-xs text-[#55566F]">이벤트 타입</p>
              <p className="text-sm text-[#14141C] font-medium">{selectedAlarm.eventType.replace(/_/g, " ")}</p>
            </div>
          </div>

          <div className="bg-[#F9F9FB] rounded-xl p-3">
            <p className="text-xs text-[#55566F]">이벤트 감지 시간</p>
            <p className="text-sm text-[#14141C] font-medium">
              {new Date(selectedAlarm.detectionTime).toLocaleString("ko-KR")}
            </p>
          </div>

          {/* Action buttons */}
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={closeModal}
              className="py-3 bg-[#F6F6FA] hover:bg-[#E0E0E0] text-[#77788C] rounded-xl font-medium transition-all"
            >
              취소
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onReportClick?.(selectedAlarm);
              }}
              className="py-3 bg-blue-500 hover:bg-blue-600 text-white rounded-xl font-medium transition-all"
            >
              리포트 생성
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
