// The streak tree is the app's signature visual, and its whole design goal
// is determinism: the same user always gets the same tree, and it grows
// rather than reshuffling. Those are properties worth pinning down.

import { describe, expect, it } from "vitest";

import { generateTree } from "./treeGenerator";

describe("generateTree", () => {
  it("is deterministic for the same inputs", () => {
    expect(generateTree("user-1", 12)).toEqual(generateTree("user-1", 12));
  });

  it("gives different users different trees", () => {
    const a = generateTree("user-1", 12);
    const b = generateTree("user-2", 12);

    expect(a.branches).not.toEqual(b.branches);
  });

  it("produces a tree even with no streak at all", () => {
    const tree = generateTree("user-1", 0);

    expect(tree.stage).toBe(0);
    expect(tree.branches.length).toBeGreaterThan(0);
  });

  it("grows through the stages as the streak lengthens", () => {
    const stages = [0, 5, 10, 20, 35].map((streak) => generateTree("user-1", streak).stage);

    expect(stages).toEqual([0, 1, 2, 3, 4]);
  });

  it("stops growing structurally once fully grown", () => {
    // Past 35 days the skeleton is fixed; only colour and leaf density keep
    // moving, so a long-running user's tree never suddenly rearranges.
    expect(generateTree("user-1", 35).branches).toEqual(generateTree("user-1", 400).branches);
  });

  it("only grows leaves once past the early stages", () => {
    expect(generateTree("user-1", 3).leaves).toHaveLength(0);
    expect(generateTree("user-1", 30).leaves.length).toBeGreaterThan(0);
  });

  it("cycles through the four seasons", () => {
    const seasons = [0, 30, 60, 90, 120].map((s) => generateTree("user-1", s).seasonName);

    expect(seasons).toEqual(["spring", "summer", "autumn", "winter", "spring"]);
  });

  it("survives a missing user id", () => {
    expect(() => generateTree(undefined, 5)).not.toThrow();
    expect(generateTree(undefined, 5)).toEqual(generateTree(undefined, 5));
  });

  it.each([-5, NaN, Infinity, null])("treats %s as no streak", (streak) => {
    expect(generateTree("user-1", streak).stage).toBe(0);
  });

  it("emits valid-looking SVG path data", () => {
    for (const path of generateTree("user-1", 20).branches) {
      expect(path).toMatch(/^M [\d.-]+ [\d.-]+ Q .* Z$/);
      expect(path).not.toMatch(/NaN|Infinity|undefined/);
    }
  });

  it("keeps every leaf inside the viewBox", () => {
    const tree = generateTree("user-1", 40);
    const [, , width, height] = tree.viewBox.split(" ").map(Number);

    for (const leaf of tree.leaves) {
      expect(leaf.cx).toBeGreaterThan(-20);
      expect(leaf.cx).toBeLessThan(width + 20);
      expect(leaf.cy).toBeGreaterThan(-20);
      expect(leaf.cy).toBeLessThan(height + 20);
    }
  });
});
