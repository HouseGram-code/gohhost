import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Goh Hosting — хостинг Telegram-ботов",
    short_name: "Goh Hosting",
    description: "Хостинг Telegram-ботов с работой 24/7",
    start_url: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#0b1120",
    theme_color: "#0b1120",
    icons: [
      { src: "/icon", sizes: "512x512", type: "image/png", purpose: "any" },
    ],
  };
}
