import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { cloudflare } from "@cloudflare/vite-plugin";

export default defineConfig({
  plugins: [react(), cloudflare()],
  // 環境によって IPv6 の localhost (::1) で応答しないことがあるため IPv4 で待ち受ける
  server: { host: "127.0.0.1" },
});
