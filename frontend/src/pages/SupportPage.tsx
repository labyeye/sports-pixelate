import { useState, useEffect } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { supportAPI } from "@/services/api";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { cn, formatDate } from "@/lib/utils";
import {
  Plus,
  TicketCheck,
  Clock,
  CheckCircle2,
  XCircle,
  AlertCircle,
  X,
  Type,
  Tag,
  Flag,
  FileText,
  Send,
  User,
  Calendar,
  Loader2,
} from "lucide-react";

const ISSUE_TYPES = [
  { value: "attendance", label: "Attendance" },
  { value: "leave", label: "Leave Management" },
  { value: "payroll", label: "Payroll & Salary" },
  { value: "employee_management", label: "Employee Management" },
  { value: "performance", label: "Performance Review" },
  { value: "recruitment", label: "Recruitment" },
  { value: "biometric", label: "Biometric & Devices" },
  { value: "billing", label: "Billing & Subscription" },
  { value: "reports", label: "Reports" },
  { value: "departments", label: "Departments" },
  { value: "loans", label: "Loans & Advances" },
  { value: "exit_management", label: "Exit Management" },
  { value: "settings", label: "Settings" },
  { value: "general", label: "General Inquiry" },
  { value: "other", label: "Other" },
];

const PRIORITIES = [
  { value: "low", label: "Low" },
  { value: "medium", label: "Medium" },
  { value: "high", label: "High" },
  { value: "critical", label: "Critical" },
];

const STATUS_META: Record<
  string,
  { label: string; icon: any; classes: string; bg: string }
> = {
  open: {
    label: "Open",
    icon: Clock,
    classes: "border-[#024BAB] text-[#024BAB]",
    bg: "bg-[#024BAB]/10",
  },
  in_progress: {
    label: "In Progress",
    icon: AlertCircle,
    classes: "border-[#FA731C] text-[#FA731C]",
    bg: "bg-[#FA731C]/10",
  },
  resolved: {
    label: "Resolved",
    icon: CheckCircle2,
    classes: "border-[#00C48C] text-[#00C48C]",
    bg: "bg-[#00C48C]/10",
  },
  closed: {
    label: "Closed",
    icon: XCircle,
    classes: "border-gray-400 text-gray-500",
    bg: "bg-gray-100",
  },
};

const PRIORITY_COLORS: Record<string, string> = {
  low: "border-[#00C48C] bg-[#00C48C]/10 text-[#00C48C]",
  medium: "border-[#FBBF24] bg-[#FBBF24]/10 text-[#92700C]",
  high: "border-[#FA731C] bg-[#FA731C]/10 text-[#FA731C]",
  critical: "border-[#EF4444] bg-[#EF4444]/10 text-[#EF4444]",
};

interface Ticket {
  _id: string;
  ticketNumber: string;
  subject: string;
  issueType: string;
  priority: string;
  description: string;
  status: string;
  resolvedNote: string;
  submittedBy: { name: string; email: string };
  createdAt: string;
  statusUpdatedAt?: string;
  replies?: Array<{
    user?: { name: string; role: string; email: string };
    message: string;
    createdAt: string;
  }>;
}

const EMPTY_FORM = {
  subject: "",
  issueType: "",
  priority: "medium",
  description: "",
};

