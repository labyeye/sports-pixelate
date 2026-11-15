import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

interface Props {
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
  placeholder?: string;
  className?: string;
}

/** Smoothly-opening dropdown picker (Radix) styled to match the neo-brutalist form inputs. */
export function PickerSelect({
  value,
  onChange,
  options,
  placeholder = "Select",
  className,
}: Props) {
  return (
    <Select value={value || undefined} onValueChange={onChange}>
      <SelectTrigger
        className={cn(
          "h-[42px] rounded-none shadow-none border-2 border-black px-3 text-sm bg-white",
          className,
        )}
      >
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent className="rounded-none border-2 border-black z-[90] max-h-64">
        {options.map((o) => (
          <SelectItem
            key={o.value}
            value={o.value}
            className="text-sm font-medium"
          >
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
