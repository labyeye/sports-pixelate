import React, { useState, useEffect } from "react";
import { assetAPI } from "@/services/api";
import {
  Loader2,
  Cpu,
  Calendar,
  RefreshCw,
  Smartphone,
  Laptop,
  Check,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  toast: any;
}

export function AssetsTabPane({ toast }: Props) {
  const [assets, setAssets] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [returningId, setReturningId] = useState<string | null>(null);

  const loadAssets = async () => {
    try {
      const res = await assetAPI.getAll();
      if (res.success) {
        setAssets(res.data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAssets();
  }, []);

  const handleReturn = async (id: string) => {
    if (
      !confirm(
        "Are you returning this asset? The assignment will be updated on the server.",
      )
    )
      return;
    setReturningId(id);
    try {
      const res = await assetAPI.return(id);
      if (res.success) {
        toast({
          title: "Asset Returned",
          description: "The asset return process has been recorded.",
        });
        await loadAssets();
      }
    } catch (err: any) {
      toast({
        title: "Failed",
        description: err.message,
        variant: "destructive",
      });
    } finally {
      setReturningId(null);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center py-20 bg-white border-2 border-black">
        <Loader2 className="w-8 h-8 animate-spin text-[#024BAB]" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="border-2 border-black bg-white p-5">
        <h3 className="text-sm font-bold uppercase mb-1">
          Company Assigned Assets
        </h3>
        <p className="text-xs text-muted-foreground">
          View your assigned laptops, mobile phones, SIMs, accessories, or
          vehicles, and report returns when handed back to IT/HR.
        </p>
      </div>

      {assets.length === 0 ? (
        <div className="border-2 border-black bg-white p-8 text-center text-xs text-muted-foreground">
          No company assets are currently assigned to your record.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {assets.map((a) => {
            const isSIM = a.assetType === "sim";
            const isLaptop = a.assetType === "laptop";

            return (
              <div
                key={a._id}
                className="border-2 border-black bg-white flex flex-col justify-between p-4 space-y-4"
              >
                <div>
                  <div className="flex items-center gap-2">
                    {isLaptop ? (
                      <Laptop className="w-5 h-5 text-[#024BAB]" />
                    ) : isSIM ? (
                      <Smartphone className="w-5 h-5 text-[#024BAB]" />
                    ) : (
                      <Cpu className="w-5 h-5 text-[#024BAB]" />
                    )}
                    <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                      {a.assetType}
                    </span>
                  </div>

                  <div className="mt-3 space-y-1">
                    <p className="text-sm font-bold uppercase text-black">
                      {a.name}
                    </p>
                    <p className="text-xs text-muted-foreground font-mono">
                      S/N: {a.serialNumber}
                    </p>
                    {a.assignmentDate && (
                      <p className="text-[10px] text-muted-foreground flex items-center gap-1">
                        <Calendar className="w-3 h-3" /> Assigned:{" "}
                        {new Date(a.assignmentDate).toLocaleDateString("en-IN")}
                      </p>
                    )}
                  </div>
                </div>

                <button
                  onClick={() => handleReturn(a._id)}
                  disabled={returningId === a._id}
                  className="w-full flex items-center justify-center gap-1.5 bg-white text-red-600 border-2 border-red-600 py-2.5 font-bold text-xs uppercase hover:bg-red-50 disabled:opacity-50"
                >
                  {returningId === a._id ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <RefreshCw className="w-4 h-4" />
                  )}
                  {returningId === a._id ? "Processing..." : "Initiate Return"}
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
