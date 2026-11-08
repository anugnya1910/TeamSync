"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { acceptInvite } from "@/app/(app)/w/[workspaceSlug]/_actions/workspace";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";

export function AcceptInvite({ token }: { token: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return (
    <div className="space-y-3">
      {error ? (
        <Alert variant="destructive" role="alert">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}
      <Button
        className="w-full"
        disabled={pending}
        onClick={() =>
          start(async () => {
            setError(null);
            const res = await acceptInvite(token);
            if (!res.ok) {
              setError(res.error.message);
              return;
            }
            router.push(`/w/${res.data.slug}`);
          })
        }
      >
        {pending ? "Joining…" : "Join workspace"}
      </Button>
    </div>
  );
}
