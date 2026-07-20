import { useState } from "react";
import {
  Loader2,
  Building2,
  AlertCircle,
  Mail,
  Phone,
  Globe,
  Receipt,
  CreditCard,
  MapPin,
  Landmark,
  Hash,
  Check,
} from "lucide-react";
import { validators, formatters } from "@/lib/validation";
import {
  INDIA_STATES,
  INDIA_STATES_AND_CITIES,
} from "@/data/indiaStatesAndCities";

const OTHER_CITY = "__other__";

const COUNTRY_CODES = [
  { code: "+91", label: "🇮🇳 +91", country: "India" },
  { code: "+1", label: "🇺🇸 +1", country: "USA" },
  { code: "+44", label: "🇬🇧 +44", country: "UK" },
  { code: "+971", label: "🇦🇪 +971", country: "UAE" },
];

interface CompanyDetailsFormProps {
  onSubmit: (data: {
    name: string;
    email: string;
    phone: string;
    website: string;
    gstNumber: string;
    panNumber: string;
    address: string;
    city: string;
    state: string;
    pincode: string;
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
    website: "",
    gstNumber: "",
    panNumber: "",
    address: "",
    city: "",
    state: "",
    pincode: "",
  });
  const [countryCode, setCountryCode] = useState("+91");
  const [cityIsOther, setCityIsOther] = useState(false);
  const [needsGstBill, setNeedsGstBill] = useState(false);
  const cityOptions = form.state
    ? INDIA_STATES_AND_CITIES[form.state] || []
    : [];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const nameValidation = validators.name(form.name);
    if (!nameValidation.valid) {
      onError(nameValidation.error || "Invalid SportsClub name");
      return;
    }

    if (!form.phone.trim()) {
      onError("Phone number is required");
      return;
    }
    const fullPhone = `${countryCode} ${form.phone}`;
    if (!validators.phone(fullPhone)) {
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

    if (needsGstBill && !form.gstNumber.trim()) {
      onError("GST number is required to generate a GST bill");
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

    if (form.pincode.trim() && !validators.pincode(form.pincode)) {
      onError("Please enter a valid 6-digit pincode");
      return;
    }

    try {
      await onSubmit({ ...form, phone: fullPhone });
    } catch (err) {
      onError((err as Error).message || "Failed to create SportsClub");
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
      <div className="space-y-5 md:space-y-0 md:flex md:gap-5">
        <div className="space-y-2 md:flex-1">
          <label className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-black">
            <Building2 className="w-3.5 h-3.5" />
            SportsClub Name *
          </label>
          <input
            type="text"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder="Enter Your Club Name"
            className="w-full px-3 py-2.5 text-sm font-medium bg-white border-2 border-black focus:outline-none focus:ring-2 focus:ring-[#024BAB] focus:ring-offset-2"
            required
            autoFocus
          />
        </div>
        <div className="space-y-2 md:flex-1">
          <label className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-black">
            <Mail className="w-3.5 h-3.5" />
            SportsClub Email
          </label>
          <input
            type="email"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            placeholder="Enter Your Club Email"
            className="w-full px-3 py-2.5 text-sm font-medium bg-white border-2 border-black focus:outline-none focus:ring-2 focus:ring-[#024BAB] focus:ring-offset-2"
          />
        </div>
      </div>

      {}
      <div className="space-y-5 md:space-y-0 md:flex md:gap-5">
        <div className="space-y-2 md:flex-1">
          <label className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-black">
            <Phone className="w-3.5 h-3.5" />
            Phone *
          </label>
          <div className="flex border-2 border-black focus-within:ring-2 focus-within:ring-[#024BAB] focus-within:ring-offset-2">
            <select
              value={countryCode}
              onChange={(e) => setCountryCode(e.target.value)}
              className="px-2 text-sm font-bold bg-white border-r-2 border-black outline-none"
            >
              {COUNTRY_CODES.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.label}
                </option>
              ))}
            </select>
            <input
              type="tel"
              value={form.phone}
              onChange={(e) => {
                const digits = e.target.value.replace(/\D/g, "").slice(0, 10);
                const formatted =
                  digits.length > 6
                    ? `${digits.slice(0, 3)} ${digits.slice(3, 6)} ${digits.slice(6)}`
                    : digits.length > 3
                      ? `${digits.slice(0, 3)} ${digits.slice(3)}`
                      : digits;
                setForm({ ...form, phone: formatted });
              }}
              placeholder="Enter Your Club Phone Number"
              className="flex-1 min-w-0 px-3 py-2.5 text-sm font-medium bg-white outline-none"
              required
            />
          </div>
        </div>
        <div className="space-y-2 md:flex-1">
          <label className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-black">
            <Globe className="w-3.5 h-3.5" />
            Website
          </label>
          <input
            type="url"
            value={form.website}
            onChange={(e) => setForm({ ...form, website: e.target.value })}
            placeholder="Enter Your Club Website"
            className="w-full px-3 py-2.5 text-sm font-medium bg-white border-2 border-black focus:outline-none focus:ring-2 focus:ring-[#024BAB] focus:ring-offset-2"
          />
        </div>
      </div>

