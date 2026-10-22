import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "خاندان نجف — شجره‌نامه",
    short_name: "نجف",
    description: "سامانه شجره‌نامه هوشمند خاندان نجف",
    start_url: "/",
    display: "standalone",
    background_color: "#E0E5EC",
    theme_color: "#0F766E",
    orientation: "any",
    lang: "fa",
    dir: "rtl",
    icons: [
      {
        src: "/icon.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "maskable",
      },
    ],
  };
}
