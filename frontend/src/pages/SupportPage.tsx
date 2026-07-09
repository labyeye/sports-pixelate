import { useState, useEffect } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { supportAPI } from "@/services/api";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Plus,
  TicketCheck,
  Clock,
  CheckCircle2,
  XCircle,
  AlertCircle,
} from "lucide-react";
import { formatDate } from "@/lib/utils";

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

const STATUS_CONFIG: Record<
  string,
  {
    label: string;
    variant: "default" | "secondary" | "destructive" | "outline";
    icon: React.ReactNode;
  }
> = {
  open: {
    label: "Open",
    variant: "secondary",
    icon: <Clock className="h-3 w-3" />,
  },
  in_progress: {
    label: "In Progress",
    variant: "default",
    icon: <AlertCircle className="h-3 w-3" />,
  },
  resolved: {
    label: "Resolved",
    variant: "outline",
    icon: <CheckCircle2 className="h-3 w-3" />,
  },
  closed: {
    label: "Closed",
    variant: "destructive",
    icon: <XCircle className="h-3 w-3" />,
  },
};

const PRIORITY_COLORS: Record<string, string> = {
  low: "text-green-600 bg-green-50",
  medium: "text-yellow-600 bg-yellow-50",
  high: "text-orange-600 bg-orange-50",
  critical: "text-red-600 bg-red-50",
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

export default function SupportPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
  const [replyMessage, setReplyMessage] = useState("");

  const handleSendReply = async () => {
    if (!replyMessage.trim() || !selectedTicket) return;
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

  const [form, setForm] = useState({
    subject: "",
    issueType: "",
    priority: "medium",
    description: "",
  });

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
      setForm({
        subject: "",
        issueType: "",
        priority: "medium",
        description: "",
      });
      setDialogOpen(false);
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
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Support Tickets</h1>
            <p className="text-muted-foreground text-sm mt-1">
              Report issues and track their resolution status
            </p>
          </div>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                New Ticket
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>Submit a Support Ticket</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4 mt-2">
                <div className="space-y-1.5">
                  <Label htmlFor="subject">Subject *</Label>
                  <Input
                    id="subject"
                    placeholder="Brief summary of the issue"
                    value={form.subject}
                    onChange={(e) =>
                      setForm({ ...form, subject: e.target.value })
                    }
                    maxLength={200}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label>Issue Type *</Label>
                    <Select
                      value={form.issueType}
                      onValueChange={(v) => setForm({ ...form, issueType: v })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select type" />
                      </SelectTrigger>
                      <SelectContent>
                        {ISSUE_TYPES.map((t) => (
                          <SelectItem key={t.value} value={t.value}>
                            {t.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Priority</Label>
                    <Select
                      value={form.priority}
                      onValueChange={(v) => setForm({ ...form, priority: v })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {PRIORITIES.map((p) => (
                          <SelectItem key={p.value} value={p.value}>
                            {p.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="description">Description *</Label>
                  <Textarea
                    id="description"
                    placeholder="Describe the issue in detail — steps to reproduce, error messages, affected employees, etc."
                    rows={5}
                    value={form.description}
                    onChange={(e) =>
                      setForm({ ...form, description: e.target.value })
                    }
                    maxLength={2000}
                  />
                  <p className="text-xs text-muted-foreground text-right">
                    {form.description.length}/2000
                  </p>
                </div>
                <div className="flex justify-end gap-2 pt-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setDialogOpen(false)}
                  >
                    Cancel
                  </Button>
                  <Button type="submit" disabled={submitting}>
                    {submitting ? "Submitting..." : "Submit Ticket"}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {/* Summary cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {Object.entries(statusCounts).map(([status, count]) => {
            const cfg = STATUS_CONFIG[status];
            return (
              <Card key={status}>
                <CardContent className="pt-4 pb-4">
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground">{cfg.icon}</span>
                    <span className="text-sm text-muted-foreground capitalize">
                      {cfg.label}
                    </span>
                  </div>
                  <p className="text-2xl font-bold mt-1">{count}</p>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Ticket list */}
        {loading ? (
          <div className="text-center py-12 text-muted-foreground">
            Loading tickets...
          </div>
        ) : tickets.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-16">
              <TicketCheck className="h-10 w-10 text-muted-foreground mb-3" />
              <p className="font-medium">No support tickets yet</p>
              <p className="text-sm text-muted-foreground">
                Create a ticket to report an issue
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {tickets.map((ticket) => {
              const cfg = STATUS_CONFIG[ticket.status] || STATUS_CONFIG.open;
              return (
                <Card
                  key={ticket._id}
                  className="cursor-pointer hover:shadow-md transition-shadow"
                  onClick={() => setSelectedTicket(ticket)}
                >
                  <CardContent className="pt-4 pb-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs font-mono text-muted-foreground">
                            {ticket.ticketNumber}
                          </span>
                          <span
                            className={`text-xs font-medium px-2 py-0.5 rounded-full capitalize ${PRIORITY_COLORS[ticket.priority]}`}
                          >
                            {ticket.priority}
                          </span>
                          <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
                            {ISSUE_TYPES.find(
                              (t) => t.value === ticket.issueType,
                            )?.label || ticket.issueType}
                          </span>
                        </div>
                        <p className="font-medium mt-1 truncate">
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
                      <Badge
                        variant={cfg.variant}
                        className="flex items-center gap-1 shrink-0"
                      >
                        {cfg.icon}
                        {cfg.label}
                      </Badge>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* Ticket detail dialog */}
      <Dialog
        open={!!selectedTicket}
        onOpenChange={(open) => !open && setSelectedTicket(null)}
      >
        <DialogContent className="max-w-lg">
          {selectedTicket && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <span className="text-sm font-mono text-muted-foreground">
                    {selectedTicket.ticketNumber}
                  </span>
                  <Badge
                    variant={
                      STATUS_CONFIG[selectedTicket.status]?.variant ||
                      "secondary"
                    }
                  >
                    {STATUS_CONFIG[selectedTicket.status]?.label ||
                      selectedTicket.status}
                  </Badge>
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-4 mt-2">
                <div>
                  <p className="font-semibold text-lg">
                    {selectedTicket.subject}
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-muted-foreground">Issue Type</p>
                    <p className="font-medium">
                      {
                        ISSUE_TYPES.find(
                          (t) => t.value === selectedTicket.issueType,
                        )?.label
                      }
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Priority</p>
                    <p
                      className={`font-medium capitalize ${PRIORITY_COLORS[selectedTicket.priority]?.split(" ")[0]}`}
                    >
                      {selectedTicket.priority}
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Submitted</p>
                    <p className="font-medium">
                      {formatDate(selectedTicket.createdAt)}
                    </p>
                  </div>
                  {isAdmin && (
                    <div>
                      <p className="text-muted-foreground">Submitted By</p>
                      <p className="font-medium">
                        {selectedTicket.submittedBy?.name ||
                          selectedTicket.submittedBy?.email}
                      </p>
                    </div>
                  )}
                </div>
                <div>
                  <p className="text-muted-foreground text-sm">Description</p>
                  <p className="mt-1 text-sm whitespace-pre-wrap">
                    {selectedTicket.description}
                  </p>
                </div>
                {selectedTicket.resolvedNote && (
                  <div className="bg-green-50 border border-green-200 rounded-md p-3">
                    <p className="text-xs font-medium text-green-700 mb-1">
                      Resolution Note
                    </p>
                    <p className="text-sm text-green-800">
                      {selectedTicket.resolvedNote}
                    </p>
                  </div>
                )}

                {/* Conversations & Replies */}
                <div className="border-t border-black/10 pt-4 space-y-4">
                  <p className="text-xs font-bold uppercase text-black">
                    Conversation History
                  </p>
                  <div className="max-h-40 overflow-y-auto space-y-2.5 p-2 bg-[#F8FAFF] border border-black/5">
                    {/* Original Description */}
                    <div className="text-xs border-b border-black/5 pb-2">
                      <p className="font-bold text-black">
                        {selectedTicket.submittedBy?.name || "Employee"}{" "}
                        (Original Request)
                      </p>
                      <p className="text-muted-foreground mt-0.5 whitespace-pre-wrap">
                        {selectedTicket.description}
                      </p>
                      <p className="text-[9px] text-gray-400 mt-1">
                        {formatDate(selectedTicket.createdAt)}
                      </p>
                    </div>
                    {/* Replies */}
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
                      <Input
                        placeholder="Type your message..."
                        value={replyMessage}
                        onChange={(e) => setReplyMessage(e.target.value)}
                        className="text-xs flex-1"
                        onKeyDown={(e) =>
                          e.key === "Enter" && handleSendReply()
                        }
                      />
                      <Button size="sm" onClick={handleSendReply}>
                        Send
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={handleCloseTicket}
                      >
                        Close
                      </Button>
                    </div>
                  ) : (
                    <p className="text-xs text-red-500 font-bold">
                      This ticket is closed. No further replies allowed.
                    </p>
                  )}
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
