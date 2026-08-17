// Palette nébuleuse violet - cohérent avec le design system loopstat.
const PALETTE: [string, string][] = [
  ["#7c3aed", "#ec4899"],
  ["#a855f7", "#581c87"],
  ["#6d28d9", "#c026d3"],
  ["#4c1d95", "#a855f7"],
  ["#7c3aed", "#3b0764"],
  ["#5b21b6", "#a855f7"],
  ["#c026d3", "#7c3aed"],
  ["#7c3aed", "#1e1b4b"],
];

function hashString(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = ((h * 31) + s.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

/**
 * Deterministic gradient for an artist avatar. Uses the loopstat violet/mauve
 * palette so all avatars stay on-brand.
 */
export function avatarGradient(name: string): string {
  const [from, to] = PALETTE[hashString(name) % PALETTE.length];
  return `linear-gradient(135deg, ${from}, ${to})`;
}
