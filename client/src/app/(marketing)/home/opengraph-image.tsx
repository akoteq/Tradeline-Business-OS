import { ImageResponse } from "next/og";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

// Literal values on purpose: Next reads these exports without running the file.
export const alt = "Trunqo: The trunk your businesses grow from";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/** The share preview (WhatsApp, LinkedIn, X, Slack). Built once at build time from the brand tokens. */
export default async function OpengraphImage() {
  let logo: string | null = null;
  try {
    const file = await readFile(join(process.cwd(), "public", "icon.png"));
    logo = `data:image/png;base64,${file.toString("base64")}`;
  } catch {
    // No logo file: render the wordmark alone rather than failing the build.
  }

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: "#f5f5f3",
          color: "#15141a",
          padding: "72px 80px",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
          {logo && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={logo} width={64} height={64} alt="" style={{ borderRadius: 14 }} />
          )}
          <div style={{ display: "flex", fontSize: 44, fontWeight: 700, letterSpacing: -1 }}>Trunqo</div>
        </div>

        <div style={{ display: "flex", flexDirection: "column" }}>
          <div
            style={{
              display: "flex",
              fontSize: 78,
              fontWeight: 700,
              lineHeight: 1.04,
              letterSpacing: -3,
              maxWidth: 940,
            }}
          >
            The trunk your businesses grow from.
          </div>
          <div style={{ display: "flex", marginTop: 28, fontSize: 30, color: "#62666d", maxWidth: 900 }}>
            The business operating system for owners running more than one company.
          </div>
        </div>

        <div style={{ display: "flex", height: 6, width: 120, background: "#d85a30", borderRadius: 3 }} />
      </div>
    ),
    { ...size },
  );
}
