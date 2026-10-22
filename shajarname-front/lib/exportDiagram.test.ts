import assert from "node:assert/strict";
import { computeDiagramBounds, resolveExportScale } from "./exportDiagram.ts";

const bounds = computeDiagramBounds(
  [
    { left: -240, top: 100, width: 210, height: 100 },
    { left: 420, top: 700, width: 210, height: 100 },
  ],
  50,
);

assert.deepEqual(bounds, {
  left: -290,
  top: 50,
  width: 970,
  height: 800,
});

assert.equal(resolveExportScale(1_000, 800, 4), 4);
assert.equal(resolveExportScale(5_000, 5_000, 4), 1.13);
assert.throws(() => computeDiagramBounds([]), /No visible family members/);

console.log("exportDiagram tests OK");
