import { describe, expect, it } from "vitest";
import { derangement } from "./assign";

describe("derangement", () => {
  it("誰も自分のお題に当たらず、全お題がちょうど1回ずつ使われる", () => {
    for (let n = 2; n <= 30; n++) {
      for (let t = 0; t < 50; t++) {
        const p = derangement(n);
        expect(p.every((v, i) => v !== i)).toBe(true);
        expect([...p].sort((a, b) => a - b)).toEqual(Array.from({ length: n }, (_, i) => i));
      }
    }
  });

  it("n=3 の完全順列2通りがどちらも出る", () => {
    const seen = new Set<string>();
    for (let t = 0; t < 200; t++) seen.add(derangement(3).join(","));
    expect(seen).toEqual(new Set(["1,2,0", "2,0,1"]));
  });

  it("n<2 は例外", () => {
    expect(() => derangement(1)).toThrow();
  });
});
