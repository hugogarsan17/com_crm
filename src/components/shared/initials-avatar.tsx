import { cn } from "@/lib/utils";

// Tonos pastel suaves; el color depende de un hash estable para que cada cliente conserve el suyo.
const PASTELS = [
  "bg-[#dbe8ff] text-[#1f2f4d]",
  "bg-[#ffd9c9] text-[#4d2618]",
  "bg-[#e6f5c4] text-[#2b3a10]",
  "bg-[#efe5d4] text-[#3e3220]",
  "bg-[#e7dcff] text-[#2f2350]",
  "bg-[#d3f0e6] text-[#173d31]",
  "bg-[#ffe2ec] text-[#4d1f2e]",
];

export function initialsOf(name: string) {
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((p) => p[0]?.toUpperCase())
      .join("") || "?"
  );
}

function hash(value: string) {
  let h = 0;
  for (let i = 0; i < value.length; i++) h = (h * 31 + value.charCodeAt(i)) | 0;
  return Math.abs(h);
}

export function InitialsAvatar({ name, seed, className }: { name: string; seed?: string; className?: string }) {
  return (
    <span
      className={cn(
        "flex size-11 shrink-0 items-center justify-center rounded-full text-sm font-semibold tracking-wide",
        PASTELS[hash(seed ?? name) % PASTELS.length],
        className,
      )}
      aria-hidden
    >
      {initialsOf(name)}
    </span>
  );
}
