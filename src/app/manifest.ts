import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "loopstat",
    short_name: "loopstat",
    description: "Ton Spotify, en chiffres - stats détaillées, sans pub.",
    start_url: "/dashboard",
    display: "standalone",
    background_color: "#070710",
    theme_color: "#7c3aed",
    lang: "fr",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      {
        src: "/icons/icon-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
