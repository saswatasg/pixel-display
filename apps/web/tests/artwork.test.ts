import { test } from "node:test";
import assert from "node:assert/strict";
import { BLANK, paintLine, starterArt } from "../lib/artwork";
test("fast pointer strokes join their sampled points without mutating undo snapshots", () => {
  const blank = BLANK();
  const diagonal = paintLine(blank, [0, 0], [31, 31], "#ffffff");
  assert.equal(diagonal.filter(c => c === "#ffffff").length, 32);
  for (let i = 0; i < 32; i++) assert.equal(diagonal[i * 33], "#ffffff");
  assert.equal(blank.filter(c => c === "#ffffff").length, 0);
  const horizontal = paintLine(blank, [31, 7], [0, 7], "#ff0000");
  assert.equal(horizontal.filter(c => c === "#ff0000").length, 32);
  assert.ok(horizontal.slice(7 * 32, 8 * 32).every(c => c === "#ff0000"));
  assert.equal(paintLine(blank, [12, 12], [12, 12], "#ffffff").filter(c => c === "#ffffff").length, 1);
});
test("starter artwork is a complete 32×32 RGB grid", () => {
  for (const kind of ["sunset", "plant", "heart"] as const) {
    const grid = starterArt(kind);
    assert.equal(grid.length, 1024);
    assert.ok(grid.every(c => /^#[0-9a-f]{6}$/i.test(c)));
    assert.ok(new Set(grid).size > 1);
  }
});
