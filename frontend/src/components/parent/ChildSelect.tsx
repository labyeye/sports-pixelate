import { GraduationCap } from "lucide-react";

interface ChildLike {
  _id: string;
  firstName?: string;
  lastName?: string;
}

interface Props {
  children: ChildLike[];
  value: string;
  onChange: (id: string) => void;
  // When set, adds a leading option (e.g. "All children") with value "".
  allLabel?: string;
}

// Dropdown a parent uses to pick which of their children in this academy a
// screen should show. Renders nothing for a single child — nothing to choose.
export function ChildSelect({ children, value, onChange, allLabel }: Props) {
  if (children.length < 2) return null;
  return (
    <div className="flex items-center gap-2 mb-5">
      <GraduationCap className="w-4 h-4 text-[#024BAB]" />
      <label className="text-xs font-bold uppercase tracking-wider text-black">
        Child
      </label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="border-2 border-black bg-white px-3 py-2 text-sm font-bold focus:outline-none focus:border-[#024BAB] min-w-[200px]"
      >
        {allLabel && <option value="">{allLabel}</option>}
        {children.map((c) => (
          <option key={c._id} value={c._id}>
            {c.firstName} {c.lastName}
          </option>
        ))}
      </select>
    </div>
  );
}
