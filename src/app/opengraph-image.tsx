import { ImageResponse } from "next/og";

export const alt = "TeamSync — Projects that tell you how they're doing.";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/** Static Open Graph image, generated at build time. */
export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: 72,
          background: "linear-gradient(135deg, #FAFAF7 0%, #ECEBFF 55%, #FFE4DD 100%)",
          color: "#14161C",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 16, fontSize: 40, fontWeight: 700 }}>
          <div
            style={{
              width: 56,
              height: 56,
              borderRadius: 16,
              background: "#4F46E5",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <div style={{ width: 18, height: 18, borderRadius: 9, background: "#FF5A3C" }} />
          </div>
          <span>
            Team<span style={{ color: "#C53A1E" }}>Sync</span>
          </span>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <div style={{ fontSize: 76, fontWeight: 800, lineHeight: 1.05, letterSpacing: -2 }}>
            Projects that tell you how they&apos;re doing.
          </div>
          <div style={{ fontSize: 30, color: "#4A4F5C" }}>
            Plan smarter. Collaborate better. Deliver together.
          </div>
        </div>
      </div>
    ),
    size,
  );
}
