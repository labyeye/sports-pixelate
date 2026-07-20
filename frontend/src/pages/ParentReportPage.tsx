import { useState, useEffect, useCallback } from "react";
import nesthrlogo from "../../assets/nesthr.png";
import { AppLayout } from "@/components/layout/AppLayout";
import { studentAPI, reportAPI, settingsAPI } from "@/services/api";
import { buildReportHTML, ReportCompany } from "@/lib/reportPrintHTML";
import { useToast } from "@/hooks/use-toast";
import { cn, formatDate } from "@/lib/utils";
import {
  GraduationCap,
  Printer,
  Download,
  Loader2,
  Trophy,
} from "lucide-react";

interface Student {
  _id: string;
  firstName: string;
  lastName: string;
  studentId: string;
  sport: string;
  batch: string;
  avatar?: string;
}

const STATUS_BADGE: Record<string, string> = {
  active: "bg-[#00C48C]/10 text-[#00C48C] border-[#00C48C]",
  on_hold: "bg-[#FA731C]/10 text-[#FA731C] border-[#FA731C]",
  inactive: "bg-gray-100 text-gray-500 border-gray-300",
};

function exportCSV(rows: string[][], filename: string) {
  const csv = rows
    .map((r) =>
      r.map((c) => `"${String(c ?? "").replace(/"/g, '""')}"`).join(","),
    )
    .join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const a = Object.assign(document.createElement("a"), {
    href: URL.createObjectURL(blob),
    download: filename,
  });
  a.click();
  URL.revokeObjectURL(a.href);
}

function printReport(
  title: string,
  headers: string[],
  rows: string[][],
  opts: { company?: ReportCompany; generatedFor?: string },
) {
  const win = window.open("", "_blank");
  if (!win) return;
  win.document.write(
    buildReportHTML(
      title,
      new Date().toLocaleDateString("en-IN"),
      headers,
      rows,
      {
        ...opts,
        reportCategory: "Student",
      },
    ),
  );
  win.document.close();
}

