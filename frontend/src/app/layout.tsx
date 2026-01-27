import type { Metadata } from "next";
import { Toaster } from "@/components/ui/sonner";
import "./globals.css";
import { AlarmNotificationProvider } from "@/components/AlarmNotification";

export const metadata: Metadata = {
  title: "CCTV Monitoring Portal",
  description: "CCTV camera monitoring and alarm system",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <body className="antialiased">
        <AlarmNotificationProvider>
          {children}
        </AlarmNotificationProvider>

        <Toaster position="top-right" richColors/>
      </body>
    </html>
  );
}
