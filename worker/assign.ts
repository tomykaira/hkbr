import { randomInt } from "./random";

/**
 * 0..n-1 の完全順列（どの i でも result[i] !== i）を一様に選ぶ。
 * result[i] は i 番目の参加者に割り当てるお題の番号。
 * Fisher–Yates で並べ替え、不動点があればやり直す（期待試行回数は約 e 回）。
 */
export function derangement(n: number, rand: (n: number) => number = randomInt): number[] {
  if (n < 2) throw new Error("derangement requires n >= 2");
  for (;;) {
    const p = Array.from({ length: n }, (_, i) => i);
    for (let i = n - 1; i > 0; i--) {
      const j = rand(i + 1);
      [p[i], p[j]] = [p[j], p[i]];
    }
    if (p.every((v, i) => v !== i)) return p;
  }
}
