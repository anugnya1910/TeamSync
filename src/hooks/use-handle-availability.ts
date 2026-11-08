"use client";

import { useQuery } from "@tanstack/react-query";
import { useDebouncedValue } from "./use-debounced-value";
import { createClient } from "@/lib/supabase/client";
import { isValidHandle } from "@/lib/validation/workspace";

export type HandleStatus = "idle" | "same" | "invalid" | "checking" | "available" | "taken" | "error";

export function useHandleAvailability(handle: string, current: string): HandleStatus {
  const value = handle.trim().toLowerCase();
  const debounced = useDebouncedValue(value, 350);
  const enabled = isValidHandle(debounced) && debounced !== current.toLowerCase();
  const q = useQuery({
    queryKey: ["handle-available", debounced],
    enabled,
    staleTime: 10_000,
    queryFn: async () => {
      const { data, error } = await createClient().rpc("is_handle_available", { p_handle: debounced });
      if (error) throw error;
      return Boolean(data);
    },
  });
  if (!value) return "idle";
  if (value === current.toLowerCase()) return "same";
  if (value !== debounced) return "checking";
  if (!isValidHandle(value)) return "invalid";
  if (q.isPending) return "checking";
  if (q.isError) return "error";
  return q.data ? "available" : "taken";
}
