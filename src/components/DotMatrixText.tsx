import type { CSSProperties } from "react";

const GLYPHS: Record<string, string[]> = {
  "0": [
    "0110",
    "1001",
    "1001",
    "1001",
    "1001",
    "1001",
    "0110",
  ],
  "1": [
    "0010",
    "0110",
    "0010",
    "0010",
    "0010",
    "0010",
    "0111",
  ],
  "2": [
    "0110",
    "1001",
    "0001",
    "0010",
    "0100",
    "1000",
    "1111",
  ],
  "3": [
    "1110",
    "0001",
    "0001",
    "0110",
    "0001",
    "0001",
    "1110",
  ],
  "4": [
    "1001",
    "1001",
    "1001",
    "1111",
    "0001",
    "0001",
    "0001",
  ],
  "5": [
    "1111",
    "1000",
    "1000",
    "1110",
    "0001",
    "1001",
    "0110",
  ],
  "6": [
    "0110",
    "1000",
    "1000",
    "1110",
    "1001",
    "1001",
    "0110",
  ],
  "7": [
    "1111",
    "0001",
    "0001",
    "0010",
    "0010",
    "0100",
    "0100",
  ],
  "8": [
    "0110",
    "1001",
    "1001",
    "0110",
    "1001",
    "1001",
    "0110",
  ],
  "9": [
    "0110",
    "1001",
    "1001",
    "0111",
    "0001",
    "0001",
    "0110",
  ],
  ":": [
    "0",
    "1",
    "1",
    "0",
    "1",
    "1",
    "0",
  ],
};

const FALLBACK_GLYPH = [
  "0000",
  "0000",
  "0000",
  "0000",
  "0000",
  "0000",
  "0000",
];

const DOT_INDEXES = Array.from({ length: 28 }, (_, index) => index);

function getGlyph(character: string): string[] {
  return GLYPHS[character] || FALLBACK_GLYPH;
}

export default function DotMatrixText({
  value,
  label,
  className = "",
}: {
  value: string;
  label?: string;
  className?: string;
}) {
  return (
    <span className={`dot-matrix-text ${className}`} role="text" aria-label={label || value}>
      <span className="dot-matrix-visual" aria-hidden="true">
        {value.split("").map((character, characterIndex) => {
          const glyph = getGlyph(character);
          const columns = glyph[0]?.length || 3;
          const flattened = glyph.join("");
          return (
            <span
              className="dot-matrix-glyph"
              data-char={character}
              key={`${character}-${characterIndex}`}
              style={{ "--dot-columns": columns } as CSSProperties}
            >
              {DOT_INDEXES.slice(0, columns * glyph.length).map((dotIndex) => (
                <span
                  className={flattened[dotIndex] === "1" ? "dot active" : "dot"}
                  key={dotIndex}
                />
              ))}
            </span>
          );
        })}
      </span>
    </span>
  );
}
