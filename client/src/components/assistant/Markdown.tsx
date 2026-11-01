
"use client";

import Link from "next/link";
import { Fragment } from "react";

// Renders the small subset of Markdown the assistant writes: paragraphs, bullet and numbered
// lists, headings, **bold**, `code` and [links](/in-app-path). Built from React elements (no
// raw HTML), and only in-app links (starting with "/") become clickable.

type Props = { text: string; onNavigate?: () => void };

function Inline({ text, onNavigate }: Props) {
  const parts: React.ReactNode[] = [];
  const re = /\[([^\]]+)\]\(([^)\s]+)\)|\*\*([^*]+)\*\*|`([^`]+)`/g;
  let last = 0;
  let m: RegExpExecArray | null;

  while ((m = re.exec(text))) {
    if (m.index > last) parts.push(text.slice(last, m.index));

    if (m[1] !== undefined) {
      const href = m[2];

      if (href.startsWith("/") && !href.startsWith("//")) {
        // Same page with a new ?q= needs a full load so the table picks up the search.
        const samePage =
          typeof window !== "undefined" &&
          href.split("?")[0] === window.location.pathname;

        parts.push(
          samePage ? (
            <a
              key={m.index}
              href={href}
              className="font-medium text-accent underline decoration-accent/40 underline-offset-2 hover:decoration-accent"
            >
              {m[1]}
            </a>
          ) : (
            <Link
              key={m.index}
              href={href}
              onClick={onNavigate}
              className="font-medium text-accent underline decoration-accent/40 underline-offset-2 hover:decoration-accent"
            >
              {m[1]}
            </Link>
          )
        );
      } else {
        parts.push(m[1]);
      }
    } else if (m[3] !== undefined) {
      parts.push(
        <strong key={m.index} className="font-semibold text-foreground">
          {m[3]}
        </strong>
      );
    } else if (m[4] !== undefined) {
      parts.push(
        <code
          key={m.index}
          className="rounded bg-subtle px-1.5 py-0.5 text-[0.85em] font-mono text-foreground"
        >
          {m[4]}
        </code>
      );
    }

    last = re.lastIndex;
  }

  if (last < text.length) parts.push(text.slice(last));

  return <>{parts}</>;
}

export function Markdown({ text, onNavigate }: Props) {
  const lines = text.replace(/\r/g, "").split("\n");
  const blocks: React.ReactNode[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    if (!line.trim()) {
      i++;
      continue;
    }

    const bullet = /^\s*[-*•]\s+/;
    const numbered = /^\s*\d+[.)]\s+/;

    if (bullet.test(line) || numbered.test(line)) {
      const ordered = numbered.test(line);
      const items: string[] = [];

      while (
        i < lines.length &&
        (ordered ? numbered : bullet).test(lines[i])
      ) {
        let item = lines[i].replace(ordered ? numbered : bullet, "");
        i++;

        // Indented continuation lines belong to the item.
        while (
          i < lines.length &&
          /^\s{2,}\S/.test(lines[i]) &&
          !bullet.test(lines[i]) &&
          !numbered.test(lines[i])
        ) {
          item += " " + lines[i].trim();
          i++;
        }

        items.push(item);
      }

      const ListTag = ordered ? "ol" : "ul";

      blocks.push(
        <ListTag
          key={`l${i}`}
          className={`${ordered ? "list-decimal" : "list-disc"} space-y-1 pl-5 marker:text-muted`}
        >
          {items.map((it, k) => (
            <li key={k}>
              <Inline text={it} onNavigate={onNavigate} />
            </li>
          ))}
        </ListTag>
      );

      continue;
    }

    const heading = line.match(/^#{1,4}\s+(.+)$/);

    if (heading) {
      blocks.push(
        <p key={`h${i}`} className="font-semibold text-foreground">
          <Inline text={heading[1]} onNavigate={onNavigate} />
        </p>
      );

      i++;
      continue;
    }

    const para: string[] = [];

    while (
      i < lines.length &&
      lines[i].trim() &&
      !bullet.test(lines[i]) &&
      !numbered.test(lines[i]) &&
      !/^#{1,4}\s/.test(lines[i])
    ) {
      para.push(lines[i]);
      i++;
    }

    blocks.push(
      <p key={`p${i}`}>
        {para.map((p, k) => (
          <Fragment key={k}>
            {k > 0 && <br />}
            <Inline text={p} onNavigate={onNavigate} />
          </Fragment>
        ))}
      </p>
    );
  }

  return <div className="space-y-2.5">{blocks}</div>;
}
