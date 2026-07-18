import { useState } from "react";
import { biometricAPI, PersonType } from "@/services/api";
import { useToast } from "@/hooks/use-toast";
import {
  X,
  Fingerprint,
  Loader2,
  Check,
  AlertTriangle,
  Info,
} from "lucide-react";

const FINGER_NAMES = [
  "Right Thumb (0)",
  "Right Index (1)",
  "Right Middle (2)",
  "Right Ring (3)",
  "Right Little (4)",
  "Left Thumb (5)",
  "Left Index (6)",
  "Left Middle (7)",
  "Left Ring (8)",
  "Left Little (9)",
];

export interface EnrollPerson {
  _id: string;
  personType: PersonType;
  firstName: string;
  lastName: string;
  code: string;
  biometricUserId?: string;
}

interface Props {
  device: { _id: string; name: string; serialNumber?: string };
  person: EnrollPerson;
  onClose: () => void;
}

export function FingerprintEnrollModal({ device, person, onClose }: Props) {
  const { toast } = useToast();
  const [fingerIndex, setFingerIndex] = useState(0);
  const [sending, setSending] = useState(false);
  const [queued, setQueued] = useState(false);

  const handleEnroll = async () => {
    if (sending) return;
    setSending(true);
    try {
      const res = await biometricAPI.enrollFingerprint(
        device._id,
        person.personType,
        person._id,
        fingerIndex,
      );
      setQueued(true);
      toast({ title: "Enrollment command sent", description: res.message });
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    }
    setSending(false);
  };

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
      <div className="border-2 w-full max-w-md bg-white">
        <div className="px-6 py-4 border-b-2 border-black flex items-center justify-between">
          <div>
            <h2 className="font-display font-bold text-base flex items-center gap-2">
              <Fingerprint className="w-4 h-4" /> Fingerprint Enrollment
            </h2>
            <p className="text-xs text-gray-500 mt-0.5">
              {person.firstName} {person.lastName} · {person.code}
            </p>
          </div>
          <button onClick={onClose} className="hover:opacity-70">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          {}
          {!person.biometricUserId && (
            <div className="flex items-start gap-2 bg-red-50 border-2 border-red-300 p-3">
              <AlertTriangle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
              <p className="text-sm font-medium text-red-800">
                This person has no Biometric User ID set. Set it first in the
                table above.
              </p>
            </div>
          )}
          {!(device as any).serialNumber && (
            <div className="flex items-start gap-2 bg-yellow-50 border-2 border-yellow-300 p-3">
              <AlertTriangle className="w-4 h-4 text-yellow-600 shrink-0 mt-0.5" />
              <p className="text-sm font-medium text-yellow-800">
                Device serial number not set — command will be queued but device
                won't receive it.
              </p>
            </div>
          )}

          {/* How it works */}
          <div className="bg-blue-50 border-2 border-blue-200 p-4">
            <p className="text-xs font-bold uppercase text-blue-700 mb-2 flex items-center gap-1.5">
              <Info className="w-3.5 h-3.5" /> How this works
            </p>
            <ol className="text-xs text-blue-800 space-y-1 list-decimal list-inside">
              <li>
                Click <strong>Send to Device</strong> — command is queued
              </li>
              <li>Device receives it on next poll (~10 seconds)</li>
              <li>
                Device screen shows: <em>"Please place finger"</em>
              </li>
              <li>
                Person places their finger on the scanner{" "}
                <strong>3 times</strong>
              </li>
              <li>Device stores the template — done!</li>
            </ol>
          </div>

          {/* Finger selection */}
          <div>
            <label className="block text-xs font-bold uppercase mb-2">
              Select Finger
            </label>
            <div className="grid grid-cols-2 gap-2">
              {FINGER_NAMES.map((name, idx) => (
                <button
                  key={idx}
                  onClick={() => setFingerIndex(idx)}
                  className={`text-left px-3 py-2 border-2 text-xs font-bold transition-all ${
                    fingerIndex === idx
                      ? "border-[#024BAB] bg-blue-50 text-[#024BAB]"
                      : "border-black hover:bg-gray-50"
                  }`}
                >
                  {name}
                </button>
              ))}
            </div>
          </div>

          {/* Success state */}
          {queued && (
            <div className="bg-green-50 border-2 border-green-400 p-4 text-center">
              <Check className="w-8 h-8 text-green-600 mx-auto mb-2" />
              <p className="font-bold text-green-800 text-sm">
                Command queued successfully!
              </p>
              <p className="text-xs text-green-600 mt-1">
                Ask {person.firstName} to go to the{" "}
                <strong>{device.name}</strong> device and place their finger
                when prompted.
              </p>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            {!queued ? (
              <button
                onClick={handleEnroll}
                disabled={sending || !person.biometricUserId}
                className="flex-1 border-2 bg-[#024BAB] text-white py-2.5 font-bold text-sm disabled:opacity-40 flex items-center justify-center gap-2"
              >
                {sending ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" /> Sending…
                  </>
                ) : (
                  <>
                    <Fingerprint className="w-4 h-4" /> Send to Device
                  </>
                )}
              </button>
            ) : (
              <button
                onClick={onClose}
                className="flex-1 border-2 bg-[#024BAB] text-white py-2.5 font-bold text-sm"
              >
                Done
              </button>
            )}
            <button
              onClick={onClose}
              className=" bg-white border-2 border-black px-5 py-2.5 font-bold text-sm"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
