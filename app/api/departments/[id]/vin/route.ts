import { getChatGPTUser } from "@/app/chatgpt-auth";
import { canAccessDepartment } from "@/db/access";

type VpicResult = Record<string, string | null>;

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getChatGPTUser();
  if (!user) return new Response("Sign in required", { status: 401 });
  if (!(await canAccessDepartment(user.userId, id))) return new Response("Department access required", { status: 403 });
  const vin = new URL(request.url).searchParams.get("vin")?.toUpperCase().replace(/[^A-Z0-9*]/g, "") || "";
  if (!/^[A-HJ-NPR-Z0-9*]{11,17}$/.test(vin)) return Response.json({ error: "Enter a valid 11–17 character VIN without I, O, or Q." }, { status: 400 });

  const sourceUrl = `https://vpic.nhtsa.dot.gov/api/vehicles/DecodeVinValuesExtended/${encodeURIComponent(vin)}?format=json`;
  try {
    const response = await fetch(sourceUrl, { headers: { accept: "application/json" }, signal: AbortSignal.timeout(10000) });
    if (!response.ok) throw new Error(`vPIC returned ${response.status}`);
    const payload = await response.json() as { Results?: VpicResult[] };
    const result = payload.Results?.[0];
    if (!result) throw new Error("No VIN result returned");
    return Response.json({
      vin,
      make: result.Make || "",
      manufacturer: result.Manufacturer || result.ManufacturerName || result.Make || "",
      model: result.Model || "",
      modelYear: result.ModelYear || "",
      vehicleType: result.VehicleType || "",
      bodyClass: result.BodyClass || "",
      fuelType: result.FuelTypePrimary || "",
      engineModel: result.EngineModel || "",
      gvwr: result.GVWR || "",
      plant: [result.PlantCity, result.PlantState, result.PlantCountry].filter(Boolean).join(", "),
      errorCode: result.ErrorCode || "",
      errorText: result.ErrorText || "",
      source: "NHTSA vPIC",
      sourceUrl,
    }, { headers: { "cache-control": "private, max-age=300" } });
  } catch {
    return Response.json({ error: "The NHTSA VIN service is unavailable right now. You can still enter the vehicle manually." }, { status: 502 });
  }
}
