import { TEAMS } from "../data/tournament";

// flagcdn PNGs — emoji flags render as plain letters on Windows, so images it is.
// Isolated here so a future swap to vendored SVGs touches one file.
export default function Flag({ code, size = 24, className = "" }) {
  const team = TEAMS[code];
  if (!team) return null;
  // Fixed 4:3 box with cover: flagcdn images are proportional-height (Qatar is
  // 40x16, Switzerland 40x40), which made adjacent rows visibly misaligned.
  const h = Math.round(size * 0.75);
  return (
    <img
      src={`https://flagcdn.com/w40/${team.iso2}.png`}
      srcSet={`https://flagcdn.com/w80/${team.iso2}.png 2x`}
      width={size}
      height={h}
      style={{ width: size, height: h, objectFit: "cover" }}
      alt=""
      loading="lazy"
      draggable={false}
      className={`shrink-0 rounded-[2px] ring-1 ring-white/10 select-none ${className}`}
    />
  );
}
