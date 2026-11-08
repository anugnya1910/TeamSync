import Link from "next/link";
import {
  Activity,
  ArrowRight,
  BarChart3,
  Bot,
  FolderKanban,
  GitBranch,
  Radio,
  Scale,
  UserPlus,
  Workflow,
} from "lucide-react";
import { GrainOverlay } from "@/components/brand/grain-overlay";
import { Logo } from "@/components/brand/logo";
import { HeroIllustration } from "@/components/marketing/hero-illustration";
import { PulseDemo } from "@/components/marketing/pulse-demo";
import { SiteNav } from "@/components/marketing/site-nav";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";

const STEPS = [
  {
    icon: UserPlus,
    title: "Create a workspace",
    body: "Sign up, name your workspace and invite your team with a link — no email setup needed.",
  },
  {
    icon: FolderKanban,
    title: "Plan the work",
    body: "Break projects into milestones and tasks with owners, priorities, effort and due dates.",
  },
  {
    icon: Activity,
    title: "Let the project talk",
    body: "Pulse, workload balance and risk detection explain how things are going — and what to do next.",
  },
];

const FEATURES = [
  {
    icon: Activity,
    title: "Project Pulse",
    body: "An explainable 0–100 health score. Every point traces back to a factor you can act on.",
    span: "md:col-span-2",
  },
  {
    icon: Scale,
    title: "Workload Balance",
    body: "See utilisation against capacity and get reassignment suggestions that measurably even things out.",
    span: "",
  },
  {
    icon: GitBranch,
    title: "Dependency Map",
    body: "Link tasks, block cycles before they happen and spot the longest open chain at a glance.",
    span: "",
  },
  {
    icon: Radio,
    title: "Realtime boards",
    body: "Kanban, list and calendar views that update live, with presence so you know who's looking.",
    span: "md:col-span-2",
  },
  {
    icon: Bot,
    title: "AI assistant — with fallback",
    body: "Draft task breakdowns and summaries as editable previews. If AI is unavailable, rules take over.",
    span: "md:col-span-2",
  },
  {
    icon: BarChart3,
    title: "Analytics",
    body: "Burndown, throughput and contribution charts built only from what your team actually did.",
    span: "",
  },
];

const FAQ = [
  {
    q: "Is TeamSync free?",
    a: "Yes. TeamSync runs entirely on free tiers (Supabase Free, Vercel Hobby) and has no paid plan. It is built for academic and non-commercial use.",
  },
  {
    q: "How is my team's data kept separate from other workspaces?",
    a: "Every table is protected by PostgreSQL Row Level Security. Queries only ever return rows from workspaces you belong to, and this is verified by automated cross-workspace tests.",
  },
  {
    q: "Does it work without AI?",
    a: "Completely. AI is optional and only drafts suggestions you review before applying. When AI is switched off or unavailable, deterministic rules generate the same kinds of drafts and are clearly labelled.",
  },
  {
    q: "Can I use it on my phone?",
    a: "Yes. The interface is designed from 360px phones up to wide desktops, with a bottom navigation bar and touch-friendly controls on small screens.",
  },
];

