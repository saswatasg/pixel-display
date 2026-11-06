import type { MetadataRoute } from "next";
export const dynamic = "force-static";
export default function manifest(): MetadataRoute.Manifest {
  return { name: "Pixel Display", short_name: "pixel.", description: "Your nearby pixel display, made personal.", start_url: "/", display: "standalone", background_color: "#f8f8f5", theme_color: "#f8f8f5", icons: [{ src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" }] };
}
