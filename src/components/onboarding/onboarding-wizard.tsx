"use client";

import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeft, ArrowRight, Info, Link2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useSyncExternalStore, useTransition } from "react";
import { toast } from "sonner";
import { completeOnboarding } from "@/app/(app)/onboarding/actions";
import { LogoMark } from "@/components/brand/logo";
import { FormField } from "@/components/forms/form-field";
import { AvatarUploader } from "@/components/profile/avatar-uploader";
import { TimezoneSelect } from "@/components/profile/timezone-select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SlugStatusMessage } from "@/components/workspace/slug-status";
import { useSlugAvailability } from "@/hooks/use-slug-availability";
import { motionTransition, useReducedMotionPreference } from "@/lib/motion";
import { initials } from "@/lib/utils/format";
import { parseInviteToken } from "@/lib/utils/invite";
import { slugify } from "@/lib/utils/slug";
import { suggestProjectKey } from "@/lib/utils/task-key";
import { detectTimeZone, isValidTimeZone } from "@/lib/utils/timezones";
import { onboardingProfileSchema } from "@/lib/validation/profile";
import { createWorkspaceSchema } from "@/lib/validation/workspace";
import { cn } from "@/lib/utils";

type Props = {
  userId: string;
  defaultName: string;
  defaultJobTitle: string;
  defaultAvatar: string;
  defaultTimezone: string | null;
  appUrl: string;
};

type Errors = Partial<Record<"fullName" | "jobTitle" | "timezone" | "name" | "slug" | "invite", string>>;

const STEPS = ["Profile", "Workspace", "Finish"] as const;
const noopSubscribe = () => () => {};

