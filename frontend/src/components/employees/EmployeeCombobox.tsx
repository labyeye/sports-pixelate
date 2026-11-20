import { useEffect, useRef, useState } from "react";

interface EmployeeOption {
  _id: string;
  user?: string;
  firstName: string;
  lastName: string;
  designation?: string;
  employeeId?: string;
  avatar?: string;
}

interface Props {
  employees: EmployeeOption[];
  value: string;
  onChange: (id: string) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  /** Which field's value is used for onChange/value matching — defaults to _id.
   *  Pass "user" for pickers that assign by the linked User id (e.g. task assignee). */
  idKey?: "_id" | "user";
}

// Searchable employee picker showing photo + name + designation, used anywhere
// a form assigns a record to one specific employee.
export function EmployeeCombobox({
  employees,
  value,
  onChange,
  placeholder = "Type to search employee...",
  className = "border-2 border-black px-3 py-2 text-sm font-medium outline-none bg-white w-full",
  disabled = false,
  idKey = "_id",
}: Props) {
  const selected = employees.find((e) => e[idKey] === value);
  const [query, setQuery] = useState(
    selected ? `${selected.firstName} ${selected.lastName}` : "",
  );
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const emp = employees.find((e) => e[idKey] === value);
    setQuery(emp ? `${emp.firstName} ${emp.lastName}` : "");
  }, [value, employees]);

  useEffect(() => {
    const onClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  const filtered = employees.filter((e) => {
    const q = query.toLowerCase().trim();
    if (!q) return true;
    return (
      `${e.firstName} ${e.lastName}`.toLowerCase().includes(q) ||
      e.designation?.toLowerCase().includes(q) ||
      e.employeeId?.toLowerCase().includes(q)
    );
  });

  return (
    <div ref={ref} className="relative">
      <input
        type="text"
        value={query}
        disabled={disabled}
        onFocus={() => setOpen(true)}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
          if (value) onChange("");
        }}
        placeholder={placeholder}
        className={className}
      />
      {open && (
        <div className="absolute z-10 top-full left-0 right-0 mt-1 max-h-64 overflow-auto border-2 border-black bg-white shadow-lg">
          {filtered.length === 0 ? (
            <p className="px-3 py-2 text-sm text-muted-foreground">
              No employees found
            </p>
          ) : (
            filtered.map((e) => (
              <button
                key={e._id}
                type="button"
                onClick={() => {
                  onChange(e[idKey] as string);
                  setQuery(`${e.firstName} ${e.lastName}`);
                  setOpen(false);
                }}
                className="flex items-center gap-2 w-full px-3 py-2 text-left hover:bg-[#024BAB]/10 border-b border-black/10 last:border-0"
              >
                <div className="w-8 h-8 border border-black shrink-0 overflow-hidden bg-[#024BAB] flex items-center justify-center text-xs font-bold text-white rounded-full">
                  {e.avatar ? (
                    <img
                      src={e.avatar}
                      alt={e.firstName}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    e.firstName?.[0]?.toUpperCase()
                  )}
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-black truncate">
                    {e.firstName} {e.lastName}
                  </p>
                  {e.designation && (
                    <p className="text-[11px] text-muted-foreground truncate">
                      {e.designation}
                    </p>
                  )}
                </div>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
