import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { ENGINE_CAPACITIES, FUEL_TYPES, TRANSMISSIONS, VEHICLE_BRANDS, VEHICLE_MODELS, VEHICLE_TYPES } from "@/lib/vehicle-options";

export type VehicleMasterData = {
  brands: string[];
  models: Array<{ name: string; brand: string }>;
  vehicleTypes: string[];
  fuelTypes: string[];
  transmissions: string[];
  engineCapacities: string[];
  loading: boolean;
};

export function useVehicleMasterData(): VehicleMasterData {
  const [data, setData] = useState<VehicleMasterData>({
    brands: VEHICLE_BRANDS, models: VEHICLE_MODELS, vehicleTypes: VEHICLE_TYPES, fuelTypes: FUEL_TYPES, transmissions: TRANSMISSIONS, engineCapacities: ENGINE_CAPACITIES, loading: true,
  });
  const load = useCallback(async () => {
    const supabase = createClient();
    const [brands, models, types, fuels, transmissions, capacities] = await Promise.all([
      supabase.from("vehicle_brands").select("id, name").eq("is_active", true).order("name"),
      supabase.from("vehicle_models").select("name, brand:vehicle_brands(name)").eq("is_active", true).order("name"),
      supabase.from("vehicle_types").select("name").eq("is_active", true).order("name"),
      supabase.from("fuel_types").select("name").eq("is_active", true).order("name"),
      supabase.from("transmission_types").select("name").eq("is_active", true).order("name"),
      supabase.from("engine_capacity_options").select("name").eq("is_active", true).order("name"),
    ]);
    const results = [
      ["vehicle_brands", brands],
      ["vehicle_models", models],
      ["vehicle_types", types],
      ["fuel_types", fuels],
      ["transmission_types", transmissions],
      ["engine_capacity_options", capacities],
    ] as const;
    results.forEach(([table, result]) => {
      if (result.error) {
        const details = {
          table,
          message: result.error.message,
          code: result.error.code,
          details: result.error.details,
          hint: result.error.hint,
        };
        console.warn("Vehicle master-data query failed; using fallback options.", details);
      }
    });
    const databaseModels = (models.data || []).map((item) => {
      const brand = item.brand as unknown as { name: string } | { name: string }[] | null;
      return { name: item.name, brand: Array.isArray(brand) ? brand[0]?.name || "" : brand?.name || "" };
    }).filter((item) => item.brand && item.name);
    setData({
      brands: Array.from(new Set([...VEHICLE_BRANDS, ...(brands.data || []).map((item) => item.name)])),
      models: Array.from(new Map([...VEHICLE_MODELS, ...databaseModels].map((item) => [`${item.brand}:${item.name}`, item])).values()),
      vehicleTypes: Array.from(new Set([...VEHICLE_TYPES, ...(types.data || []).map((item) => item.name)])),
      fuelTypes: Array.from(new Set([...FUEL_TYPES, ...(fuels.data || []).map((item) => item.name)])),
      transmissions: Array.from(new Set([...TRANSMISSIONS, ...(transmissions.data || []).map((item) => item.name)])),
      engineCapacities: Array.from(new Set([...ENGINE_CAPACITIES, ...(capacities.data || []).map((item) => item.name)])),
      loading: false,
    });
  }, []);
  useEffect(() => { const timer = window.setTimeout(() => { void load(); }, 0); return () => window.clearTimeout(timer); }, [load]);
  return data;
}
