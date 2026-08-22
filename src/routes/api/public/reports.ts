import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { addReport, listReports } from "@/lib/floodguard-store";

const schema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  trafficability: z.enum(["transitavel", "veiculos_altos", "intransitavel"]),
  waterLevel: z.enum(["canela", "joelho", "acima_capo"]),
});

export const Route = createFileRoute("/api/public/reports")({
  server: {
    handlers: {
      GET: async () => Response.json({ reports: listReports() }),
      POST: async ({ request }) => {
        const parsed = schema.safeParse(await request.json().catch(() => null));
        if (!parsed.success) {
          return Response.json({ error: "Payload inválido" }, { status: 400 });
        }
        const { report, user } = addReport(parsed.data);
        return Response.json({ report, user, pointsEarned: 10 }, { status: 201 });
      },
    },
  },
});
