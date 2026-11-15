import { useState } from "react";

export const COUNTRIES = [
  { iso: "in", dial: "+91", name: "India" },
  { iso: "ae", dial: "+971", name: "UAE" },
  { iso: "us", dial: "+1", name: "USA" },
  { iso: "gb", dial: "+44", name: "UK" },
  { iso: "sa", dial: "+966", name: "Saudi Arabia" },
  { iso: "qa", dial: "+974", name: "Qatar" },
  { iso: "np", dial: "+977", name: "Nepal" },
  { iso: "bd", dial: "+880", name: "Bangladesh" },
  { iso: "lk", dial: "+94", name: "Sri Lanka" },
  { iso: "sg", dial: "+65", name: "Singapore" },
  { iso: "au", dial: "+61", name: "Australia" },
  { iso: "ca", dial: "+1", name: "Canada" },
];

// Windows browsers don't render flag emojis, so use the free flagcdn images.
const flag = (iso: string) => `https://flagcdn.com/w40/${iso}.png`;

/** Splits "+919876543210" into [country, national digits]. Defaults to India. */
export function splitPhone(v: string): [(typeof COUNTRIES)[number], string] {
  const s = (v || "").replace(/[^\d+]/g, "");
  const hit = [...COUNTRIES]
    .sort((a, b) => b.dial.length - a.dial.length)
    .find((c) => s.startsWith(c.dial));
  return hit
    ? [hit, s.slice(hit.dial.length)]
    : [COUNTRIES[0], s.replace(/^\+/, "").slice(-10)];
}

interface Props {
  value: string;
  onChange: (full: string) => void;
  placeholder?: string;
  className?: string;
}

/** Country-code picker with flag + number input. Value is "<dial><digits>" e.g. "+919876543210". */
export function PhoneInput({
  value,
  onChange,
  placeholder = "Phone number",
  className = "",
}: Props) {
  const [open, setOpen] = useState(false);
  const [country, digits] = splitPhone(value);
  const set = (c: typeof country, d: string) =>
    onChange(d ? `${c.dial}${d}` : "");
  return (
    <div
      className={`relative flex border-2 border-black bg-white ${className}`}
    >
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1.5 px-2 border-r-2 border-black bg-gray-50 text-sm font-bold shrink-0"
      >
        <img
          src={flag(country.iso)}
          alt={country.name}
          className="w-5 h-3.5 object-cover border border-black/30"
        />
        {country.dial}
      </button>
      <input
        type="tel"
        inputMode="numeric"
        value={digits}
        onChange={(e) =>
          set(country, e.target.value.replace(/\D/g, "").slice(0, 12))
        }
        placeholder={placeholder}
        className="flex-1 min-w-0 px-3 py-2.5 text-sm outline-none bg-transparent"
      />
      {open && (
        <div className="absolute left-0 top-full mt-1 w-56 max-h-56 overflow-y-auto bg-white border-2 border-black z-40">
          {COUNTRIES.map((c) => (
            <button
              type="button"
              key={c.iso}
              onClick={() => {
                set(c, digits);
                setOpen(false);
              }}
              className="w-full flex items-center gap-2 px-3 py-2 text-xs text-left hover:bg-[#024BAB]/10"
            >
              <img
                src={flag(c.iso)}
                alt=""
                className="w-5 h-3.5 object-cover"
              />
              <span className="flex-1 font-bold">{c.name}</span>
              <span className="text-muted-foreground">{c.dial}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