export default function LandingPage() {
  return (
    <div className="flex min-h-full flex-col">
      <a
        href="#main"
        className="sr-only z-50 rounded-md bg-primary px-3 py-2 text-primary-foreground focus:not-sr-only focus:fixed focus:top-3 focus:left-3"
      >
        Skip to content
      </a>
      <SiteNav />
      <main id="main" className="flex-1">
        {/* Hero */}
        <section className="relative overflow-hidden border-b">
          <div
            aria-hidden
            className="absolute inset-0 -z-10"
            style={{
              background:
                "radial-gradient(60% 50% at 20% 0%, color-mix(in oklab, var(--primary) 14%, transparent), transparent 70%), radial-gradient(45% 40% at 90% 10%, color-mix(in oklab, var(--accent) 12%, transparent), transparent 70%)",
            }}
          />
          <GrainOverlay className="-z-10" />
          <div className="mx-auto grid max-w-6xl gap-12 px-4 pt-16 pb-16 sm:px-6 lg:pt-24 lg:pb-24">
            <div className="mx-auto max-w-3xl text-center">
              <p className="mb-4 inline-flex items-center gap-2 rounded-full border bg-card px-3 py-1 text-xs font-medium text-muted-foreground">
                <span className="size-1.5 rounded-full bg-accent" aria-hidden />
                Plan smarter. Collaborate better. Deliver together.
              </p>
              <h1 className="text-display">Projects that tell you how they&apos;re doing.</h1>
              <p className="marketing-body mx-auto mt-6 max-w-2xl text-muted-foreground">
                TeamSync is a calm, collaborative workspace for student and small teams — with an
                explainable health score, workload balancing and live boards, all on free tiers.
              </p>
              <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
                <Button asChild size="lg" className="h-11 px-5 text-base">
                  <Link href="/signup">
                    Start free <ArrowRight className="size-4" aria-hidden />
                  </Link>
                </Button>
                <Button asChild size="lg" variant="outline" className="h-11 px-5 text-base">
                  <a href="#pulse">See how Pulse works</a>
                </Button>
              </div>
            </div>
            <HeroIllustration />
          </div>
        </section>

        {/* How it works */}
        <section id="how-it-works" className="scroll-mt-20 border-b">
          <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
            <h2 className="font-display text-3xl font-semibold tracking-tight sm:text-4xl">
              How it works
            </h2>
            <ol className="mt-10 grid gap-6 md:grid-cols-3">
              {STEPS.map((s, i) => (
                <li key={s.title} className="rounded-2xl border bg-card p-6">
                  <div className="flex items-center gap-3">
                    <span className="grid size-10 place-items-center rounded-xl bg-primary/10 text-primary">
                      <s.icon className="size-5" aria-hidden />
                    </span>
                    <span className="font-tabular text-sm text-muted-foreground">
                      Step {i + 1}
                    </span>
                  </div>
                  <h3 className="text-card-title mt-4">{s.title}</h3>
                  <p className="mt-2 text-sm text-muted-foreground">{s.body}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* Features bento */}
        <section id="features" className="scroll-mt-20 border-b bg-surface-2/50">
          <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
            <h2 className="font-display text-3xl font-semibold tracking-tight sm:text-4xl">
              Calm surfaces, loud signals
            </h2>
            <p className="marketing-body mt-3 max-w-2xl text-muted-foreground">
              Colour is reserved for meaning, so the few things that need your attention stand out.
            </p>
            <ul className="mt-10 grid gap-4 md:grid-cols-3">
              {FEATURES.map((f) => (
                <li
                  key={f.title}
                  className={`group rounded-2xl border bg-card p-6 transition-[transform,box-shadow] duration-200 hover:-translate-y-0.5 hover:shadow-[var(--shadow-e2)] motion-reduce:transition-none motion-reduce:hover:translate-y-0 ${f.span}`}
                >
                  <f.icon
                    className={`size-6 ${f.title.startsWith("AI") ? "text-ai-text" : "text-primary"}`}
                    aria-hidden
                  />
                  <h3 className="text-card-title mt-4">{f.title}</h3>
                  <p className="mt-2 text-sm text-muted-foreground">{f.body}</p>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* Pulse demo */}
        <section id="pulse" className="scroll-mt-20 border-b">
          <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <p className="text-meta tracking-wide text-accent-text uppercase">
                  Interactive formula demo
                </p>
                <h2 className="mt-2 font-display text-3xl font-semibold tracking-tight sm:text-4xl">
                  Try the Pulse formula
                </h2>
                <p className="marketing-body mt-3 max-w-2xl text-muted-foreground">
                  Move the sliders to see how each factor moves the score. Weights: completion vs
                  schedule 30, overdue pressure 25, deadline readiness 20, blocked work 15,
                  workload balance 10. These are your inputs — not real project data.
                </p>
              </div>
              <Workflow className="hidden size-10 text-muted-foreground md:block" aria-hidden />
            </div>
            <div className="mt-10">
              <PulseDemo />
            </div>
          </div>
        </section>

        {/* FAQ */}
        <section id="faq" className="scroll-mt-20">
          <div className="mx-auto max-w-3xl px-4 py-20 sm:px-6">
            <h2 className="font-display text-3xl font-semibold tracking-tight sm:text-4xl">
              Frequently asked questions
            </h2>
            <Accordion type="single" collapsible className="mt-8">
              {FAQ.map((item, i) => (
                <AccordionItem key={item.q} value={`faq-${i}`}>
                  <AccordionTrigger className="text-base">{item.q}</AccordionTrigger>
                  <AccordionContent className="text-muted-foreground">{item.a}</AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
            <div className="mt-12 flex flex-col items-center gap-3 rounded-2xl border bg-card p-8 text-center">
              <h2 className="text-section">Ready to give your project a pulse?</h2>
              <Button asChild size="lg" className="h-11 px-5">
                <Link href="/signup">Create your workspace</Link>
              </Button>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t">
        <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-10 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <div className="space-y-2">
            <Logo label="TeamSync" />
            <p className="text-sm text-muted-foreground">
              Plan smarter. Collaborate better. Deliver together.
            </p>
          </div>
          <nav aria-label="Footer" className="flex flex-wrap gap-x-5 gap-y-2 text-sm">
            <a
              href="https://github.com/anugnya1910/TeamSync"
              className="text-muted-foreground hover:text-foreground"
              rel="noopener noreferrer"
              target="_blank"
            >
              GitHub
            </a>
            <a
              href="https://github.com/anugnya1910/TeamSync/tree/main/docs"
              className="text-muted-foreground hover:text-foreground"
              rel="noopener noreferrer"
              target="_blank"
            >
              Docs
            </a>
            <Link href="/login" className="text-muted-foreground hover:text-foreground">
              Log in
            </Link>
          </nav>
          <p className="text-xs text-muted-foreground">Built for academic purposes.</p>
        </div>
      </footer>
    </div>
  );
}
