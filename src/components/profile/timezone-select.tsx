"use client";

import { Check, ChevronsUpDown } from "lucide-react";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { listTimeZones } from "@/lib/utils/timezones";
import { cn } from "@/lib/utils";

type Props = {
  id?: string;
  value: string;
  onChange: (tz: string) => void;
  "aria-invalid"?: boolean;
  "aria-describedby"?: string;
};

/** Searchable IANA timezone picker. */
export function TimezoneSelect({ id, value, onChange, ...aria }: Props) {
  const [open, setOpen] = useState(false);
  const zones = useMemo(() => listTimeZones(), []);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          id={id}
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="h-10 w-full justify-between font-normal"
          {...aria}
        >
          <span className="truncate">{value || "Select timezone"}</span>
          <ChevronsUpDown className="size-4 opacity-60" aria-hidden />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-(--radix-popover-trigger-width) min-w-64 p-0" align="start">
        <Command>
          <CommandInput placeholder="Search timezones…" />
          <CommandList className="max-h-64">
            <CommandEmpty>No timezone found.</CommandEmpty>
            <CommandGroup>
              {zones.map((tz) => (
                <CommandItem
                  key={tz}
                  value={tz}
                  onSelect={() => {
                    onChange(tz);
                    setOpen(false);
                  }}
                >
                  <Check className={cn("size-4", tz === value ? "opacity-100" : "opacity-0")} aria-hidden />
                  {tz.replaceAll("_", " ")}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
