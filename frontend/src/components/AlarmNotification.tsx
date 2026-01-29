"use client";

import { useEffect, useState } from "react";
import { io, Socket } from "socket.io-client";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { SERVER_BASE } from "@/lib/api";

export function AlarmNotificationProvider({ children }: { children: React.ReactNode }) {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const newSocket = io(SERVER_BASE, {
      transports: ["websocket", "polling"],
      withCredentials: true,
    });

    newSocket.on("connect", () => {
      console.log("WebSocket connected");
      setIsConnected(true);
      newSocket.emit("subscribe:alarms");
    });

    newSocket.on("disconnect", () => {
      console.log("WebSocket disconnected");
      setIsConnected(false);
    });

    newSocket.on("alarm:new", (alarm: AlarmEvent) => {
      console.log("New alarm received:", alarm);
      const message = `${alarm.cameraName} - ${alarm.siteName}`;
      const description = `${alarm.eventType.replace(/_/g, " ")} • ${new Date(alarm.detectionTime).toLocaleString("ko-KR")}`;

      /** toast message */
      toast(message, {
        description,
        action: {
          label: "상세보기",
          onClick: () => router.push(`/alarms?selected=${alarm.id}`),
        },
        duration: 8000,
        className: "border-l-4 border-red-600"
      });
    });

    setSocket(newSocket);

    return () => {
      newSocket.close();
    };
  }, []);

  return (
    <>
      {children}
    </>
  );
}