export default function SupportPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
  const [replyMessage, setReplyMessage] = useState("");
  const [sendingReply, setSendingReply] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);

  const fetchTickets = async () => {
    try {
      const res = await supportAPI.getAll();
      setTickets(res.data);
    } catch {
      toast({ title: "Failed to load tickets", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTickets();
  }, []);

  const handleSendReply = async () => {
    if (!replyMessage.trim() || !selectedTicket) return;
    setSendingReply(true);
    try {
      const res = await supportAPI.reply(selectedTicket._id, replyMessage);
      if (res.success) {
        setSelectedTicket(res.data);
        setReplyMessage("");
        toast({ title: "Reply sent successfully." });
        fetchTickets();
      }
    } catch (err: any) {
      toast({
        title: "Failed to send reply",
        description: err.message,
        variant: "destructive",
      });
    } finally {
      setSendingReply(false);
    }
  };

  const handleCloseTicket = async () => {
    if (!selectedTicket) return;
    if (!confirm("Are you sure you want to close this ticket?")) return;
    try {
      const res = await supportAPI.close(selectedTicket._id);
      if (res.success) {
        setSelectedTicket(null);
        toast({ title: "Ticket closed" });
        fetchTickets();
      }
    } catch (err: any) {
      toast({
        title: "Failed to close ticket",
        description: err.message,
        variant: "destructive",
      });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.subject.trim() || !form.issueType || !form.description.trim()) {
      toast({
        title: "Please fill all required fields",
        variant: "destructive",
      });
      return;
    }
    setSubmitting(true);
    try {
      await supportAPI.create(form);
      toast({ title: "Ticket submitted successfully" });
      setForm(EMPTY_FORM);
      setShowModal(false);
      fetchTickets();
    } catch (err: any) {
      toast({
        title: err.message || "Failed to submit ticket",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const isAdmin = ["super_admin", "hr_manager", "hr_executive"].includes(
    user?.role || "",
  );

  const statusCounts = {
    open: tickets.filter((t) => t.status === "open").length,
    in_progress: tickets.filter((t) => t.status === "in_progress").length,
    resolved: tickets.filter((t) => t.status === "resolved").length,
    closed: tickets.filter((t) => t.status === "closed").length,
  };

  return (
    <AppLayout title="Support">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div>
          <h1 className="font-display font-bold text-2xl text-black">
            Support Tickets
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Report issues and track their resolution status
          </p>
        </div>
        <button
          onClick={() => {
            setForm(EMPTY_FORM);
            setShowModal(true);
          }}
          className="border-2 border-black bg-[#024BAB] text-white px-4 py-2 text-sm flex items-center gap-1.5 font-bold hover:bg-[#01368A] transition-colors"
        >
          <Plus className="w-4 h-4" /> New Ticket
        </button>
      </div>

      {}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
        {Object.entries(statusCounts).map(([status, count]) => {
          const meta = STATUS_META[status];
          const Icon = meta.icon;
          return (
            <div
              key={status}
              className="border-2 border-black bg-white p-4 flex items-center gap-3"
            >
              <div
                className={cn(
                  "w-10 h-10 border-2 flex items-center justify-center shrink-0",
                  meta.bg,
                  meta.classes.split(" ")[0],
                )}
              >
                <Icon className={cn("w-5 h-5", meta.classes.split(" ")[1])} />
              </div>
              <div>
                <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                  {meta.label}
                </p>
                <p className="text-2xl font-bold text-black">{count}</p>
              </div>
            </div>
          );
        })}
      </div>

      {}
      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="w-6 h-6 animate-spin" />
        </div>
      ) : tickets.length === 0 ? (
        <div className="border-2 border-black bg-white p-12 flex flex-col items-center justify-center">
          <TicketCheck className="w-12 h-12 text-muted-foreground/30 mb-3" />
          <p className="font-bold text-black">No support tickets yet</p>
          <p className="text-sm text-muted-foreground mt-1">
            Create a ticket to report an issue
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {tickets.map((ticket) => {
            const meta = STATUS_META[ticket.status] || STATUS_META.open;
            const Icon = meta.icon;
            return (
              <button
                key={ticket._id}
                onClick={() => setSelectedTicket(ticket)}
                className="w-full text-left border-2 border-black bg-white p-4 hover:shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] transition-shadow"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1.5">
                      <span className="text-xs font-mono text-muted-foreground">
                        {ticket.ticketNumber}
                      </span>
                      <span
                        className={cn(
                          "text-[10px] font-bold uppercase px-2 py-0.5 border-2",
                          PRIORITY_COLORS[ticket.priority],
                        )}
                      >
                        {ticket.priority}
                      </span>
                      <span className="text-[10px] font-bold uppercase px-2 py-0.5 border-2 border-black/10 bg-gray-50 text-muted-foreground">
                        {ISSUE_TYPES.find((t) => t.value === ticket.issueType)
                          ?.label || ticket.issueType}
                      </span>
                    </div>
                    <p className="font-bold text-black truncate">
                      {ticket.subject}
                    </p>
                    <p className="text-sm text-muted-foreground line-clamp-1 mt-0.5">
                      {ticket.description}
                    </p>
                    <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                      {isAdmin && (
                        <span>
                          By{" "}
                          {ticket.submittedBy?.name ||
                            ticket.submittedBy?.email}
                        </span>
                      )}
                      <span>{formatDate(ticket.createdAt)}</span>
                    </div>
                  </div>
                  <span
                    className={cn(
                      "shrink-0 flex items-center gap-1 text-[10px] font-bold uppercase px-2 py-1 border-2",
                      meta.classes,
                      meta.bg,
                    )}
                  >
                    <Icon className="w-3 h-3" />
                    {meta.label}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      )}

      {}
      {showModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="border-2 border-black bg-white w-full max-w-lg max-h-[95vh] flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b-2 border-black bg-[#024BAB]">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-white/20 border-2 border-white flex items-center justify-center shrink-0">
                  <TicketCheck className="w-5 h-5 text-white" />
                </div>
                <h3 className="font-bold text-lg text-white">
                  Submit a Support Ticket
                </h3>
              </div>
              <button
                onClick={() => setShowModal(false)}
                className="text-white hover:text-white/70 p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <form
              onSubmit={handleSubmit}
              className="flex-1 overflow-y-auto p-6 space-y-4"
            >
              <div>
                <label className="flex items-center gap-1.5 text-xs font-bold text-black mb-1">
                  <Type className="w-3.5 h-3.5 text-[#024BAB]" />
                  Subject <span className="text-red-500">*</span>
                </label>
                <input
                  required
                  placeholder="Brief summary of the issue"
                  value={form.subject}
                  onChange={(e) =>
                    setForm({ ...form, subject: e.target.value })
                  }
                  maxLength={200}
                  className="border-2 border-black w-full px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-[#024BAB]/30"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="flex items-center gap-1.5 text-xs font-bold text-black mb-1">
                    <Tag className="w-3.5 h-3.5 text-[#024BAB]" />
                    Issue Type <span className="text-red-500">*</span>
                  </label>
                  <select
                    required
                    value={form.issueType}
                    onChange={(e) =>
                      setForm({ ...form, issueType: e.target.value })
                    }
                    className="border-2 border-black w-full px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-[#024BAB]/30 bg-white"
                  >
                    <option value="">Select type</option>
                    {ISSUE_TYPES.map((t) => (
                      <option key={t.value} value={t.value}>
                        {t.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="flex items-center gap-1.5 text-xs font-bold text-black mb-1">
                    <Flag className="w-3.5 h-3.5 text-[#024BAB]" />
                    Priority
                  </label>
                  <select
                    value={form.priority}
                    onChange={(e) =>
                      setForm({ ...form, priority: e.target.value })
                    }
                    className="border-2 border-black w-full px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-[#024BAB]/30 bg-white"
                  >
                    {PRIORITIES.map((p) => (
                      <option key={p.value} value={p.value}>
                        {p.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <label className="flex items-center gap-1.5 text-xs font-bold text-black mb-1">
                  <FileText className="w-3.5 h-3.5 text-[#024BAB]" />
                  Description <span className="text-red-500">*</span>
                </label>
                <textarea
                  required
                  placeholder="Describe the issue in detail — steps to reproduce, error messages, affected employees, etc."
                  rows={5}
                  value={form.description}
                  onChange={(e) =>
                    setForm({ ...form, description: e.target.value })
                  }
                  maxLength={2000}
                  className="border-2 border-black w-full px-3 py-2.5 text-sm outline-none resize-none focus:ring-2 focus:ring-[#024BAB]/30"
                />
                <p className="text-xs text-muted-foreground text-right mt-1">
                  {form.description.length}/2000
                </p>
              </div>
              <div className="flex gap-3 pt-2">
                <button
                  type="submit"
                  disabled={submitting}
                  className="border-2 border-black bg-[#024BAB] text-white px-6 py-2.5 text-sm font-bold flex-1 disabled:opacity-60"
                >
                  {submitting ? "Submitting..." : "Submit Ticket"}
                </button>
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="border-2 border-black bg-white text-black px-4 py-2.5 text-sm font-bold"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {}
      {selectedTicket && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="border-2 border-black bg-white w-full max-w-lg max-h-[95vh] flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b-2 border-black bg-[#024BAB]">
              <div className="flex items-center gap-2.5 min-w-0">
                <span className="text-xs font-mono text-white/70 shrink-0">
                  {selectedTicket.ticketNumber}
                </span>
                <span
                  className={cn(
                    "shrink-0 flex items-center gap-1 text-[10px] font-bold uppercase px-2 py-1 border-2 bg-white",
                    STATUS_META[selectedTicket.status]?.classes ||
                      STATUS_META.open.classes,
                  )}
                >
                  {(() => {
                    const meta =
                      STATUS_META[selectedTicket.status] || STATUS_META.open;
                    const Icon = meta.icon;
                    return (
                      <>
                        <Icon className="w-3 h-3" />
                        {meta.label}
                      </>
                    );
                  })()}
                </span>
              </div>
              <button
                onClick={() => setSelectedTicket(null)}
                className="text-white hover:text-white/70 p-1 shrink-0"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              <p className="font-bold text-lg text-black">
                {selectedTicket.subject}
              </p>

              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-xs font-bold uppercase text-muted-foreground flex items-center gap-1.5">
                    <Tag className="w-3 h-3" /> Issue Type
                  </p>
                  <p className="font-bold text-black mt-0.5">
                    {
                      ISSUE_TYPES.find(
                        (t) => t.value === selectedTicket.issueType,
                      )?.label
                    }
                  </p>
                </div>
                <div>
                  <p className="text-xs font-bold uppercase text-muted-foreground flex items-center gap-1.5">
                    <Flag className="w-3 h-3" /> Priority
                  </p>
                  <span
                    className={cn(
                      "inline-block text-[10px] font-bold uppercase px-2 py-0.5 border-2 mt-0.5",
                      PRIORITY_COLORS[selectedTicket.priority],
                    )}
                  >
                    {selectedTicket.priority}
                  </span>
                </div>
                <div>
                  <p className="text-xs font-bold uppercase text-muted-foreground flex items-center gap-1.5">
                    <Calendar className="w-3 h-3" /> Submitted
                  </p>
                  <p className="font-bold text-black mt-0.5">
                    {formatDate(selectedTicket.createdAt)}
                  </p>
                </div>
                {isAdmin && (
                  <div>
                    <p className="text-xs font-bold uppercase text-muted-foreground flex items-center gap-1.5">
                      <User className="w-3 h-3" /> Submitted By
                    </p>
                    <p className="font-bold text-black mt-0.5">
                      {selectedTicket.submittedBy?.name ||
                        selectedTicket.submittedBy?.email}
                    </p>
                  </div>
                )}
              </div>

              <div>
                <p className="text-xs font-bold uppercase text-muted-foreground flex items-center gap-1.5 mb-1">
                  <FileText className="w-3 h-3" /> Description
                </p>
                <p className="text-sm text-black whitespace-pre-wrap">
                  {selectedTicket.description}
                </p>
              </div>

              {selectedTicket.resolvedNote && (
                <div className="border-2 border-[#00C48C] bg-[#00C48C]/10 p-3">
                  <p className="text-xs font-bold uppercase text-[#00C48C] mb-1">
                    Resolution Note
                  </p>
                  <p className="text-sm text-black">
                    {selectedTicket.resolvedNote}
                  </p>
                </div>
              )}

              {}
              <div className="border-t-2 border-black pt-4 space-y-3">
                <p className="text-xs font-bold uppercase text-black">
                  Conversation History
                </p>
                <div className="max-h-40 overflow-y-auto space-y-2.5 p-3 bg-[#F8FAFF] border-2 border-black">
                  <div className="text-xs border-b border-black/10 pb-2">
                    <p className="font-bold text-black">
                      {selectedTicket.submittedBy?.name || "Employee"}{" "}
                      <span className="font-normal text-muted-foreground">
                        (Original Request)
                      </span>
                    </p>
                    <p className="text-muted-foreground mt-0.5 whitespace-pre-wrap">
                      {selectedTicket.description}
                    </p>
                    <p className="text-[9px] text-gray-400 mt-1">
                      {formatDate(selectedTicket.createdAt)}
                    </p>
                  </div>
                  {selectedTicket.replies?.map((r: any, idx: number) => (
                    <div key={idx} className="text-xs">
                      <p className="font-bold text-black">
                        {r.user?.name || "System"}{" "}
                        <span className="text-[9px] font-normal uppercase text-muted-foreground">
                          ({r.user?.role})
                        </span>
                      </p>
                      <p className="text-muted-foreground mt-0.5 whitespace-pre-wrap">
                        {r.message}
                      </p>
                      <p className="text-[9px] text-gray-400 mt-1">
                        {formatDate(r.createdAt)}
                      </p>
                    </div>
                  ))}
                  {(!selectedTicket.replies ||
                    selectedTicket.replies.length === 0) && (
                    <p className="text-[11px] text-muted-foreground italic">
                      No replies yet.
                    </p>
                  )}
                </div>

                {selectedTicket.status !== "closed" ? (
                  <div className="flex gap-2">
                    <input
                      placeholder="Type your message..."
                      value={replyMessage}
                      onChange={(e) => setReplyMessage(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && handleSendReply()}
                      className="border-2 border-black flex-1 px-3 py-2 text-xs outline-none focus:ring-2 focus:ring-[#024BAB]/30"
                    />
                    <button
                      onClick={handleSendReply}
                      disabled={sendingReply || !replyMessage.trim()}
                      className="border-2 border-black bg-[#024BAB] text-white px-3 py-2 text-xs font-bold flex items-center gap-1 disabled:opacity-50"
                    >
                      {sendingReply ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Send className="w-3.5 h-3.5" />
                      )}
                    </button>
                    <button
                      onClick={handleCloseTicket}
                      className="border-2 border-black bg-white text-[#EF4444] px-3 py-2 text-xs font-bold hover:bg-red-50"
                    >
                      Close
                    </button>
                  </div>
                ) : (
                  <p className="text-xs text-[#EF4444] font-bold">
                    This ticket is closed. No further replies allowed.
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </AppLayout>
  );
}
