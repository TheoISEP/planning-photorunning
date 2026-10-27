import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // App mobile équipe : fichiers qui font ouvrir les liens /photographer/…
  // dans l'app (voir app/api/well-known/[fichier]/route.ts).
  async rewrites() {
    return [
      { source: "/.well-known/apple-app-site-association", destination: "/api/well-known/apple-app-site-association" },
      { source: "/.well-known/assetlinks.json", destination: "/api/well-known/assetlinks.json" },
    ];
  },
};

export default nextConfig;
