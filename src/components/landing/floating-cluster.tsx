import { type CSSProperties } from "react";

import { LANDING_FLOATERS, LANDING_ROWS } from "./landing-data";

const GLASS = "rgba(244,240,255,0.06)";
const GLASS_BORDER = "1px solid rgba(244,240,255,0.13)";

// Purely decorative, autonomous levitation only (no cursor interaction).
export function FloatingCluster() {
  return (
    <div className="relative h-full w-full" aria-hidden="true">
      {/* Mini dashboard */}
      <div className="absolute" style={{ right: "4%", top: "5%", width: 224 }}>
        <div
          className="ls-float"
          style={
            {
              "--ls-tilt": "-6deg",
              "--ls-dur": "6.5s",
              "--ls-amp": "-7px",
              padding: "13px 15px",
              borderRadius: 14,
              background: "rgba(20,12,36,0.86)",
              border: GLASS_BORDER,
            } as CSSProperties
          }
        >
          <div
            style={{
              font: "11px system-ui",
              letterSpacing: 1,
              color: "#8a7fb0",
              textTransform: "uppercase",
            }}
          >
            Top titres
          </div>
          {LANDING_ROWS.map((row) => (
            <div
              key={row.rank}
              style={{ display: "flex", alignItems: "center", gap: 9, marginTop: 10 }}
            >
              <span
                style={{
                  font: "italic 16px var(--font-instrument-serif), serif",
                  color: "#7c6fa0",
                  width: 12,
                }}
              >
                {row.rank}
              </span>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={row.src}
                alt=""
                width={30}
                height={30}
                style={{ borderRadius: 6, objectFit: "cover" }}
              />
              <span style={{ minWidth: 0, flex: 1 }}>
                <span
                  style={{
                    display: "block",
                    font: "500 12px system-ui",
                    color: "#f4f0ff",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {row.title}
                </span>
                <span
                  style={{ display: "block", font: "11px system-ui", color: "#a89ec8", marginTop: 2 }}
                >
                  {row.artist}
                </span>
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* KPI chip */}
      <div className="absolute" style={{ left: "2%", top: "56%" }}>
        <div
          className="ls-float"
          style={
            {
              "--ls-tilt": "5deg",
              "--ls-dur": "5.5s",
              "--ls-delay": "0.3s",
              "--ls-amp": "-9px",
              padding: "8px 12px",
              borderRadius: 13,
              background: GLASS,
              border: GLASS_BORDER,
            } as CSSProperties
          }
        >
          <div style={{ font: "italic 22px var(--font-instrument-serif), serif", lineHeight: 1, color: "#fff" }}>
            4&nbsp;499&nbsp;h
          </div>
          <div style={{ font: "10px system-ui", color: "#a89ec8", marginTop: 2 }}>au total</div>
        </div>
      </div>

      {/* Floating album covers + artist avatar */}
      {LANDING_FLOATERS.map((f) => (
        <div
          key={f.src}
          className={f.hideMobile ? "absolute hidden md:block" : "absolute"}
          style={{ left: f.left, top: f.top }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={f.src}
            alt=""
            width={f.size}
            height={f.size}
            className="ls-float"
            style={
              {
                "--ls-tilt": f.tilt,
                "--ls-amp": f.amp,
                "--ls-dur": f.dur,
                "--ls-delay": f.delay,
                borderRadius: f.round ? "50%" : 10,
                objectFit: "cover",
                display: "block",
                border: f.round ? "2px solid rgba(244,240,255,0.18)" : "none",
              } as CSSProperties
            }
          />
        </div>
      ))}
    </div>
  );
}
