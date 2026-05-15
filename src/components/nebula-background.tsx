"use client";

import { useEffect, useRef } from "react";
import { useTheme } from "next-themes";
import * as THREE from "three";

type CubeUserData = {
  rx: number;
  ry: number;
  floatA: number;
  floatSpeed: number;
  baseY: number;
};

/**
 * Nébuleuse + cubes flottants — port de `makeCubes()` du prototype
 * Claude-design (three-scenes.js l. 373-427). Monte un canvas fixe en
 * arrière-plan derrière tout le contenu, anime 14 cubes (7 sur mobile)
 * teintés cyan→magenta à 0.7× la vitesse de référence.
 *
 * Gated sur le dark mode (le mode clair n'a aucune visualisation 3D).
 * Respecte prefers-reduced-motion (rendu vide → seul le radial-gradient
 * du body::before reste visible). Pause la RAF quand l'onglet est caché.
 * Dispose toutes les ressources GPU au démontage.
 */
export function NebulaBackground() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const { resolvedTheme } = useTheme();

  useEffect(() => {
    if (resolvedTheme !== "dark") {
      console.log("[nebula] skip: not dark", { resolvedTheme });
      return;
    }

    const canvas = canvasRef.current;
    if (!canvas) {
      console.log("[nebula] skip: no canvas ref");
      return;
    }

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      console.log("[nebula] skip: prefers-reduced-motion");
      return;
    }
    console.log("[nebula] mounting Three.js scene");

    const HUE1 = 220; // cyan
    const HUE2 = 320; // magenta
    const SPEED = 0.7;
    const COUNT = window.innerWidth < 768 ? 7 : 14;

    const renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      alpha: true,
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    renderer.setClearColor(0x000000, 0);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 200);
    camera.position.z = 22;

    const cubes: THREE.Mesh<
      THREE.BoxGeometry,
      THREE.MeshBasicMaterial[]
    >[] = [];

    for (let i = 0; i < COUNT; i++) {
      const s = 1 + Math.random() * 2;
      const geo = new THREE.BoxGeometry(s, s, s);
      const baseHue = HUE1 + Math.random() * (HUE2 - HUE1);
      const materials = [
        new THREE.MeshBasicMaterial({
          color: new THREE.Color().setHSL((baseHue - 20) / 360, 0.7, 0.55),
        }),
        new THREE.MeshBasicMaterial({
          color: new THREE.Color().setHSL((baseHue + 20) / 360, 0.7, 0.55),
        }),
        new THREE.MeshBasicMaterial({
          color: new THREE.Color().setHSL((baseHue - 40) / 360, 0.7, 0.45),
        }),
        new THREE.MeshBasicMaterial({
          color: new THREE.Color().setHSL((baseHue + 40) / 360, 0.7, 0.65),
        }),
        new THREE.MeshBasicMaterial({
          color: new THREE.Color().setHSL(baseHue / 360, 0.7, 0.4),
        }),
        new THREE.MeshBasicMaterial({
          color: new THREE.Color().setHSL(baseHue / 360, 0.7, 0.6),
        }),
      ];
      const cube = new THREE.Mesh(geo, materials);
      cube.position.set(
        (Math.random() - 0.5) * 22,
        (Math.random() - 0.5) * 14,
        (Math.random() - 0.5) * 14,
      );
      cube.rotation.set(
        Math.random() * Math.PI,
        Math.random() * Math.PI,
        Math.random() * Math.PI,
      );
      cube.userData = {
        rx: 0.1 + Math.random() * 0.3,
        ry: 0.1 + Math.random() * 0.3,
        floatA: Math.random() * Math.PI * 2,
        floatSpeed: 0.3 + Math.random() * 0.5,
        baseY: cube.position.y,
      } satisfies CubeUserData;
      scene.add(cube);
      cubes.push(cube);
    }

    function resize() {
      const w = window.innerWidth;
      const h = window.innerHeight;
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    }
    resize();

    let raf = 0;
    let paused = false;
    const start = performance.now();
    function tick() {
      if (paused) return;
      const t = (performance.now() - start) / 1000;
      for (const cube of cubes) {
        const ud = cube.userData as CubeUserData;
        cube.rotation.x += 0.003 * ud.rx * SPEED;
        cube.rotation.y += 0.003 * ud.ry * SPEED;
        cube.position.y = ud.baseY + Math.sin(t * ud.floatSpeed + ud.floatA) * 0.6;
      }
      camera.position.x = Math.sin(t * 0.15) * 3;
      camera.position.y = Math.cos(t * 0.1) * 2;
      camera.lookAt(0, 0, 0);
      renderer.render(scene, camera);
      raf = requestAnimationFrame(tick);
    }
    raf = requestAnimationFrame(tick);

    function onVisibility() {
      if (document.hidden) {
        paused = true;
        cancelAnimationFrame(raf);
      } else if (paused) {
        paused = false;
        raf = requestAnimationFrame(tick);
      }
    }

    window.addEventListener("resize", resize);
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
      document.removeEventListener("visibilitychange", onVisibility);
      for (const cube of cubes) {
        cube.geometry.dispose();
        for (const m of cube.material) m.dispose();
      }
      renderer.dispose();
    };
  }, [resolvedTheme]);

  return (
    <>
      <canvas
        ref={canvasRef}
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 hidden h-screen w-screen dark:block"
        style={{ zIndex: -5 }}
      />
      {/* Voile radial sombre par-dessus, pour garder le texte lisible */}
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 hidden dark:block"
        style={{
          zIndex: -4,
          background:
            "radial-gradient(ellipse at center, transparent 30%, rgba(0,0,0,0.5) 100%)",
        }}
      />
    </>
  );
}
