import { defineConfig } from "vitest/config";
import path from "path";

// 予約フローの純ロジックを対象にした軽量な単体テスト設定。
// UI レンダリングは含めないため environment は node（高速・依存が軽い）。
export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});
