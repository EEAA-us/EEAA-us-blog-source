import test from "node:test";
import assert from "node:assert/strict";
import { getAutomaticFailureNextIndex, getEndedTransition } from "./music-playback.mjs";

test("once mode stops after the current song regardless of its playlist position", () => {
  assert.deepEqual(getEndedTransition("once", 0, 4), { type: "stop" });
  assert.deepEqual(getEndedTransition("once", 3, 4), { type: "stop" });
});

test("single mode repeats the same song; loop mode advances and wraps", () => {
  assert.deepEqual(getEndedTransition("single", 2, 4), { type: "repeat", index: 2 });
  assert.deepEqual(getEndedTransition("loop", 2, 4), { type: "advance", index: 3 });
  assert.deepEqual(getEndedTransition("loop", 3, 4), { type: "advance", index: 0 });
  assert.deepEqual(getEndedTransition("loop", 0, 1), { type: "repeat", index: 0 });
});

test("random end selects a different song when possible", () => {
  assert.deepEqual(getEndedTransition("random", 1, 4, () => 0), { type: "advance", index: 0 });
  assert.deepEqual(getEndedTransition("random", 0, 1), { type: "repeat", index: 0 });
});

test("only loop and random modes skip failed tracks, with a bounded failure chain", () => {
  assert.equal(getAutomaticFailureNextIndex("once", 0, 3), null);
  assert.equal(getAutomaticFailureNextIndex("single", 0, 3), null);
  assert.equal(getAutomaticFailureNextIndex("loop", 1, 4, new Set([0, 1])), 2);
  assert.equal(getAutomaticFailureNextIndex("random", 1, 4, new Set([0, 1, 2])), 3);
  assert.equal(getAutomaticFailureNextIndex("loop", 3, 4, new Set([0, 1, 2])), null);
});

test("random failure recovery never repeats an attempted track", () => {
  assert.equal(getAutomaticFailureNextIndex("random", 1, 4, new Set([0]), () => 0), 2);
  assert.equal(getAutomaticFailureNextIndex("random", 1, 4, new Set([0]), () => 0.99), 3);
});
