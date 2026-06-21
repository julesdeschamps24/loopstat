"use client";

import { useEffect, useRef, type CSSProperties } from "react";

import { parallaxTranslate } from "@/lib/landing/parallax";
import { LANDING_FLOATING_COVERS, LANDING_ROWS } from "./landing-data";

const GLASS = "rgba(244,240,255,0.06)";
const GLASS_BORDER = "1px solid rgba(244,240,255,0.13)";

export function FloatingCluster() {
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const coarse = window.matchMedia("(pointer: coarse)").matches;
    if (reduce || coarse) return;

    const items = Array.from(root.querySelectorAll<HTMLElement>("[data-factor]"));
    let raf = 0;
    const onMove = (e: PointerEvent) => {
      const rect = root.getBoundingClientRect();
      const nx = ((e.clientX - rect.left) / rect.width - 0.5) * 2;
      const ny = ((e.clientY - rect.top) / rect.height - 0.5) * 2;
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        for (const el of items) {
          const { x, y } = parallaxTranslate(nx, ny, Number(el.dataset.factor));
          el.style.transform = `translate(${x}px, ${y}px)`;
        }
      });
    };
    window.addEventListener("pointermove", onMove);
    return () => {
      window.removeEventListener("pointermove", onMove);
      cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <div ref={rootRef} className="relative h-full w-full" aria-hidden="true">
      {/* Mini dashboard — parallax wrapper + inner float */}
      <div
        data-factor="10"
        className="absolute"
        style={{ right: "6%", top: "8%", width: 224 }}
      >
        <div
          className="ls-float"
          style={
            {
              "--ls-tilt": "-6deg",
              "--ls-dur": "8s",
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
                  style={{
                    display: "block",
                    font: "11px system-ui",
                    color: "#a89ec8",
                    marginTop: 2,
                  }}
                >
                  {row.artist}
                </span>
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* KPI chip */}
      <div data-factor="22" className="absolute" style={{ left: "4%", top: "62%" }}>
        <div
          className="ls-float"
          style={
            {
              "--ls-dur": "9s",
              "--ls-delay": "0.3s",
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

      {/* Vinyl satellite (favicon motif) */}
      <div data-factor="28" className="absolute hidden md:block" style={{ left: "10%", top: "12%" }}>
        <div
          className="ls-float"
          style={{ "--ls-dur": "7.2s", "--ls-delay": "0.8s" } as CSSProperties}
        >
          <span
            style={{
              display: "flex",
              width: 44,
              height: 44,
              borderRadius: "50%",
              background: "#fff",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <span
              style={{
                display: "flex",
                width: 15,
                height: 15,
                borderRadius: "50%",
                background: "#0a0712",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <span style={{ width: 5, height: 5, borderRadius: "50%", background: "#a78bfa" }} />
            </span>
          </span>
        </div>
      </div>

      {/* Floating album covers (extras hidden on mobile to stay above the fold) */}
      {LANDING_FLOATING_COVERS.map((c, i) => (
        <div
          key={c.src}
          data-factor={String(16 + i * 6)}
          className={i === 0 ? "absolute" : "absolute hidden md:block"}
          style={
            [
              { left: "62%", top: "70%" },
              { left: "40%", top: "26%" },
              { left: "78%", top: "40%" },
            ][i]
          }
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={c.src}
            alt=""
            width={48}
            height={48}
            className="ls-float"
            style={
              {
                "--ls-tilt": c.tilt,
                "--ls-dur": c.dur,
                "--ls-delay": c.delay,
                borderRadius: 9,
                objectFit: "cover",
                display: "block",
              } as CSSProperties
            }
          />
        </div>
      ))}
    </div>
  );
}
