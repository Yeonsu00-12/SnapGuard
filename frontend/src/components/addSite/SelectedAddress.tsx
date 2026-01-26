"use client";

import { X } from "lucide-react";
import DaumPostcodeEmbed from "react-daum-postcode";
import { useAddSiteStore } from "@/stores/useAddSiteStore";

export default function SelectedAddress() {
  const { setSiteAddress, setShowPostcode } = useAddSiteStore();

  return (
    <div
      className="fixed inset-0 bg-black/50 z-[400] flex items-center justify-center px-4"
      style={{ touchAction: "auto", marginTop: 0 }}
    >
      <div
        className="bg-white rounded-2xl w-full max-w-lg overflow-hidden"
        style={{ touchAction: "auto" }}
      >
        <div className="flex items-center justify-between p-4 border-b">
          <h3 className="font-bold text-slate-800">주소 검색</h3>
          <button
            onClick={() => setShowPostcode(false)}
            className="p-2 hover:bg-slate-100 rounded-full transition-colors"
          >
            <X size={20} />
          </button>
        </div>
        <div style={{ touchAction: "auto", WebkitOverflowScrolling: "touch" }}>
          <DaumPostcodeEmbed
            onComplete={(data) => {
              setSiteAddress(data.address);
              setShowPostcode(false);
            }}
            style={{ height: 400, width: "100%" }}
            autoClose={false}
          />
        </div>
      </div>
    </div>
  );
}
