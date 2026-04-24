import type { MetadataRoute } from "next"

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Yeshiva Toras Chaim Alumni",
    short_name: "YTC Alumni",
    description: "Yeshiva Toras Chaim Alumni Network - Access shiurim, events, and stay connected",
    start_url: "/",
    display: "standalone",
    background_color: "#0C1A35",
    theme_color: "#0C1A35",
    icons: [
      {
        src: "/favicon-192x192.png",
        sizes: "192x192",
        type: "image/png",
      },
      {
        src: "/yeshiva-logo.png",
        sizes: "512x512",
        type: "image/png",
      },
    ],
  }
}
