import React, { useState, useEffect } from "react";
import { documentAPI } from "@/services/api";
import {
  Loader2,
  Upload,
  Trash2,
  Download,
  Eye,
  FileText,
  CheckCircle,
  AlertCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  employee: any;
  toast: any;
}

const DOC_TYPES = [
  { id: "pan", label: "PAN Card" },
  { id: "aadhar", label: "Aadhaar Card" },
  { id: "resume", label: "Resume" },
  { id: "offer_letter", label: "Offer Letter" },
  { id: "appointment_letter", label: "Appointment Letter" },
  { id: "salary_slip", label: "Salary Slip" },
  { id: "relieving_letter", label: "Relieving Letter" },
];

export function DocumentsTabPane({ employee, toast }: Props) {
  const [docs, setDocs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploadingDoc, setUploadingDoc] = useState<string | null>(null);

  const loadDocs = async () => {
    try {
      const res = await documentAPI.getAll();
      if (res.success) {
        setDocs(res.data);
      }
    } catch (err: any) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDocs();
  }, []);

  const handleUpload = async (
    e: React.ChangeEvent<HTMLInputElement>,
    docType: string,
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      toast({
        title: "Error",
        description: "File size exceeds 5MB limit",
        variant: "destructive",
      });
      return;
    }

    setUploadingDoc(docType);

    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const base64Data = reader.result as string;
        const uploadRes = await documentAPI.upload({
          employeeId: employee._id,
          name: file.name,
          docType,
          mimeType: file.type,
          fileData: base64Data,
        });

        if (uploadRes.success) {
          toast({
            title: "Success",
            description: `${file.name} uploaded successfully.`,
          });
          await loadDocs();
        } else {
          toast({
            title: "Failed",
            description: "Failed to upload document",
            variant: "destructive",
          });
        }
      } catch (err: any) {
        toast({
          title: "Error",
          description: err.message || "Something went wrong",
          variant: "destructive",
        });
      } finally {
        setUploadingDoc(null);
      }
    };
    reader.onerror = () => {
      toast({
        title: "Error",
        description: "Could not read file",
        variant: "destructive",
      });
      setUploadingDoc(null);
    };
    reader.readAsDataURL(file);
  };

  const handleDownload = async (docId: string, docName: string) => {
    try {
      const res = await documentAPI.download(docId);
      if (res.success && res.data?.fileData) {
        const base64 = res.data.fileData;
        const mimeType = res.data.mimeType || "application/octet-stream";
        const linkSource = `data:${mimeType};base64,${base64}`;
        const downloadLink = document.createElement("a");
        downloadLink.href = linkSource;
        downloadLink.download = docName;
        downloadLink.click();
      } else {
        toast({
          title: "Failed",
          description: "Could not download file data",
          variant: "destructive",
        });
      }
    } catch (err: any) {
      toast({
        title: "Error",
        description: err.message,
        variant: "destructive",
      });
    }
  };

  const handleDelete = async (docId: string) => {
    if (!confirm("Are you sure you want to delete/replace this document?"))
      return;
    try {
      const res = await documentAPI.delete(docId);
      if (res.success) {
        toast({ title: "Success", description: "Document deleted." });
        await loadDocs();
      }
    } catch (err: any) {
      toast({
        title: "Error",
        description: err.message,
        variant: "destructive",
      });
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
        <h3 className="text-sm font-bold uppercase mb-1">My Document Vault</h3>
        <p className="text-xs text-muted-foreground">
          Upload, download, or replace your documents. All documents are
          securely stored and verified by HR.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {DOC_TYPES.map((t) => {
          const uploaded = docs.find((d) => d.docType === t.id);

          return (
            <div
              key={t.id}
              className="border-2 border-black bg-white flex flex-col justify-between p-4 space-y-4"
            >
              <div>
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    <FileText className="w-5 h-5 text-[#024BAB]" />
                    <p className="text-xs font-bold uppercase text-black">
                      {t.label}
                    </p>
                  </div>
                  {uploaded ? (
                    <span className="flex items-center gap-1 text-[10px] font-bold uppercase text-green-700 bg-green-50 border border-green-700 px-1.5 py-0.5">
                      <CheckCircle className="w-3 h-3" /> Uploaded
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 text-[10px] font-bold uppercase text-amber-700 bg-amber-50 border border-amber-700 px-1.5 py-0.5">
                      <AlertCircle className="w-3 h-3" /> Missing
                    </span>
                  )}
                </div>

                {uploaded ? (
                  <div className="mt-3">
                    <p className="text-xs font-bold text-black truncate">
                      {uploaded.name}
                    </p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">
                      Uploaded on{" "}
                      {new Date(uploaded.createdAt).toLocaleDateString("en-IN")}
                    </p>
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground mt-3">
                    No document has been uploaded for this category yet.
                  </p>
                )}
              </div>

              <div className="flex gap-2">
                {uploaded ? (
                  <>
                    <button
                      onClick={() =>
                        handleDownload(uploaded._id, uploaded.name)
                      }
                      className="flex-1 flex items-center justify-center gap-1 bg-white text-black border-2 border-black py-2 font-bold text-[10px] uppercase hover:bg-gray-50"
                    >
                      <Download className="w-3 h-3" /> Download
                    </button>
                    <button
                      onClick={() => handleDelete(uploaded._id)}
                      className="flex items-center justify-center bg-white text-red-600 border-2 border-red-600 p-2 hover:bg-red-50"
                      title="Delete & Replace"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </>
                ) : (
                  <label className="flex-1 flex items-center justify-center gap-1.5 bg-[#024BAB] text-white border-2 border-black py-2 font-bold text-[10px] uppercase cursor-pointer hover:bg-[#024BAB]/90">
                    {uploadingDoc === t.id ? (
                      <Loader2 className="w-3 h-3 animate-spin" />
                    ) : (
                      <Upload className="w-3 h-3" />
                    )}
                    {uploadingDoc === t.id ? "Uploading..." : "Upload File"}
                    <input
                      type="file"
                      disabled={uploadingDoc !== null}
                      onChange={(e) => handleUpload(e, t.id)}
                      className="hidden"
                    />
                  </label>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
