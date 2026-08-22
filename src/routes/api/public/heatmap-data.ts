import { createFileRoute } from "@tanstack/react-router";
import { heatmapData } from "@/lib/floodguard-store";

export const Route = createFileRoute("/api/public/heatmap-data")({
  server: {
    handlers: {
      GET: async () =>
        Response.json({ points: heatmapData() }, { headers: { "cache-control": "no-store" } }),
    },
  },
});