      {}
      <button
        type="button"
        onClick={() => setNeedsGstBill((v) => !v)}
        className={`w-full border-2 border-black px-4 py-3 flex items-center justify-between text-left transition-all ${
          needsGstBill ? "bg-[#024BAB] text-white" : "bg-white text-black"
        }`}
      >
        <span className="flex items-center gap-2 font-bold text-sm">
          <Receipt className="w-4 h-4" />
          Need a GST bill?
        </span>
        <span
          className={`w-5 h-5 border-2 flex items-center justify-center shrink-0 ${
            needsGstBill ? "bg-white border-white" : "bg-white border-black"
          }`}
        >
          {needsGstBill && <Check className="w-3.5 h-3.5 text-[#024BAB]" />}
        </span>
      </button>
      {needsGstBill && (
        <p className="text-xs text-gray-500 font-medium -mt-3">
          Add your GST number below to receive a GST-compliant invoice.
        </p>
      )}

      {}
      <div className="space-y-5 md:space-y-0 md:flex md:gap-5">
        <div className="space-y-2 md:flex-1">
          <label className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-black">
            <Receipt className="w-3.5 h-3.5" />
            GST Number {needsGstBill && "*"}
          </label>
          <input
            type="text"
            value={form.gstNumber}
            onChange={(e) =>
              setForm({ ...form, gstNumber: formatters.gst(e.target.value) })
            }
            maxLength={15}
            placeholder="Enter Your GST Number"
            className="w-full px-3 py-2.5 text-sm font-medium bg-white border-2 border-black focus:outline-none focus:ring-2 focus:ring-[#024BAB] focus:ring-offset-2"
            required={needsGstBill}
          />
        </div>
        <div className="space-y-2 md:flex-1">
          <label className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-black">
            <CreditCard className="w-3.5 h-3.5" />
            PAN Number
          </label>
          <input
            type="text"
            value={form.panNumber}
            onChange={(e) =>
              setForm({ ...form, panNumber: formatters.pan(e.target.value) })
            }
            maxLength={10}
            placeholder="Enter Your PAN Number"
            className="w-full px-3 py-2.5 text-sm font-medium bg-white border-2 border-black focus:outline-none focus:ring-2 focus:ring-[#024BAB] focus:ring-offset-2"
          />
        </div>
      </div>

      {}
      <div className="space-y-2">
        <label className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-black">
          <MapPin className="w-3.5 h-3.5" />
          Address Line
        </label>
        <input
          type="text"
          value={form.address}
          onChange={(e) => setForm({ ...form, address: e.target.value })}
          placeholder="123 MG Road, Near City Stadium"
          className="w-full px-3 py-2.5 text-sm font-medium bg-white border-2 border-black focus:outline-none focus:ring-2 focus:ring-[#024BAB] focus:ring-offset-2"
        />
      </div>

      {}
      <div className="space-y-5 md:space-y-0 md:flex md:gap-5">
        <div className="space-y-2 md:flex-1">
          <label className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-black">
            <Landmark className="w-3.5 h-3.5" />
            State
          </label>
          <select
            value={form.state}
            onChange={(e) => {
              setForm({ ...form, state: e.target.value, city: "" });
              setCityIsOther(false);
            }}
            className="w-full px-3 py-2.5 text-sm font-medium bg-white border-2 border-black focus:outline-none focus:ring-2 focus:ring-[#024BAB] focus:ring-offset-2"
          >
            <option value="">Select state</option>
            {INDIA_STATES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-2 md:flex-1">
          <label className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-black">
            <Building2 className="w-3.5 h-3.5" />
            City
          </label>
          {cityIsOther ? (
            <input
              type="text"
              value={form.city}
              onChange={(e) => setForm({ ...form, city: e.target.value })}
              placeholder="Enter city name"
              className="w-full px-3 py-2.5 text-sm font-medium bg-white border-2 border-black focus:outline-none focus:ring-2 focus:ring-[#024BAB] focus:ring-offset-2"
              autoFocus
            />
          ) : (
            <select
              value={form.city}
              onChange={(e) => {
                if (e.target.value === OTHER_CITY) {
                  setCityIsOther(true);
                  setForm({ ...form, city: "" });
                } else {
                  setForm({ ...form, city: e.target.value });
                }
              }}
              disabled={!form.state}
              className="w-full px-3 py-2.5 text-sm font-medium bg-white border-2 border-black focus:outline-none focus:ring-2 focus:ring-[#024BAB] focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <option value="">
                {form.state ? "Select city" : "Select a state first"}
              </option>
              {cityOptions.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
              {form.state && <option value={OTHER_CITY}>Other</option>}
            </select>
          )}
        </div>
        <div className="space-y-2 md:flex-1">
          <label className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-black">
            <Hash className="w-3.5 h-3.5" />
            Pincode
          </label>
          <input
            type="text"
            inputMode="numeric"
            value={form.pincode}
            onChange={(e) =>
              setForm({
                ...form,
                pincode: e.target.value.replace(/\D/g, "").slice(0, 6),
              })
            }
            placeholder="800001"
            className="w-full px-3 py-2.5 text-sm font-medium bg-white border-2 border-black focus:outline-none focus:ring-2 focus:ring-[#024BAB] focus:ring-offset-2"
          />
        </div>
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
            Creating SportsClub...
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
