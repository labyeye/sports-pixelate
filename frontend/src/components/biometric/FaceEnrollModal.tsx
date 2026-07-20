"use client";
import { useEffect, useState, useCallback } from "react";
import { useFaceRecognition } from "@/hooks/useFaceRecognition";
import { biometricAPI, PersonType } from "@/services/api";
import { useToast } from "@/hooks/use-toast";
import {
  X,
  Camera,
  Check,
  Loader2,
  AlertTriangle,
  RefreshCw,
} from "lucide-react";
import { cn } from "@/lib/utils";

export interface EnrollPerson {
  _id: string;
  personType: PersonType;
  firstName: string;
  lastName: string;
  code: string;
  faceDescriptor?: number[];
}

interface Props {
  person: EnrollPerson;
  onClose: () => void;
  onSaved: (personId: string) => void;
}

export function FaceEnrollModal({ person, onClose, onSaved }: Props) {
  const { toast } = useToast();
  const {
    videoRef,
    canvasRef,
    loadState,
    cameraActive,
    liveDetection,
    startCamera,
    stopCamera,
    captureFaceDescriptor,
    startLiveDetection,
  } = useFaceRecognition();

  const [step, setStep] = useState<"setup" | "capture" | "saving" | "done">(
    "setup",
  );
  const [capturedDescriptor, setCapturedDescriptor] = useState<number[] | null>(
    null,
  );
  const [error, setError] = useState("");

  const handleStartCamera = useCallback(async () => {
    setError("");
    try {
      await startCamera();
      setStep("capture");
    } catch (e: any) {
      setError(e.message);
    }
  }, [startCamera]);

  useEffect(() => {
    if (cameraActive && loadState === "ready") {
      startLiveDetection();
    }
  }, [cameraActive, loadState, startLiveDetection]);

  useEffect(() => {
    return () => stopCamera();
  }, [stopCamera]);

  const handleCapture = async () => {
    setError("");
    try {
      const descriptor = await captureFaceDescriptor();
      setCapturedDescriptor(descriptor);
      stopCamera();
    } catch (e: any) {
      setError(e.message);
    }
  };

  const handleSave = async () => {
    if (!capturedDescriptor) return;
    setStep("saving");
    try {
      await biometricAPI.saveFaceDescriptor(
        person.personType,
        person._id,
        capturedDescriptor,
      );
      setStep("done");
      toast({
        title: "Face enrolled",
        description: `${person.firstName}'s face is saved`,
      });
      onSaved(person._id);
    } catch (e: any) {
      setError(e.message);
      setStep("capture");
    }
  };

  const handleRetry = async () => {
    setCapturedDescriptor(null);
    setError("");
    await handleStartCamera();
  };

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
      <div className="border-2 w-full max-w-lg bg-white">
        {}
        <div className="px-6 py-4 border-b-2 border-black flex items-center justify-between">
          <div>
            <h2 className="font-display font-bold text-base flex items-center gap-2">
              <Camera className="w-4 h-4" /> Face Enrollment
            </h2>
            <p className="text-xs text-gray-500 mt-0.5">
              {person.firstName} {person.lastName} · {person.code}
            </p>
          </div>
          <button
            onClick={() => {
              stopCamera();
              onClose();
            }}
            className="hover:opacity-70"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          {}
          {loadState === "loading" && (
            <div className="flex items-center gap-3 bg-blue-50 border-2 border-blue-300 p-3">
              <Loader2 className="w-4 h-4 animate-spin text-blue-600 shrink-0" />
              <p className="text-sm font-medium text-blue-800">
                Loading face recognition models (~3MB, first time only)…
              </p>
            </div>
          )}

          {}
          {person.faceDescriptor &&
            person.faceDescriptor.length === 128 &&
            step === "setup" && (
              <div className="flex items-center gap-2 bg-yellow-50 border-2 border-yellow-300 p-3 text-sm">
                <AlertTriangle className="w-4 h-4 text-yellow-600 shrink-0" />
                <span className="font-medium text-yellow-800">
                  Face already enrolled — continuing will replace it.
                </span>
              </div>
            )}

          {}
          <div
            className={cn(
              "relative bg-black aspect-video overflow-hidden border-2 border-black",
              step !== "capture" &&
                !(step === "saving" && !capturedDescriptor) &&
                "hidden",
            )}
          >
            <video
              ref={videoRef}
              className="w-full h-full object-cover"
              autoPlay
              muted
              playsInline
            />
            <canvas
              ref={canvasRef}
              className="absolute inset-0 w-full h-full"
            />
            {}
            <div
              className={cn(
                "absolute top-3 right-3 px-2 py-1 text-[10px] font-bold uppercase border",
                liveDetection
                  ? "bg-green-500 border-green-700 text-white"
                  : "bg-red-500 border-red-700 text-white",
              )}
            >
              {liveDetection ? "Face detected" : "No face"}
            </div>
          </div>

          {}
          {capturedDescriptor && step !== "saving" && step !== "done" && (
            <div className="bg-green-50 border-2 border-green-400 p-4 text-center">
              <Check className="w-10 h-10 text-green-600 mx-auto mb-2" />
              <p className="font-bold text-green-800">
                Face captured successfully!
              </p>
              <p className="text-xs text-green-600 mt-1">
                128-dimensional descriptor ready to save
              </p>
            </div>
          )}

          {}
          {step === "done" && (
            <div className="bg-green-50 border-2 border-green-400 p-6 text-center">
              <Check className="w-12 h-12 text-green-600 mx-auto mb-2" />
              <p className="font-bold text-lg text-green-800">
                Enrollment complete!
              </p>
              <p className="text-sm text-green-600 mt-1">
                {person.firstName} can now mark attendance using the PC camera.
              </p>
            </div>
          )}

          {}
          {error && (
            <div className="flex items-start gap-2 bg-red-50 border-2 border-red-300 p-3">
              <AlertTriangle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
              <p className="text-sm font-medium text-red-800">{error}</p>
            </div>
          )}

          {}
          {step === "setup" && (
            <div className="space-y-2 text-sm text-gray-600">
              <p className="font-bold text-black">How it works:</p>
              <ol className="list-decimal list-inside space-y-1">
                <li>
                  Click <strong>Start Camera</strong> — grant browser permission
                </li>
                <li>Person looks directly at camera, face centered in frame</li>
                <li>Green box appears when face is detected</li>
                <li>
                  Click <strong>Capture Face</strong>
                </li>
                <li>Save to complete enrollment</li>
              </ol>
            </div>
          )}

          {}
          <div className="flex gap-3 pt-2">
            {step === "setup" && (
              <button
                onClick={handleStartCamera}
                disabled={loadState === "loading"}
                className="flex-1 border-2 bg-[#024BAB] text-white py-2.5 font-bold text-sm disabled:opacity-40 flex items-center justify-center gap-2"
              >
                {loadState === "loading" ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" /> Loading models…
                  </>
                ) : (
                  <>
                    <Camera className="w-4 h-4" /> Start Camera
                  </>
                )}
              </button>
            )}

            {step === "capture" && (
              <button
                onClick={handleCapture}
                disabled={!liveDetection}
                className="flex-1 border-2 bg-[#024BAB] text-white py-2.5 font-bold text-sm disabled:opacity-40 flex items-center justify-center gap-2"
              >
                <Camera className="w-4 h-4" />
                {liveDetection ? "Capture Face" : "Position face in camera…"}
              </button>
            )}

            {capturedDescriptor && step === "capture" && (
              <>
                <button
                  onClick={handleSave}
                  className="flex-1 border-2 bg-green-600 text-white py-2.5 font-bold text-sm flex items-center justify-center gap-2"
                >
                  <Check className="w-4 h-4" /> Save Enrollment
                </button>
                <button
                  onClick={handleRetry}
                  className=" bg-white border-2 border-black px-4 py-2.5 font-bold text-sm flex items-center gap-1.5"
                >
                  <RefreshCw className="w-4 h-4" /> Retry
                </button>
              </>
            )}

            {step === "saving" && (
              <div className="flex-1 flex items-center justify-center gap-2 py-2.5">
                <Loader2 className="w-5 h-5 animate-spin text-[#024BAB]" />
                <span className="font-bold text-sm">Saving…</span>
              </div>
            )}

            {step === "done" && (
              <button
                onClick={() => {
                  stopCamera();
                  onClose();
                }}
                className="flex-1 border-2 bg-[#024BAB] text-white py-2.5 font-bold text-sm"
              >
                Close
              </button>
            )}

            {step !== "done" && (
              <button
                onClick={() => {
                  stopCamera();
                  onClose();
                }}
                className=" bg-white border-2 border-black px-4 py-2.5 font-bold text-sm"
              >
                Cancel
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
