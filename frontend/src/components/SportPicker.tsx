import { useEffect, useState } from "react";
import { sportAPI } from "@/services/api";
import type { Sport } from "@/types/hrms";

interface SportPickerProps {
  value: string;
  onChange: (sport: string) => void;
  className?: string;
  required?: boolean;
}

// Shared dropdown for picking a sport on both the student and coach forms,
// backed by the per-academy Sport list so headcounts can be tallied per sport.
export function SportPicker({
  value,
  onChange,
  className,
  required,
}: SportPickerProps) {
  const [sports, setSports] = useState<Sport[]>([]);
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState("");

  useEffect(() => {
    sportAPI.getAll().then((res: any) => setSports(res.data || []));
  }, []);

  const selectClass =
    className ||
    "w-full border-2 border-black px-3 py-2 text-sm font-medium outline-none bg-white";

  const handleAddConfirm = async () => {
    const name = newName.trim();
    if (!name) {
      setAdding(false);
      return;
    }
    const res: any = await sportAPI.create({ name });
    const created: Sport = res.data;
    setSports((prev) =>
      prev.some((s) => s._id === created._id)
        ? prev
        : [...prev, created].sort((a, b) => a.name.localeCompare(b.name)),
    );
    onChange(created.name);
    setAdding(false);
  };

  if (adding) {
    return (
      <div className="flex gap-2">
        <input
          autoFocus
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              handleAddConfirm();
            }
            if (e.key === "Escape") setAdding(false);
          }}
          placeholder="New sport name"
          className={selectClass}
        />
        <button
          type="button"
          onClick={handleAddConfirm}
          className="border-2 border-black px-3 text-sm font-bold shrink-0"
        >
          Add
        </button>
        <button
          type="button"
          onClick={() => setAdding(false)}
          className="border-2 border-black px-3 text-sm font-bold shrink-0"
        >
          X
        </button>
      </div>
    );
  }

  return (
    <select
      value={value}
      required={required}
      onChange={(e) => {
        if (e.target.value === "__add__") {
          setNewName("");
          setAdding(true);
          return;
        }
        onChange(e.target.value);
      }}
      className={selectClass}
    >
      <option value="">Select sport...</option>
      {sports.map((s) => (
        <option key={s._id} value={s.name}>
          {s.name}
        </option>
      ))}
      {value && !sports.some((s) => s.name === value) && (
        <option value={value}>{value}</option>
      )}
      <option value="__add__">+ Add new sport</option>
    </select>
  );
}
