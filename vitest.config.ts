import { defineConfig } from "vitest/config";

// 純粋関数のユニットテストのみ。Cloudflare の Vite プラグインは読み込まない
export default defineConfig({
  test: { include: ["worker/**/*.test.ts", "src/**/*.test.ts"] },
});
