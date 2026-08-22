import { createFileRoute } from "@tanstack/react-router";
import { riskStatus } from "@/lib/floodguard-store";

export const Route = createFileRoute("/api/public/risk-status")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const lat = Number(url.searchParams.get("lat"));
        const lng = Number(url.searchParams.get("lng"));
        if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
          return Response.json({ error: "lat e lng são obrigatórios" }, { status: 400 });
        }
        return Response.json(riskStatus(lat, lng), {
          headers: { "cache-control": "no-store" },
        });
      },
    },
  },
});
