import Image from "next/image";
import type { Screen } from "./screens";

/**
 * A product screenshot in a plain window frame. The frame supplies the browser chrome, so the
 * screenshots themselves should be cropped to the app only (no tabs, bookmarks or taskbar).
 */
export function ScreenFrame({
  screen,
  sizes,
  priority = false,
  elevated = false,
}: {
  screen: Screen;
  sizes: string;
  priority?: boolean;
  elevated?: boolean;
}) {
  return (
    <div
      className={`overflow-hidden rounded-xl border border-border bg-surface ${
        elevated ? "shadow-pop" : "shadow-card"
      }`}
    >
      <div className="flex h-9 items-center gap-1.5 border-b border-border bg-subtle px-3.5" aria-hidden="true">
        <span className="size-2.5 rounded-full bg-border" />
        <span className="size-2.5 rounded-full bg-border" />
        <span className="size-2.5 rounded-full bg-border" />
        <span className="ml-3 rounded-md bg-surface px-3 py-0.5 text-xs text-muted">trunqo.com</span>
      </div>
      <Image
        src={screen.src}
        alt={screen.alt}
        sizes={sizes}
        priority={priority}
        placeholder="blur"
        className="h-auto w-full"
      />
    </div>
  );
}
