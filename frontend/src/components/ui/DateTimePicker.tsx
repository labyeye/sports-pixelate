// Styled wrapper around native <input type="date"/"time"> — no new date-lib
// dependency, matches the hand-rolled border-2/black input convention used
// across every feature page in this app.
interface DateTimePickerProps {
  label?: string;
  type?: "date" | "time";
  value?: string;
  onChange: (value: string) => void;
  required?: boolean;
  className?: string;
}

export function DateTimePicker({
  label,
  type = "date",
  value,
  onChange,
  required,
  className,
}: DateTimePickerProps) {
  return (
    <div>
      {label && (
        <label className="block text-xs font-bold uppercase mb-1">
          {label}
          {required ? " *" : ""}
        </label>
      )}
      <input
        type={type}
        value={value || ""}
        required={required}
        onChange={(e) => onChange(e.target.value)}
        className={
          className ||
          "w-full border-2 border-black px-3 py-2 text-sm font-semibold outline-none bg-white"
        }
      />
    </div>
  );
}