// Lets a parent generate the same "student report card" the academy can
// generate from Student Reports > Student Directory (see ReportsPage.tsx's
// StudentDirectoryGen), scoped to their own children — reportAPI.studentProfile
// enforces that server-side.
export default function ParentReportPage() {
  const { toast } = useToast();
  const [company, setCompany] = useState<ReportCompany>({ name: "NestSports" });
  const [children, setChildren] = useState<Student[]>([]);
  const [selectedChild, setSelectedChild] = useState("");
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [profileLoading, setProfileLoading] = useState(false);

  const loadChildren = useCallback(async () => {
    try {
      const res = await studentAPI.getAll();
      const data = res.data || [];
      setChildren(data);
      setSelectedChild((prev) => prev || data[0]?._id || "");
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadProfile = useCallback(
    async (studentId: string) => {
      if (!studentId) {
        setProfile(null);
        return;
      }
      setProfileLoading(true);
      try {
        const res = await reportAPI.studentProfile(studentId);
        if (res.success) setProfile(res.data);
      } catch (e: any) {
        toast({
          title: "Error",
          description: e.message,
          variant: "destructive",
        });
      } finally {
        setProfileLoading(false);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  useEffect(() => {
    settingsAPI
      .get()
      .then((r) => {
        if (r.success && r.data) {
          setCompany({
            name: r.data.companyName || "NestSports",
            logo: r.data.logoUrl || undefined,
          });
        }
      })
      .catch(() => {});
    loadChildren().finally(() => setLoading(false));
  }, [loadChildren]);

  useEffect(() => {
    if (selectedChild) loadProfile(selectedChild);
  }, [selectedChild, loadProfile]);

  const child = children.find((c) => c._id === selectedChild);

  function profileRows(): string[][] {
    if (!profile) return [];
    const s = profile.student || {};
    const out: string[][] = [
      ["Student ID", s.studentId || "—"],
      ["Name", `${s.firstName || ""} ${s.lastName || ""}`.trim()],
      ["Sport", s.sport || "—"],
      ["Batch", s.batch || "—"],
      ["Coach", s.coach ? `${s.coach.firstName} ${s.coach.lastName}` : "—"],
      ["Status", (s.status || "").toUpperCase()],
      [
        "Enrollment Date",
        s.enrollmentDate ? formatDate(s.enrollmentDate) : "—",
      ],
    ];
    const att = profile.attendance || {};
    out.push(["Attendance — Present", String(att.present ?? 0)]);
    out.push(["Attendance — Late", String(att.late ?? 0)]);
    out.push(["Attendance — Absent", String(att.absent ?? 0)]);
    out.push(["Attendance — Excused", String(att.excused ?? 0)]);
    out.push(["Attendance — Rate", `${att.rate ?? 0}%`]);
    (profile.subscriptions || []).forEach((sub: any) => {
      out.push([
        `Subscription (${sub.startDate ? formatDate(sub.startDate) : "—"})`,
        `${sub.planName || "—"} — ${sub.status || "—"}, paid ${sub.amountPaid ?? 0}/${sub.amount ?? 0}`,
      ]);
    });
    (profile.tournaments || []).forEach((t: any) => {
      out.push([
        "Tournament",
        `${t.eventName || "—"} (${t.activity || "—"}) — ${t.team || "individual"}`,
      ]);
    });
    return out;
  }

  const rows = profileRows();
  const headers = ["Field", "Value"];
  const childName = child ? `${child.firstName} ${child.lastName}` : "";

  return (
    <AppLayout title="Student Report">
      {children.length === 0 && !loading ? (
        <div className="text-center py-16 bg-white border-2 border-black">
          <GraduationCap className="w-14 h-14 text-gray-200 mx-auto mb-3" />
          <p className="font-bold text-gray-400 text-lg">
            No children linked to your account yet
          </p>
          <p className="text-sm text-gray-400 mt-1">
            Contact the academy to link your child's profile.
          </p>
        </div>
      ) : (
        <>
          {children.length > 1 && (
            <div className="flex flex-wrap gap-2 mb-5">
              {children.map((c) => (
                <button
                  key={c._id}
                  onClick={() => setSelectedChild(c._id)}
                  className={cn(
                    "flex items-center gap-2 border-2 border-black px-3 py-2 text-xs font-bold uppercase transition-colors",
                    selectedChild === c._id
                      ? "bg-[#024BAB] text-white"
                      : "bg-white text-black hover:bg-[#024BAB]/5",
                  )}
                >
                  {c.avatar ? (
                    <img
                      src={c.avatar}
                      alt={c.firstName}
                      className="w-5 h-5 rounded-full object-cover"
                    />
                  ) : (
                    <span className="w-5 h-5 rounded-full bg-white/20 flex items-center justify-center text-[9px]">
                      {c.firstName?.[0]}
                    </span>
                  )}
                  {c.firstName} {c.lastName}
                </button>
              ))}
            </div>
          )}

          <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
            <div>
              <h1 className="font-display font-bold text-2xl text-black">
                {childName || "Report"}
              </h1>
              <p className="text-sm text-gray-500">
                {child?.sport} {child?.batch ? `· ${child.batch}` : ""}
              </p>
            </div>
            {rows.length > 0 && (
              <div className="flex gap-2">
                <button
                  onClick={() =>
                    printReport(
                      `Student Report Card — ${childName}`,
                      headers,
                      rows,
                      {
                        company,
                        generatedFor: childName,
                      },
                    )
                  }
                  className="flex items-center gap-2 border-2 border-black px-3 py-2 text-sm font-bold bg-white"
                >
                  <Printer className="w-4 h-4" /> Print
                </button>
                <button
                  onClick={() =>
                    exportCSV(
                      [headers, ...rows],
                      `report_card_${childName.replace(/\s+/g, "_")}.csv`,
                    )
                  }
                  className="flex items-center gap-2 border-2 border-black px-3 py-2 text-sm font-bold bg-[#00C48C] text-white"
                >
                  <Download className="w-4 h-4" /> CSV
                </button>
              </div>
            )}
          </div>

          {loading || profileLoading ? (
            <div className="border-2 border-black bg-white flex items-center justify-center h-48">
              {loading ? (
                <img
                  src={nesthrlogo}
                  alt="NestSports"
                  className="h-16 w-auto"
                />
              ) : (
                <Loader2 className="w-8 h-8 animate-spin text-[#024BAB]" />
              )}
            </div>
          ) : rows.length === 0 ? (
            <div className="border-2 border-black bg-white p-12 flex flex-col items-center justify-center">
              <Trophy className="w-12 h-12 text-muted-foreground/30 mb-3" />
              <p className="font-bold text-black">No report data found</p>
            </div>
          ) : (
            <div className="border-2 border-black bg-white overflow-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b-2 border-black bg-[#024BAB]/5">
                    <th className="px-4 py-3 text-left text-xs font-bold text-black uppercase tracking-wider">
                      Field
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-bold text-black uppercase tracking-wider">
                      Value
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map(([field, value], i) => (
                    <tr
                      key={i}
                      className={cn(
                        "border-b border-black/10",
                        i % 2 !== 0 && "bg-[#F8FAFF]",
                      )}
                    >
                      <td className="px-4 py-3 font-bold text-black text-xs">
                        {field}
                      </td>
                      <td className="px-4 py-3 text-xs text-black">
                        {field === "Status" ? (
                          <span
                            className={cn(
                              "inline-flex items-center px-2 py-0.5 text-[10px] font-bold uppercase border-2 capitalize",
                              STATUS_BADGE[value.toLowerCase()] ||
                                "bg-gray-100 text-gray-500 border-gray-300",
                            )}
                          >
                            {value}
                          </span>
                        ) : (
                          value
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </AppLayout>
  );
}
