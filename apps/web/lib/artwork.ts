export type PixelGrid = string[];
export const BLANK = () => Array<string>(1024).fill("#111218");
export function starterArt(kind: "sunset" | "plant" | "heart"): PixelGrid {
  const pixels = BLANK();
  const rect = (x: number, y: number, w: number, h: number, color: string) => {
    for (let py = y; py < y + h; py++) for (let px = x; px < x + w; px++) if (px >= 0 && px < 32 && py >= 0 && py < 32) pixels[py * 32 + px] = color;
  };
  if (kind === "sunset") {
    const sky = ["#272341", "#3e2b54", "#674268", "#a45a78", "#dc827b", "#f5b588", "#fbdba2", "#e9b58c"];
    for (let y = 0; y < 32; y++) rect(0, y, 32, 1, sky[Math.min(7, Math.floor(y / 4))]);
    for (let y = 6; y < 24; y++) for (let x = 6; x < 25; x++) if ((x - 15) ** 2 + (y - 15) ** 2 < 70) rect(x, y, 1, 1, "#ffe3a1");
    for (let x = 0; x < 32; x++) {
      const top = 21 + Math.round(3 * Math.sin(x / 5)); rect(x, top, 1, 32 - top, "#453653");
      const front = 27 + Math.round(2 * Math.sin(x / 6 + 2)); rect(x, front, 1, 32 - front, "#252239");
    }
    rect(26, 4, 1, 1, "#ffeecf"); rect(4, 6, 1, 1, "#ffeecf");
  } else if (kind === "plant") {
    rect(0, 0, 32, 32, "#dfebd9"); rect(15, 8, 2, 17, "#42754c");
    rect(7, 10, 8, 4, "#78a26d"); rect(10, 14, 5, 3, "#5c8e59");
    rect(17, 6, 7, 5, "#6a9561"); rect(17, 17, 8, 3, "#82ad75");
    rect(10, 24, 12, 2, "#cb8864"); rect(11, 26, 10, 4, "#af7258");
  } else {
    rect(0, 0, 32, 32, "#38243d");
    const heart = [".###...###.", "#####.#####", "###########", "###########", ".#########.", "..#######..", "...#####...", "....###....", ".....#....."];
    heart.forEach((r, y) => [...r].forEach((c, x) => { if (c === "#") rect(5 + x * 2, 7 + y * 2, 2, 2, y < 3 ? "#ffaeaa" : "#ef737c"); }));
  }
  return pixels;
}
export function gridToDataUrl(pixels: PixelGrid): string {
  const canvas = document.createElement("canvas"); canvas.width = canvas.height = 32;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Could not render artwork.");
  pixels.forEach((c, i) => { ctx.fillStyle = c; ctx.fillRect(i % 32, Math.floor(i / 32), 1, 1); });
  return canvas.toDataURL("image/png");
}

/** Join sampled pointer positions so fast strokes do not leave holes. */
export function paintLine(pixels: PixelGrid, from: [number, number], to: [number, number], color: string): PixelGrid {
  const next = pixels.slice();
  let [x, y] = from; const [endX, endY] = to;
  const dx = Math.abs(endX - x), dy = -Math.abs(endY - y), sx = x < endX ? 1 : -1, sy = y < endY ? 1 : -1;
  let error = dx + dy;
  while (true) {
    if (x >= 0 && x < 32 && y >= 0 && y < 32) next[y * 32 + x] = color;
    if (x === endX && y === endY) break;
    const doubled = 2 * error;
    if (doubled >= dy) { error += dy; x += sx; }
    if (doubled <= dx) { error += dx; y += sy; }
  }
  return next;
}
