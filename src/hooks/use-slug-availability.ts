"use client";

import { useQuery } from "@tanstack/react-query";
import { useDebouncedValue } from "./use-debounced-value";
import { createClient } from "@/lib/supabase/client";
import { isValidSlug } from "@/lib/validation/workspace";
import { suggestSlug } from "@/lib/utils/slug";

export type SlugStatus =
  | { state: "idle" }
  | { state: "invalid" }
  | { state: "checking" }
  | { state: "available" }
  | { state: "taken"; suggestion: string | null }
  | { state: "error" };

/** Debounced `is_slug_available` RPC check, with a suggestion when taken. */
export function useSlugAvailability(slug: string): SlugStatus {
  const debounced = useDebouncedValue(slug.trim().toLowerCase(), 350);
  const valid = isValidSlug(debounced);

  const query = useQuery({
    queryKey: ["slug-available", debounced],
    enabled: valid,
    staleTime: 10_000,
    queryFn: async () => {
      const supabase = createClient();
      const { data, error } = await supabase.rpc("is_slug_available", { p_slug: debounced });
      if (error) throw error;
      if (data) return { available: true, suggestion: null as string | null };
      // Find a free suggestion (a few cheap attempts).
      for (let n = 2; n <= 6; n++) {
        const candidate = suggestSlug(debounced, n);
        const { data: free } = await supabase.rpc("is_slug_available", { p_slug: candidate });
        if (free) return { available: false, suggestion: candidate };
      }
      return { available: false, suggestion: null };
    },
  });

  if (!slug) return { state: "idle" };
  if (slug.trim().toLowerCase() !== debounced) return { state: "checking" };
  if (!valid) return { state: "invalid" };
  if (query.isPending) return { state: "checking" };
  if (query.isError) return { state: "error" };
  return query.data.available
    ? { state: "available" }
    : { state: "taken", suggestion: query.data.suggestion };
}
