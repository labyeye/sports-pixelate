// Who marked a student's attendance: a device (fingerprint / card / face
// reader) or a person marking it by hand. Works on the record the attendance
// API returns (verifyMode, markedBy, and the device log it joins in).
export interface AttendanceSource {
  kind: "device" | "manual" | "auto" | "selfie";
  label: string;
  detail: string;
}

const MODE_LABEL: Record<string, string> = {
  fingerprint: "Fingerprint",
  card: "Card",
  face: "Face",
  password: "PIN",
};

export function attendanceSource(r: any): AttendanceSource | null {
  if (!r) return null;
  const mode: string = r.verifyMode || "manual";
  const log = r.checkInLog || r.checkOutLog;
  const place = [log?.device?.name, log?.location?.name]
    .filter(Boolean)
    .join(", ");
  const by: string | undefined = r.markedBy?.name;

  if (mode === "auto")
    return { kind: "auto", label: "Auto", detail: "Marked automatically" };
  if (mode === "geo_camera")
    return {
      kind: "selfie",
      label: "Selfie check-in",
      detail: "Checked in with a location selfie",
    };
  if (mode === "manual")
    return {
      kind: "manual",
      label: by ? `Manual · ${by}` : "Manual",
      detail: by ? `Marked by ${by} (manually)` : "Marked manually",
    };
  const how = MODE_LABEL[mode] || mode;
  return {
    kind: "device",
    label: place ? `Device · ${how}` : `Device · ${how}`,
    detail: `Marked by device (${how})${place ? ` at ${place}` : ""}${
      by && !place ? `, signed in as ${by}` : ""
    }`,
  };
}