export function OnboardingWizard(props: Props) {
  const router = useRouter();
  const reduced = useReducedMotionPreference();
  const [step, setStep] = useState(0);
  const [direction, setDirection] = useState(1);
  const [pending, start] = useTransition();
  const [errors, setErrors] = useState<Errors>({});
  const [formError, setFormError] = useState<string | null>(null);

  const [fullName, setFullName] = useState(props.defaultName);
  const [jobTitle, setJobTitle] = useState(props.defaultJobTitle);
  // Auto-detect the device timezone after hydration (server snapshot = none) unless the profile
  // already has one or the user picks one.
  const detectedTz = useSyncExternalStore(noopSubscribe, detectTimeZone, () => null);
  const [chosenTz, setTimezone] = useState<string | null>(props.defaultTimezone);
  const timezone =
    chosenTz ?? (detectedTz && isValidTimeZone(detectedTz) ? detectedTz : "Asia/Kolkata");
  const [avatarUrl, setAvatarUrl] = useState(props.defaultAvatar);

  const [mode, setMode] = useState<"create" | "invite">("create");
  const [wsName, setWsName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);
  const [invite, setInvite] = useState("");
  const [projectName, setProjectName] = useState("");
  const [projectKey, setProjectKey] = useState("");
  const [projectKeyTouched, setProjectKeyTouched] = useState(false);
  const [template, setTemplate] = useState<"none" | "blank" | "college_project" | "event_planning">("none");
  const slugStatus = useSlugAvailability(slug);

  const go = (next: number) => {
    setDirection(next > step ? 1 : -1);
    setStep(next);
    setFormError(null);
  };

  function validateProfile(): boolean {
    const r = onboardingProfileSchema.safeParse({ fullName, jobTitle, timezone, avatarUrl });
    if (r.success) {
      setErrors({});
      return true;
    }
    const e: Errors = {};
    for (const issue of r.error.issues) {
      const k = issue.path[0] as keyof Errors;
      if (!e[k]) e[k] = issue.message;
    }
    setErrors(e);
    return false;
  }

  function validateWorkspace(): boolean {
    if (mode === "invite") {
      const token = parseInviteToken(invite);
      if (!token) {
        setErrors({ invite: "Paste the full invite link or token you received." });
        return false;
      }
      return true;
    }
    const r = createWorkspaceSchema.safeParse({ name: wsName, slug });
    const e: Errors = {};
    if (!r.success) {
      for (const issue of r.error.issues) {
        const k = issue.path[0] as keyof Errors;
        if (!e[k]) e[k] = issue.message;
      }
    }
    if (!e.slug && slugStatus.state === "taken") e.slug = "That workspace URL is already taken.";
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  function next() {
    if (step === 0 && !validateProfile()) return;
    if (step === 1) {
      if (!validateWorkspace()) return;
      if (mode === "invite") {
        router.push(`/invite/${parseInviteToken(invite)}`);
        return;
      }
    }
    go(step + 1);
  }

  function submit() {
    setFormError(null);
    if (template !== "none" && (!projectName.trim() || !/^[A-Z]{2,5}$/.test(projectKey))) {
      setFormError("Give the project a name and a 2–5 letter key, or choose “Skip for now”.");
      return;
    }
    start(async () => {
      const res = await completeOnboarding({
        profile: { fullName, jobTitle, timezone, avatarUrl },
        workspace: { name: wsName, slug },
        project: template !== "none" && projectName.trim() ? { name: projectName, key: projectKey, template } : null,
      });
      if (res && !res.ok) {
        const fe = res.error.fieldErrors ?? {};
        if (fe.slug?.[0]) {
          setErrors({ slug: fe.slug[0] });
          go(1);
        }
        setFormError(res.error.message);
        toast.error(res.error.message);
      }
    });
  }

  const variants = {
    enter: (d: number) => ({ opacity: 0, x: reduced ? 0 : d * 24 }),
    center: { opacity: 1, x: 0 },
    exit: (d: number) => ({ opacity: 0, x: reduced ? 0 : d * -24 }),
  };

  const urlHost = props.appUrl.replace(/^https?:\/\//, "").replace(/\/$/, "");

  return (
    <div className="mx-auto grid w-full max-w-5xl gap-8 lg:grid-cols-[minmax(0,1fr)_20rem]">
      <section aria-labelledby="onboarding-title" className="rounded-2xl border bg-card p-5 sm:p-8">
        <div className="mb-6 flex items-center justify-between gap-4">
          <h1 id="onboarding-title" className="text-page-title">
            {step === 0 ? "Tell us about you" : step === 1 ? "Set up your workspace" : "You're all set"}
          </h1>
          <ol className="flex items-center gap-2" aria-label="Onboarding progress">
            {STEPS.map((label, i) => (
              <li key={label} className="flex items-center">
                <span
                  className={cn(
                    "block h-2 rounded-full transition-all",
                    i === step ? "w-6 bg-primary" : i < step ? "w-2 bg-primary/60" : "w-2 bg-border",
                  )}
                  aria-current={i === step ? "step" : undefined}
                />
                <span className="sr-only">
                  Step {i + 1} of {STEPS.length}: {label}
                  {i < step ? " (completed)" : ""}
                </span>
              </li>
            ))}
          </ol>
        </div>

        {formError ? (
          <Alert variant="destructive" className="mb-4" role="alert">
            <AlertDescription>{formError}</AlertDescription>
          </Alert>
        ) : null}

        <div className="relative overflow-hidden">
          <AnimatePresence mode="wait" custom={direction} initial={false}>
            <motion.div
              key={step}
              custom={direction}
              variants={variants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={motionTransition(reduced, 0.24)}
              className="space-y-5"
            >
              {step === 0 ? (
                <>
                  <AvatarUploader userId={props.userId} name={fullName} value={avatarUrl} onChange={setAvatarUrl} />
                  <FormField label="Full name" error={errors.fullName}>
                    {(c) => (
                      <Input
                        {...c}
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                        autoComplete="name"
                        autoFocus
                        className="h-10"
                      />
                    )}
                  </FormField>
                  <FormField label="Role or job title" description="Optional — e.g. Team lead, Designer" error={errors.jobTitle}>
                    {(c) => (
                      <Input
                        {...c}
                        value={jobTitle}
                        onChange={(e) => setJobTitle(e.target.value)}
                        autoComplete="organization-title"
                        className="h-10"
                      />
                    )}
                  </FormField>
                  <FormField label="Timezone" description="Detected from your device — used for due dates and greetings." error={errors.timezone}>
                    {(c) => <TimezoneSelect {...c} value={timezone} onChange={setTimezone} />}
                  </FormField>
                </>
              ) : null}

              {step === 1 ? (
                <>
                  <div role="radiogroup" aria-label="Workspace setup" className="grid gap-2 sm:grid-cols-2">
                    {(
                      [
                        { v: "create", title: "Create a workspace", body: "Start fresh for your team." },
                        { v: "invite", title: "I have an invite link", body: "Join a teammate's workspace." },
                      ] as const
                    ).map((o) => (
                      <button
                        key={o.v}
                        type="button"
                        role="radio"
                        aria-checked={mode === o.v}
                        onClick={() => {
                          setMode(o.v);
                          setErrors({});
                        }}
                        className={cn(
                          "rounded-xl border p-4 text-left transition-colors",
                          mode === o.v ? "border-primary bg-primary/5" : "hover:bg-muted",
                        )}
                      >
                        <span className="block text-sm font-semibold">{o.title}</span>
                        <span className="mt-0.5 block text-xs text-muted-foreground">{o.body}</span>
                      </button>
                    ))}
                  </div>

                  {mode === "create" ? (
                    <>
                      <FormField label="Workspace name" error={errors.name}>
                        {(c) => (
                          <Input
                            {...c}
                            value={wsName}
                            autoFocus
                            className="h-10"
                            placeholder="e.g. CBIT Capstone"
                            onChange={(e) => {
                              setWsName(e.target.value);
                              if (!slugTouched) setSlug(slugify(e.target.value));
                            }}
                          />
                        )}
                      </FormField>
                      <FormField label="Workspace URL" error={errors.slug}>
                        {(c) => (
                          <div className="space-y-1.5">
                            <div className="flex h-10 items-center overflow-hidden rounded-lg border border-input focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50">
                              <span className="hidden h-full items-center border-r bg-surface-2 px-2.5 text-sm text-muted-foreground sm:flex">
                                {urlHost}/w/
                              </span>
                              <input
                                {...c}
                                value={slug}
                                onChange={(e) => {
                                  setSlugTouched(true);
                                  setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""));
                                }}
                                className="h-full min-w-0 flex-1 bg-transparent px-2.5 text-sm outline-none"
                                spellCheck={false}
                                autoCapitalize="none"
                              />
                            </div>
                            <SlugStatusMessage
                              status={slugStatus}
                              onUseSuggestion={(s) => {
                                setSlugTouched(true);
                                setSlug(s);
                              }}
                            />
                          </div>
                        )}
                      </FormField>
                    </>
                  ) : (
                    <>
                      <FormField
                        label="Invite link or token"
                        error={errors.invite}
                        description="Paste the link a teammate shared with you."
                      >
                        {(c) => (
                          <Input
                            {...c}
                            value={invite}
                            onChange={(e) => setInvite(e.target.value)}
                            className="h-10"
                            placeholder={`https://${urlHost}/invite/…`}
                          />
                        )}
                      </FormField>
                      <Alert>
                        <Link2 className="size-4" aria-hidden />
                        <AlertDescription>
                          We&apos;ll show you the invitation so you can join that workspace.
                        </AlertDescription>
                      </Alert>
                    </>
                  )}
                </>
              ) : null}

              {step === 2 ? (
                <>
                  <div className="rounded-xl border bg-surface-2 p-4">
                    <dl className="grid gap-3 text-sm sm:grid-cols-2">
                      <div>
                        <dt className="text-muted-foreground">Name</dt>
                        <dd className="font-medium">{fullName}</dd>
                      </div>
                      <div>
                        <dt className="text-muted-foreground">Timezone</dt>
                        <dd className="font-medium">{timezone}</dd>
                      </div>
                      <div>
                        <dt className="text-muted-foreground">Workspace</dt>
                        <dd className="font-medium">{wsName}</dd>
                      </div>
                      <div>
                        <dt className="text-muted-foreground">URL</dt>
                        <dd className="font-tabular break-all">/w/{slug}</dd>
                      </div>
                    </dl>
                  </div>
                  <fieldset className="space-y-3">
                    <legend className="text-sm font-semibold">First project <span className="font-normal text-muted-foreground">(optional)</span></legend>
                    <div role="radiogroup" aria-label="Project template" className="grid gap-2 sm:grid-cols-2">
                      {(
                        [
                          ["none", "Skip for now", "Create projects later"],
                          ["blank", "Blank", "An empty board"],
                          ["college_project", "College Project", "Research → Build → Test → Report"],
                          ["event_planning", "Event Planning", "Plan → Promote → Execute → Wrap-up"],
                        ] as const
                      ).map(([v, title, body]) => (
                        <button key={v} type="button" role="radio" aria-checked={template === v} onClick={() => setTemplate(v)} className={cn("rounded-xl border p-3 text-left", template === v ? "border-primary bg-primary/5" : "hover:bg-muted")}>
                          <span className="block text-sm font-semibold">{title}</span>
                          <span className="block text-xs text-muted-foreground">{body}</span>
                        </button>
                      ))}
                    </div>
                    {template !== "none" ? (
                      <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_7rem]">
                        <FormField label="Project name">
                          {(c) => (
                            <Input {...c} value={projectName} className="h-10" maxLength={80} onChange={(e) => { setProjectName(e.target.value); if (!projectKeyTouched) setProjectKey(suggestProjectKey(e.target.value)); }} />
                          )}
                        </FormField>
                        <FormField label="Key">
                          {(c) => (
                            <Input {...c} value={projectKey} className="h-10 font-tabular uppercase" maxLength={5} onChange={(e) => { setProjectKeyTouched(true); setProjectKey(e.target.value.toUpperCase().replace(/[^A-Z]/g, "")); }} />
                          )}
                        </FormField>
                        <p className="flex items-start gap-1.5 text-xs text-muted-foreground sm:col-span-2">
                          <Info className="mt-0.5 size-3.5 shrink-0" aria-hidden /> Templates add milestone and task titles only — no dates or progress.
                        </p>
                      </div>
                    ) : null}
                  </fieldset>
                </>
              ) : null}
            </motion.div>
          </AnimatePresence>
        </div>

        <div className="mt-8 flex items-center justify-between gap-3">
          <Button type="button" variant="ghost" onClick={() => go(step - 1)} disabled={step === 0 || pending}>
            <ArrowLeft className="size-4" aria-hidden /> Back
          </Button>
          {step < 2 ? (
            <Button type="button" onClick={next} className="h-10 px-4">
              {step === 1 && mode === "invite" ? "Open invite" : "Next"} <ArrowRight className="size-4" aria-hidden />
            </Button>
          ) : (
            <Button type="button" onClick={submit} disabled={pending} className="h-10 px-4" aria-busy={pending || undefined}>
              {pending ? "Creating workspace…" : "Go to dashboard"} <ArrowRight className="size-4" aria-hidden />
            </Button>
          )}
        </div>
      </section>

      <aside aria-label="Live preview" className="hidden lg:block">
        <div className="sticky top-8 space-y-3 rounded-2xl border bg-card p-5">
          <p className="text-meta text-muted-foreground uppercase">Preview</p>
          <div className="flex items-center gap-3">
            <div className="grid size-10 place-items-center rounded-xl bg-primary text-primary-foreground">
              {wsName ? (
                <span className="font-display text-lg font-bold">{wsName.trim()[0]?.toUpperCase()}</span>
              ) : (
                <LogoMark label={null} className="size-6" />
              )}
            </div>
            <div className="min-w-0">
              <p className="truncate font-semibold">{wsName || "Your workspace"}</p>
              <p className="truncate font-tabular text-xs text-muted-foreground">
                {urlHost}/w/{slug || "your-team"}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3 border-t pt-3">
            <Avatar className="size-9 border">
              {avatarUrl ? <AvatarImage src={avatarUrl} alt="" /> : null}
              <AvatarFallback>{initials(fullName)}</AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">{fullName || "Your name"}</p>
              <p className="truncate text-xs text-muted-foreground">{jobTitle || "Owner"}</p>
            </div>
          </div>
        </div>
      </aside>
    </div>
  );
}
