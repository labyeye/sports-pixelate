import { useState } from "react";
import { Loader2, Building2, AlertCircle } from "lucide-react";
import { validators, formatters } from "@/lib/validation";

interface CompanyDetailsFormProps {
  onSubmit: (data: {
    name: string;
    email: string;
    phone: string;
    industry: string;
    website: string;
    gstNumber: string;
    panNumber: string;
  }) => Promise<void>;
  loading?: boolean;
  error?: string;
  onError?: (error: string) => void;
}

export default function CompanyDetailsForm({
  onSubmit,
  loading = false,
  error = "",
  onError = () => {},
}: CompanyDetailsFormProps) {
  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    industry: "",
    website: "",
    gstNumber: "",
    panNumber: "",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const nameValidation = validators.name(form.name);
    if (!nameValidation.valid) {
      onError(nameValidation.error || "Invalid company name");
      return;
    }

    if (!form.phone.trim()) {
      onError("Phone number is required");
      return;
    }
    if (!validators.phone(form.phone)) {
      onError("Phone number must have 10-15 digits");
      return;
    }

    if (form.email.trim() && !validators.email(form.email)) {
      onError("Please enter a valid email address");
      return;
    }

    if (form.website.trim() && !validators.url(form.website)) {
      onError("Please enter a valid website URL");
      return;
    }

    if (form.gstNumber.trim() && !validators.gst(form.gstNumber)) {
      onError("Please enter a valid GST number (format: 27AABCT1234A1Z5)");
      return;
    }

    if (form.panNumber.trim() && !validators.pan(form.panNumber)) {
      onError("Please enter a valid PAN number (format: AAAAA0000A)");
      return;
    }

    try {
      await onSubmit(form);
    } catch (err) {
      onError((err as Error).message || "Failed to create company");
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && (
        <div className="flex items-start gap-3 bg-white border-2 border-[#EF4444] px-4 py-3">
          <AlertCircle className="w-5 h-5 text-[#EF4444] flex-shrink-0 mt-0.5" />
          <span className="text-sm font-medium text-[#EF4444]">{error}</span>
        </div>
      )}

      {}
      <div className="space-y-2">
        <label className="block text-xs font-bold uppercase tracking-wider text-black">
          Company Name *
        </label>
        <input
          type="text"
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          placeholder="Acme Inc."
          className="w-full px-3 py-2.5 text-sm font-medium bg-white border-2 border-black focus:outline-none focus:ring-2 focus:ring-[#024BAB] focus:ring-offset-2"
          required
          autoFocus
        />
      </div>

      {}
      <div className="space-y-2">
        <label className="block text-xs font-bold uppercase tracking-wider text-black">
          Company Email
        </label>
        <input
          type="email"
          value={form.email}
          onChange={(e) => setForm({ ...form, email: e.target.value })}
          placeholder="company@example.com"
          className="w-full px-3 py-2.5 text-sm font-medium bg-white border-2 border-black focus:outline-none focus:ring-2 focus:ring-[#024BAB] focus:ring-offset-2"
        />
      </div>

      {}
      <div className="space-y-2">
        <label className="block text-xs font-bold uppercase tracking-wider text-black">
          Phone *
        </label>
        <input
          type="tel"
          value={form.phone}
          onChange={(e) =>
            setForm({ ...form, phone: formatters.phone(e.target.value) })
          }
          placeholder="+91 98765 43210"
          className="w-full px-3 py-2.5 text-sm font-medium bg-white border-2 border-black focus:outline-none focus:ring-2 focus:ring-[#024BAB] focus:ring-offset-2"
          required
        />
      </div>

      {}
      <div className="space-y-2">
        <label className="block text-xs font-bold uppercase tracking-wider text-black">
          Industry
        </label>
        <input
          type="text"
          value={form.industry}
          onChange={(e) => setForm({ ...form, industry: e.target.value })}
          placeholder="e.g., Technology, Manufacturing"
          className="w-full px-3 py-2.5 text-sm font-medium bg-white border-2 border-black focus:outline-none focus:ring-2 focus:ring-[#024BAB] focus:ring-offset-2"
        />
      </div>

      {}
      <div className="space-y-2">
        <label className="block text-xs font-bold uppercase tracking-wider text-black">
          Website
        </label>
        <input
          type="url"
          value={form.website}
          onChange={(e) => setForm({ ...form, website: e.target.value })}
          placeholder="https://example.com"
          className="w-full px-3 py-2.5 text-sm font-medium bg-white border-2 border-black focus:outline-none focus:ring-2 focus:ring-[#024BAB] focus:ring-offset-2"
        />
      </div>

      {}
      <div className="space-y-2">
        <label className="block text-xs font-bold uppercase tracking-wider text-black">
          GST Number
        </label>
        <input
          type="text"
          value={form.gstNumber}
          onChange={(e) =>
            setForm({ ...form, gstNumber: formatters.gst(e.target.value) })
          }
          placeholder="27AABCT1234A1Z5"
          className="w-full px-3 py-2.5 text-sm font-medium bg-white border-2 border-black focus:outline-none focus:ring-2 focus:ring-[#024BAB] focus:ring-offset-2"
        />
      </div>

      {}
      <div className="space-y-2">
        <label className="block text-xs font-bold uppercase tracking-wider text-black">
          PAN Number
        </label>
        <input
          type="text"
          value={form.panNumber}
          onChange={(e) =>
            setForm({ ...form, panNumber: formatters.pan(e.target.value) })
          }
          placeholder="AAAAA0000A"
          className="w-full px-3 py-2.5 text-sm font-medium bg-white border-2 border-black focus:outline-none focus:ring-2 focus:ring-[#024BAB] focus:ring-offset-2"
        />
      </div>

      {}
      <button
        type="submit"
        disabled={loading}
        className="w-full bg-[#024BAB] border-2 border-black text-white font-bold uppercase text-sm px-4 py-3 hover:bg-[#023590] disabled:opacity-60 disabled:cursor-not-allowed transition-all"
      >
        {loading ? (
          <span className="flex items-center justify-center gap-2">
            <Loader2 className="w-4 h-4 animate-spin" />
            Creating company...
          </span>
        ) : (
          <span className="flex items-center justify-center gap-2">
            <Building2 className="w-4 h-4" />
            Continue to Plans
          </span>
        )}
      </button>

      <p className="text-xs text-gray-600 text-center font-medium">
        * Required fields
      </p>
    </form>
  );
}
