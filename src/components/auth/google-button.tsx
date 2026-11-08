"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { signInWithGoogle } from "@/app/(auth)/actions";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";

function GoogleGlyph() {
  return (
    <svg viewBox="0 0 24 24" className="size-4" aria-hidden>
      <path fill="#EA4335" d="M12 10.2v3.9h5.5c-.2 1.3-1.6 3.8-5.5 3.8-3.3 0-6-2.7-6-6s2.7-6 6-6c1.9 0 3.2.8 3.9 1.5l2.7-2.6C16.9 3.2 14.7 2.2 12 2.2 6.6 2.2 2.2 6.6 2.2 12s4.4 9.8 9.8 9.8c5.7 0 9.4-4 9.4-9.6 0-.6-.1-1.1-.2-1.6H12z" />
    </svg>
  );
}

export function GoogleButton({ next }: { next?: string | null }) {
  const [pending, start] = useTransition();
  return (
    <Button
      type="button"
      variant="outline"
      className="h-10 w-full"
      disabled={pending}
      onClick={() =>
        start(async () => {
          const res = await signInWithGoogle(next);
          if (res && !res.ok) toast.error(res.error.message);
        })
      }
    >
      {pending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <GoogleGlyph />}
      Continue with Google
    </Button>
  );
}
