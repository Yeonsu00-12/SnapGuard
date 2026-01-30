"use client";

import { useEffect } from "react";
import { io } from "socket.io-client";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { SERVER_BASE } from "@/lib/api";
import { useAlarmStore } from "@/stores/useAlarmStore";

export function AlarmNotificationProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { addAlarm, setConnected } = useAlarmStore();

  useEffect(() => {
    const socket = io(SERVER_BASE, {
      transports: ["websocket", "polling"],
      withCredentials: true,
    });

    socket.on("connect", () => {
      console.log("WebSocket connected");
      setConnected(true);
      socket.emit("subscribe:alarms");
    });

    socket.on("disconnect", () => {
      console.log("WebSocket disconnected");
      setConnected(false);
    });

    socket.on("alarm:new", (alarm: Alarm) => {
      console.log("New alarm received:", alarm);

      // Zustand 스토어에 알람 추가
      addAlarm(alarm);

      // Toast 알림 표시
      const message = `${alarm.camera.name} - ${alarm.siteName}`;
      const description = `${alarm.eventType.replace(/_/g, " ")} • ${new Date(alarm.detectionTime).toLocaleString("ko-KR")}`;

      toast(message, {
        description,
        action: {
          label: "상세보기",
          onClick: () => router.push(`/alerts?alarmId=${alarm.id}`),
        },
        duration: 8000,
        className: "border-l-4 border-red-600"
      });
    });

    return () => {
      socket.close();
      setConnected(false);
    };
  }, []);

  return <>{children}</>;
}
