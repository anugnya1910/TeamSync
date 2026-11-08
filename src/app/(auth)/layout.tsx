import Link from "next/link";
import { GrainOverlay } from "@/components/brand/grain-overlay";
import { Logo } from "@/components/brand/logo";
import { RotatingStatements } from "@/components/auth/rotating-statements";
import { ThemeToggle } from "@/components/theme-toggle";
import { AppProviders } from "../providers";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <AppProviders>
    <div className="grid min-h-dvh lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <aside
        className="relative hidden overflow-hidden border-r lg:flex lg:flex-col lg:justify-between lg:p-10"
        style={{
          background:
            "linear-gradient(150deg, color-mix(in oklab, var(--primary) 22%, var(--background)) 0%, color-mix(in oklab, var(--accent) 16%, var(--background)) 100%)",
        }}
      >
        <GrainOverlay />
        <Link href="/" className="relative w-fit rounded-md" aria-label="TeamSync home">
          <Logo label={null} />
        </Link>
        <div className="relative">
          <RotatingStatements />
        </div>
        <p className="relative text-sm text-foreground/70">
          Plan smarter. Collaborate better. Deliver together.
        </p>
      </aside>
      <div className="flex flex-col">
        <header className="flex items-center justify-between px-4 py-4 sm:px-6">
          <Link href="/" className="rounded-md lg:invisible" aria-label="TeamSync home">
            <Logo label={null} />
          </Link>
          <ThemeToggle />
        </header>
        <main id="main" className="flex flex-1 items-center justify-center px-4 pb-16 sm:px-6">
          <div className="w-full max-w-[400px]">{children}</div>
        </main>
      </div>
    </div>
    </AppProviders>
  );
}
