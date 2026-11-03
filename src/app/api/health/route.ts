import { connection } from "next/server";

// Railway's health check. connection() keeps this from being prerendered at build time.
export async function GET() {
  await connection();
  return Response.json({ status: "ok" });
}
