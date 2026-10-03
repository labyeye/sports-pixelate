import { AlertTriangle, X } from "lucide-react";

export interface FeeOverdueStudent {
  _id?: string;
  name: string;
  studentId?: string;
  overdueDays: number;
  planName?: string;
  amountDue?: number;
}

// Shown when attendance is refused because the student's fee is overdue past
// the grace period set in Attendance Settings.
export function FeeOverdueModal({
  students,
  onClose,
}: {
  students: FeeOverdueStudent[] | null;
  onClose: () => void;
}) {
  if (!students || students.length === 0) return null;
  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="border-2 border-black bg-white w-full max-w-md max-h-[80vh] flex flex-col">
        <div className="flex items-center justify-between p-4 border-b-2 border-black bg-red-50">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-red-600" />
            <h3 className="font-display font-bold text-lg">Fee not paid</h3>
          </div>
          <button onClick={onClose} aria-label="Close">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-4 space-y-3 overflow-auto">
          <p className="text-sm text-gray-700">
            {students.length === 1
              ? "Attendance was not taken because this student has not paid their fee."
              : "Attendance was not taken for these students because they have not paid their fee."}
          </p>
          <div className="divide-y divide-black/10 border-2 border-black">
            {students.map((s, i) => (
              <div key={s._id || i} className="px-3 py-2">
                <p className="text-sm font-bold">
                  {s.name}
                  {s.studentId ? ` (${s.studentId})` : ""}
                </p>
                <p className="text-xs text-gray-600">
                  Overdue by {s.overdueDays} day{s.overdueDays === 1 ? "" : "s"}
                  {s.amountDue ? ` · ₹${s.amountDue} due` : ""}
                  {s.planName ? ` · ${s.planName}` : ""}
                </p>
              </div>
            ))}
          </div>
        </div>
        <div className="p-4 border-t-2 border-black">
          <button
            onClick={onClose}
            className="w-full border-2 border-black bg-[#024BAB] text-white px-4 py-2 text-sm font-bold"
          >
            OK
          </button>
        </div>
      </div>
    </div>
  );
}
