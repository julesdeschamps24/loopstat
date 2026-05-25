import { writeFileSync } from "node:fs";
import { DEMO_TOP_ALBUMS, DEMO_TOP_TRACKS } from "../src/lib/demo/data";
import { searchReleaseGroup } from "../src/lib/musicbrainz/search";
import { fetchCoverUrl } from "../src/lib/musicbrainz/coverArt";

interface AlbumLookup {
  key: string;
  artistName: string;
  albumName: string;
  url: string | null;
}

const TRACK_TO_ALBUM: Record<string, string> = {
  "demo:espresso": "Short n' Sweet",
  "demo:birds-of-a-feather": "Hit Me Hard and Soft",
  "demo:beautiful-things": "Fireworks & Rollerblades",
  "demo:lose-control": "I've Tried Everything But Therapy",
  "demo:bar-song-tipsy": "Where I've Been, Isn't Where I'm Going",
  "demo:fortnight": "The Tortured Poets Department",
  "demo:houdini": "The Death of Slim Shady",
  "demo:cruel-summer": "Lover",
  "demo:please-please-please": "Short n' Sweet",
  "demo:texas-hold-em": "Cowboy Carter",
  "demo:i-had-some-help": "F-1 Trillion",
  "demo:stick-season": "Stick Season",
  "demo:million-dollar-baby": "Million Dollar Baby",
  "demo:end-of-beginning": "DECIDE",
  "demo:taste": "Short n' Sweet",
  "demo:di-mi-nombre": "El Mal Querer",
  "demo:not-like-us": "Not Like Us",
  "demo:greedy": "Think Later",
  "demo:we-cant-be-friends": "eternal sunshine",
  "demo:lovin-on-me": "Jackman.",
  "demo:good-luck-babe": "The Rise and Fall of a Midwest Princess",
  "demo:training-season": "Radical Optimism",
  "demo:water": "Tyla",
  "demo:gata-only": "GATA ONLY",
  "demo:flowers": "Endless Summer Vacation",
  "demo:agora-hills": "Scarlet",
  "demo:paint-the-town-red": "Scarlet",
  "demo:vampire": "GUTS",
  "demo:what-was-i-made-for": "Barbie The Album",
  "demo:si-no-estas": "Si No Estás",
};

async function lookupCover(artist: string, album: string): Promise<string | null> {
  try {
    const match = await searchReleaseGroup({ artist, album });
    if (!match) {
      console.error(`  no MBz match for "${album}" by "${artist}"`);
      return null;
    }
    const url = await fetchCoverUrl(match.mbid);
    if (!url) {
      console.error(`  MBz found "${album}" (mbid=${match.mbid}) but CAA has no front`);
    }
    return url;
  } catch (err) {
    console.error(`  err for "${album}" by "${artist}":`, (err as Error).message);
    return null;
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

async function main() {
  console.error("=== Looking up demo album covers ===");
  const albums: AlbumLookup[] = [];

  for (const album of DEMO_TOP_ALBUMS) {
    process.stderr.write(`[album] ${album.name} by ${album.artistNames[0]}... `);
    const url = await lookupCover(album.artistNames[0], album.name);
    process.stderr.write(url ? "OK\n" : "(none)\n");
    albums.push({
      key: album.albumId,
      artistName: album.artistNames[0],
      albumName: album.name,
      url,
    });
    await sleep(1100);
  }

  console.error("\n=== Looking up demo track album covers ===");
  const tracks: AlbumLookup[] = [];
  const cacheByPair = new Map<string, string | null>();
  for (const album of albums) {
    cacheByPair.set(`${album.artistName}::${album.albumName}`, album.url);
  }

  for (const track of DEMO_TOP_TRACKS) {
    const albumName = TRACK_TO_ALBUM[track.trackId];
    if (!albumName) {
      console.error(`[track] ${track.trackId}: NO ALBUM MAPPING`);
      tracks.push({ key: track.trackId, artistName: track.artistNames[0], albumName: "", url: null });
      continue;
    }
    const cacheKey = `${track.artistNames[0]}::${albumName}`;
    let url = cacheByPair.get(cacheKey) ?? null;
    if (cacheByPair.has(cacheKey)) {
      console.error(`[track] ${track.trackId}: cached (${url ? "url" : "none"})`);
    } else {
      process.stderr.write(`[track] ${track.trackId} → ${albumName} by ${track.artistNames[0]}... `);
      url = await lookupCover(track.artistNames[0], albumName);
      process.stderr.write(url ? "OK\n" : "(none)\n");
      cacheByPair.set(cacheKey, url);
      await sleep(1100);
    }
    tracks.push({ key: track.trackId, artistName: track.artistNames[0], albumName, url });
  }

  // Output for paste-in
  console.log("\n=== TRACKS ===");
  for (const t of tracks) {
    console.log(`${t.key}\t${JSON.stringify(t.url)}`);
  }
  console.log("\n=== ALBUMS ===");
  for (const a of albums) {
    console.log(`${a.key}\t${JSON.stringify(a.url)}`);
  }

  // Also dump JSON for programmatic patching
  writeFileSync("/tmp/demo-covers.json", JSON.stringify({ tracks, albums }, null, 2));
  console.error("\nWrote /tmp/demo-covers.json");
  process.exit(0);
}

main().catch((err) => {
  console.error("FATAL:", err);
  process.exit(1);
});
