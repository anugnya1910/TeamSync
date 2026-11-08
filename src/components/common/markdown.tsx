"use client";

import ReactMarkdown from "react-markdown";
import rehypeSanitize, { defaultSchema } from "rehype-sanitize";
import remarkGfm from "remark-gfm";
import { cn } from "@/lib/utils";

const schema = {
  ...defaultSchema,
  // No raw HTML, no images (avoid tracking pixels / XSS vectors), safe links only.
  tagNames: (defaultSchema.tagNames ?? []).filter((t) => !["img", "iframe", "input"].includes(t)),
  protocols: { ...defaultSchema.protocols, href: ["http", "https", "mailto"] },
};

/** Sanitised markdown (spec §H.1: react-markdown + rehype-sanitize, no raw HTML). */
export function Markdown({
  children,
  className,
  mentionHandles = [],
}: {
  children: string;
  className?: string;
  /** Handles to highlight as mentions (only real project members). */
  mentionHandles?: string[];
}) {
  const set = new Set(mentionHandles.map((h) => h.toLowerCase()));
  const source = set.size
    ? children.replace(/(^|[^a-zA-Z0-9_@])@([a-zA-Z0-9_]{3,20})/g, (m, pre: string, h: string) =>
        set.has(h.toLowerCase()) ? `${pre}[@${h}](#mention-${h.toLowerCase()})` : m,
      )
    : children;
  return (
    <div className={cn("prose-ts text-sm leading-6 break-words", className)}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[[rehypeSanitize, schema]]}
        components={{
          a: ({ href, children: c }) =>
            href?.startsWith("#mention-") ? (
              <span className="rounded bg-primary/10 px-1 font-medium text-primary">{c}</span>
            ) : (
              <a href={href} target="_blank" rel="noopener noreferrer nofollow" className="text-primary underline underline-offset-2">
                {c}
              </a>
            ),
          p: ({ children: c }) => <p className="my-1.5 first:mt-0 last:mb-0">{c}</p>,
          ul: ({ children: c }) => <ul className="my-1.5 list-disc pl-5">{c}</ul>,
          ol: ({ children: c }) => <ol className="my-1.5 list-decimal pl-5">{c}</ol>,
          code: ({ children: c }) => <code className="rounded bg-surface-2 px-1 py-0.5 font-tabular text-[0.85em]">{c}</code>,
          pre: ({ children: c }) => <pre className="my-2 overflow-x-auto rounded-lg bg-surface-2 p-3 text-xs">{c}</pre>,
          blockquote: ({ children: c }) => <blockquote className="my-2 border-l-2 pl-3 text-muted-foreground">{c}</blockquote>,
          h1: ({ children: c }) => <h3 className="mt-3 mb-1 text-base font-semibold">{c}</h3>,
          h2: ({ children: c }) => <h4 className="mt-3 mb-1 text-sm font-semibold">{c}</h4>,
          h3: ({ children: c }) => <h5 className="mt-2 mb-1 text-sm font-semibold">{c}</h5>,
          table: ({ children: c }) => (
            <div className="my-2 overflow-x-auto">
              <table className="text-xs">{c}</table>
            </div>
          ),
        }}
      >
        {source}
      </ReactMarkdown>
    </div>
  );
}
