import { readFileSync, writeFileSync } from "node:fs";

const PATH = "src/lib/demo/data.ts";
const COVERS = JSON.parse(readFileSync("/tmp/demo-covers.json", "utf8")) as {
  tracks: { key: string; url: string | null }[];
  albums: { key: string; url: string | null }[];
};

let src = readFileSync(PATH, "utf8");
let trackPatched = 0;
let albumPatched = 0;

for (const t of COVERS.tracks) {
  if (!t.url) continue;
  // Match: { trackId: "demo:xxx", ... albumImageUrl: null, ... }
  const re = new RegExp(
    `(trackId: "${t.key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}"[^}]*?albumImageUrl: )null`,
  );
  if (re.test(src)) {
    src = src.replace(re, `$1${JSON.stringify(t.url)}`);
    trackPatched++;
  }
}

for (const a of COVERS.albums) {
  if (!a.url) continue;
  const re = new RegExp(
    `(albumId: "${a.key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}"[^}]*?imageUrl: )null`,
  );
  if (re.test(src)) {
    src = src.replace(re, `$1${JSON.stringify(a.url)}`);
    albumPatched++;
  }
}

writeFileSync(PATH, src);
console.log(`Patched ${trackPatched} tracks + ${albumPatched} albums in ${PATH}`);
