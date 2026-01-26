"use client";

import { useAddSiteWizard } from "@/hooks/useAddSiteWizard";
import AddSiteHeader from "./addSite/AddSiteHeader";
import { CheckCircle2 } from "lucide-react";
import WizardFooter from "./addSite/WizardFooter";
import LoadingSpinner from "./addSite/LoadingSpinner";
import AddSiteContainer from "./addSite/AddSiteContainer";
import CameraSelection from "./addSite/CameraSelection";
import ConnectionTest from "./addSite/ConnectionTest";
import DetectionZone from "./addSite/DetectionZone";

export default function AddSiteWizard({ isOpen, onClose, onSuccess }: AddSiteWizardProps) {
  const wizard = useAddSiteWizard(isOpen, onSuccess, onClose);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-white z-[300] flex flex-col animate-slide-up">
      <AddSiteHeader
        onClose={onClose}
        step={wizard.step}
        onBack={() => { if (wizard.step > 1) wizard.setStep(wizard.step - 1); }}
      />

      <div className="flex-1 p-8 overflow-y-hidden h-full">
        {wizard.step === 1 && <AddSiteContainer />}
        {wizard.step === 2 && <LoadingSpinner />}
        {wizard.step === 3 && <CameraSelection wizard={wizard} />}
        {wizard.step === 4 && <ConnectionTest wizard={wizard} />}
        {wizard.step === 5 && <DetectionZone wizard={wizard} />}
      </div>

      <WizardFooter wizard={wizard} />

      {wizard.toast && (
        <div className="fixed top-12 left-1/2 -translate-x-1/2 z-[500] bg-slate-900 text-white px-8 py-3.5 rounded-full font-black shadow-2xl flex items-center gap-3 animate-slide-down">
          <CheckCircle2 className="text-green-400" size={20} /> {wizard.toast}
        </div>
      )}
    </div>
  );
}