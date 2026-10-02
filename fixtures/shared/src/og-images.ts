import { defineImages } from "astro-takumi-images/runtime";

import AstroCard from "./astro-card.astro";
import { ReactCard } from "./react-card.tsx";

export default defineImages(() => ({
  "astro/card": {
    component: AstroCard,
    format: "webp",
    props: { title: "Astro template" },
    quality: 90,
    size: "thumbnail",
  },
  "react/card": {
    component: ReactCard,
    props: { label: "React template", title: "Hello from Takumi" },
  },
}));
