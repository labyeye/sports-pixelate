import { useEffect, useState } from "react";
import { CreditCard, Loader2 } from "lucide-react";
import { eventAPI } from "@/services/api";
import { useToast } from "@/hooks/use-toast";

interface Payment {
  _id: string;
  amount: number;
  status: "pending" | "paid" | "failed";
  createdAt: string;
}

interface Props {
  eventId: string;
}

const STATUS_COLOR: Record<Payment["status"], string> = {
  paid: "text-[#00C48C]",
  pending: "text-[#FBBF24]",
  failed: "text-red-500",
};

// Read-only shell tab — no payment gateway wired up yet, this just lists
// whatever the (currently empty) EventPayment collection returns.
export function PaymentsTab({ eventId }: Props) {
  const { toast } = useToast();
  const [items, setItems] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const res = await eventAPI.getPayments(eventId);
        setItems(res.data || []);
      } catch (e: any) {
        toast({
          title: "Error",
          description: e.message,
          variant: "destructive",
        });
      } finally {
        setLoading(false);
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    })();
  }, [eventId]);

  return (
    <div className="border-2 border-black bg-white p-4">
      <h3 className="font-bold text-sm mb-3 flex items-center gap-2">
        <CreditCard className="w-4 h-4" /> Payments ({items.length})
      </h3>
      {loading ? (
        <div className="flex justify-center py-6">
          <Loader2 className="w-5 h-5 animate-spin" />
        </div>
      ) : items.length === 0 ? (
        <p className="text-xs text-muted-foreground text-center py-6">
          No payment records yet. Enable Online Payments in Settings to start
          collecting fees here.
        </p>
      ) : (
        <div className="space-y-2">
          {items.map((p) => (
            <div
              key={p._id}
              className="flex items-center justify-between border-2 border-black/10 px-3 py-2"
            >
              <span className="text-sm font-bold">₹{p.amount}</span>
              <span
                className={`text-xs font-bold uppercase ${STATUS_COLOR[p.status]}`}
              >
                {p.status}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
