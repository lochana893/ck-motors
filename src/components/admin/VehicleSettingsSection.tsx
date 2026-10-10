"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Search } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useVehicleMasterData } from "@/lib/vehicle-master-data";

type RegisteredVehicle = {
  id: string;
  registration_number: string | null;
  brand: string | null;
  model: string | null;
  manufacture_year: number | null;
  vehicle_type: string | null;
  fuel_type: string | null;
};

function sameName(first: string | null | undefined, second: string) {
  return (first || "").trim().toLocaleLowerCase() === second.trim().toLocaleLowerCase();
}

function vehicleMatchesSearch(vehicle: RegisteredVehicle, query: string) {
  if (!query) return true;
  return [
    vehicle.registration_number,
    vehicle.brand,
    vehicle.model,
    vehicle.vehicle_type,
    vehicle.fuel_type,
    vehicle.manufacture_year?.toString(),
  ]
    .filter(Boolean)
    .join(" ")
    .toLocaleLowerCase()
    .includes(query);
}

export default function VehicleSettingsSection() {
  const data = useVehicleMasterData();
  const supabase = useMemo(() => createClient(), []);
  const [tab, setTab] = useState("brands");
  const [query, setQuery] = useState("");
  const [selectedBrand, setSelectedBrand] = useState("");
  const [selectedModel, setSelectedModel] = useState("");
  const [registeredVehicles, setRegisteredVehicles] = useState<RegisteredVehicle[]>([]);
  const [vehiclesLoading, setVehiclesLoading] = useState(true);
  const [vehiclesError, setVehiclesError] = useState("");
  const [reloadKey, setReloadKey] = useState(0);
  const normalizedQuery = query.trim().toLocaleLowerCase();

  useEffect(() => {
    let active = true;

    async function loadRegisteredVehicles() {
      setVehiclesLoading(true);
      setVehiclesError("");
      const rows: RegisteredVehicle[] = [];
      const pageSize = 500;

      try {
        for (let offset = 0; ; offset += pageSize) {
          const { data: page, error } = await supabase
            .from("vehicles")
            .select("id,registration_number,brand,model,manufacture_year,vehicle_type,fuel_type")
            .order("registration_number", { ascending: true })
            .order("id", { ascending: true })
            .range(offset, offset + pageSize - 1);

          if (error) throw error;

          const vehicles = (page || []) as RegisteredVehicle[];
          rows.push(...vehicles);
          if (vehicles.length < pageSize) break;
        }

        if (active) setRegisteredVehicles(rows);
      } catch (error) {
        console.warn("Registered vehicles could not be loaded for Vehicle Settings.", error);
        if (active) {
          setRegisteredVehicles([]);
          setVehiclesError("Registered vehicles could not be loaded. Check your admin access and try again.");
        }
      } finally {
        if (active) setVehiclesLoading(false);
      }
    }

    void loadRegisteredVehicles();
    return () => {
      active = false;
    };
  }, [reloadKey, supabase]);

  const brandCounts = useMemo(() => {
    const counts = new Map<string, { models: number; vehicles: number }>();
    for (const brand of data.brands) {
      counts.set(brand, {
        models: data.models.filter((model) => sameName(model.brand, brand)).length,
        vehicles: registeredVehicles.filter((vehicle) => sameName(vehicle.brand, brand)).length,
      });
    }
    return counts;
  }, [data.brands, data.models, registeredVehicles]);

  const searchedBrands = useMemo(
    () => data.brands.filter((brand) =>
      !normalizedQuery ||
      brand.toLocaleLowerCase().includes(normalizedQuery) ||
      (selectedBrand && sameName(brand, selectedBrand)),
    ),
    [data.brands, normalizedQuery, selectedBrand],
  );

  const selectedBrandModels = useMemo(
    () => data.models
      .filter((model) => sameName(model.brand, selectedBrand))
      .filter((model) => !normalizedQuery || model.name.toLocaleLowerCase().includes(normalizedQuery)),
    [data.models, normalizedQuery, selectedBrand],
  );

  const selectedBrandVehicles = useMemo(
    () => registeredVehicles
      .filter((vehicle) => sameName(vehicle.brand, selectedBrand))
      .filter((vehicle) => !selectedModel || sameName(vehicle.model, selectedModel))
      .filter((vehicle) => vehicleMatchesSearch(vehicle, normalizedQuery)),
    [normalizedQuery, registeredVehicles, selectedBrand, selectedModel],
  );

  const brandSelectOptions = useMemo(
    () => [...new Set([...data.brands, ...data.models.map((model) => model.brand)])].filter(Boolean),
    [data.brands, data.models],
  );

  const modelsTabItems = useMemo(
    () => data.models
      .filter((item) => (!selectedBrand || sameName(item.brand, selectedBrand)))
      .filter((item) => !normalizedQuery || `${item.brand} ${item.name}`.toLocaleLowerCase().includes(normalizedQuery)),
    [data.models, normalizedQuery, selectedBrand],
  );

  const items = useMemo(() => {
    if (tab === "brands" || tab === "models") return [];
    const values = tab === "types" ? data.vehicleTypes : tab === "fuel" ? data.fuelTypes : tab === "transmissions" ? data.transmissions : data.engineCapacities;
    return values.filter((item) => item.toLocaleLowerCase().includes(normalizedQuery));
  }, [data, normalizedQuery, tab]);

  const tabs = [
    ["brands", "Brands"],
    ["models", "Models"],
    ["types", "Vehicle Types"],
    ["fuel", "Fuel Types"],
    ["transmissions", "Transmissions"],
    ["capacities", "Engine Capacities"],
  ];

  const selectedBrandVehicleCount = registeredVehicles.filter(
    (vehicle) => sameName(vehicle.brand, selectedBrand),
  ).length;

  const setActiveTab = useCallback((value: string) => {
    setTab(value);
    setQuery("");
    setSelectedBrand("");
    setSelectedModel("");
  }, []);

  const openBrand = useCallback((value: string) => {
    setSelectedBrand(value);
    setSelectedModel("");
    setQuery("");
  }, []);

  const vehicleHeading = selectedModel
    ? `${selectedBrand} ${selectedModel}`
    : `Registered ${selectedBrand} Vehicles`;

  return (
    <section className="rounded-2xl border border-[#CBD5E1] bg-white p-5 text-[#0F172A]">
      <h2 className="text-lg font-black">Vehicle Settings</h2>
      <p className="mt-1 text-xs text-slate-600">Search active master-data options used by every vehicle form.</p>

      <div className="mt-5 flex flex-wrap gap-2">
        {tabs.map(([value, label]) => (
          <button
            type="button"
            key={value}
            onClick={() => setActiveTab(value)}
            aria-pressed={tab === value}
            className={`rounded-lg border px-3 py-2 text-xs font-bold transition-colors ${
              tab === value
                ? "border-[#CBD5E1] bg-[#DBEAFE] text-[#1D4ED8]"
                : "border-[#CBD5E1] bg-[#FFFFFF] text-[#0F172A] hover:bg-[#EFF6FF]"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="mt-4 flex flex-wrap gap-3">
        <label className="flex min-w-[220px] flex-1 items-center gap-2 rounded-lg border border-[#CBD5E1] bg-white px-3 focus-within:border-[#1D4ED8]">
          <Search size={15} className="shrink-0 text-slate-500" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={
              tab === "brands" && selectedBrand
                ? `Search ${selectedBrand} models or vehicles...`
                : tab === "models" && selectedBrand && selectedModel
                  ? `Search ${selectedBrand} ${selectedModel} registrations...`
                  : tab === "models" && selectedBrand
                    ? `Search ${selectedBrand} models or vehicles...`
                : `Search ${tabs.find(([value]) => value === tab)?.[1].toLowerCase()}...`
            }
            className="w-full min-w-0 bg-transparent py-3 text-sm text-[#0F172A] outline-none placeholder:text-slate-500"
          />
        </label>

        {tab === "models" && (
          <select
            value={selectedBrand}
            onChange={(event) => {
              setSelectedBrand(event.target.value);
              setSelectedModel("");
            }}
            aria-label="Filter models by brand"
            className="rounded-lg border border-[#CBD5E1] bg-white px-3 py-3 text-xs text-[#0F172A] outline-none focus:border-[#1D4ED8]"
          >
            <option value="">All Brands</option>
            {brandSelectOptions.map((item) => <option key={item} value={item}>{item}</option>)}
          </select>
        )}
      </div>

      {vehiclesError && (
        <div role="alert" className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-800">
          <span>{vehiclesError}</span>
          <button
            type="button"
            onClick={() => setReloadKey((key) => key + 1)}
            disabled={vehiclesLoading}
            className="rounded-md border border-red-300 px-3 py-1.5 font-bold hover:bg-red-100 disabled:opacity-50"
          >
            {vehiclesLoading ? "Loading..." : "Retry"}
          </button>
        </div>
      )}

      {tab === "brands" ? (
        <>
          <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
            {searchedBrands.map((brand) => {
              const counts = brandCounts.get(brand) || { models: 0, vehicles: 0 };
              const selected = sameName(selectedBrand, brand);
              return (
                <button
                  key={brand}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => openBrand(brand)}
                  className={`min-h-20 min-w-0 rounded-xl border px-4 py-4 text-left transition-colors ${
                    selected
                      ? "border-[#3B82F6] bg-[#DBEAFE] text-[#1D4ED8]"
                      : "border-[#CBD5E1] bg-[#FFFFFF] text-[#0F172A] hover:border-[#93C5FD] hover:bg-[#EFF6FF]"
                  }`}
                >
                  <span className="block truncate text-base font-extrabold">{brand}</span>
                  <span className={`mt-1 block text-xs ${selected ? "text-[#1D4ED8]" : "text-[#64748B]"}`}>
                    {counts.models} {counts.models === 1 ? "model" : "models"} · {vehiclesLoading ? "…" : counts.vehicles} {counts.vehicles === 1 ? "vehicle" : "vehicles"}
                  </span>
                </button>
              );
            })}
            {!searchedBrands.length && !selectedBrand && <p className="col-span-full py-8 text-center text-xs text-slate-600">No matching brand found.</p>}
          </div>

          {selectedBrand && (
            <div className="mt-7 space-y-7 border-t border-[#CBD5E1] pt-6">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  {selectedModel ? (
                    <>
                      <button
                        type="button"
                        onClick={() => setSelectedModel("")}
                        className="mb-2 min-h-10 rounded-lg px-2 text-sm font-bold text-[#1D4ED8] hover:bg-[#EFF6FF]"
                      >
                        ← Back to {selectedBrand} Models
                      </button>
                      <h3 className="text-xl font-black">{selectedBrand} {selectedModel}</h3>
                    </>
                  ) : (
                    <h3 className="text-xl font-black">{selectedBrand} Vehicles</h3>
                  )}
                  <p className="mt-1 text-sm text-[#64748B]">
                    {selectedModel
                      ? `${selectedBrand} ${selectedModel} · ${selectedBrandVehicles.length} registered ${selectedBrandVehicles.length === 1 ? "vehicle" : "vehicles"}`
                      : `${data.models.filter((model) => sameName(model.brand, selectedBrand)).length} models · ${vehiclesLoading ? "…" : selectedBrandVehicleCount} registered ${selectedBrandVehicleCount === 1 ? "vehicle" : "vehicles"}`}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => { setSelectedBrand(""); setSelectedModel(""); setQuery(""); }}
                  className="min-h-10 rounded-lg border border-[#CBD5E1] bg-white px-3 text-xs font-bold text-[#0F172A] hover:bg-[#EFF6FF]"
                >
                  ← All Brands
                </button>
              </div>

              {!selectedModel && (
                <div>
                  <h4 className="mb-3 text-sm font-extrabold">Models for {selectedBrand}</h4>
                  {selectedBrandModels.length ? (
                    <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
                      {selectedBrandModels.map((model) => {
                        const modelVehicleCount = registeredVehicles.filter(
                          (vehicle) => sameName(vehicle.brand, selectedBrand) && sameName(vehicle.model, model.name),
                        ).length;
                        return (
                          <button
                            key={`${model.brand}:${model.name}`}
                            type="button"
                            onClick={() => setSelectedModel(model.name)}
                            className={`min-h-12 min-w-0 rounded-xl border px-4 py-3 text-left text-sm font-bold transition-colors ${
                              sameName(selectedModel, model.name)
                                ? "border-[#3B82F6] bg-[#DBEAFE] text-[#1D4ED8]"
                                : "border-[#CBD5E1] bg-[#FFFFFF] text-[#0F172A] hover:border-[#93C5FD] hover:bg-[#EFF6FF]"
                            }`}
                          >
                            <span className="block truncate">{model.name}</span>
                            <span className="mt-1 block text-xs font-medium text-[#64748B]">
                              {vehiclesLoading ? "…" : `${modelVehicleCount} ${modelVehicleCount === 1 ? "vehicle" : "vehicles"}`}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="rounded-lg bg-slate-50 px-4 py-5 text-sm text-[#64748B]">
                      {normalizedQuery
                        ? `No matching models for ${selectedBrand}.`
                        : `No models found for ${selectedBrand}.`}
                    </p>
                  )}
                </div>
              )}

              <div>
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                  <h4 className="text-sm font-extrabold">{vehicleHeading}</h4>
                  {!vehiclesLoading && (
                    <span className="text-xs text-[#64748B]">
                      {selectedBrandVehicles.length} {selectedBrandVehicles.length === 1 ? "vehicle" : "vehicles"}
                    </span>
                  )}
                </div>
                {vehiclesLoading ? (
                  <p className="rounded-lg bg-slate-50 px-4 py-5 text-sm text-[#64748B]">Loading registered vehicles...</p>
                ) : selectedBrandVehicles.length ? (
                  <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
                    {selectedBrandVehicles.map((vehicle) => (
                      <article key={vehicle.id} className="min-w-0 rounded-xl border border-[#CBD5E1] bg-white p-4">
                        <p className="break-words text-base font-extrabold text-[#0F172A]">
                          {vehicle.registration_number || "Registration unavailable"}
                        </p>
                        <p className="mt-1 break-words text-sm font-semibold text-[#0F172A]">
                          {[vehicle.brand, vehicle.model].filter(Boolean).join(" ") || "Vehicle details unavailable"}
                        </p>
                        <p className="mt-2 break-words text-xs text-[#64748B]">
                          {[vehicle.vehicle_type, vehicle.fuel_type, vehicle.manufacture_year]
                            .filter((value) => value !== null && value !== undefined && value !== "")
                            .join(" · ") || "Additional vehicle details unavailable"}
                        </p>
                      </article>
                    ))}
                  </div>
                ) : (
                  <p className="rounded-lg bg-slate-50 px-4 py-5 text-sm text-[#64748B]">
                    {selectedModel
                      ? `No registered ${selectedBrand} ${selectedModel} vehicles yet.`
                      : `No registered ${selectedBrand} vehicles yet.`}
                  </p>
                )}
              </div>
            </div>
          )}
        </>
      ) : (
        <>
          <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
            {tab === "models" ? modelsTabItems.map((item) => {
              const modelVehicleCount = registeredVehicles.filter(
                (vehicle) => sameName(vehicle.brand, item.brand) && sameName(vehicle.model, item.name),
              ).length;
              const selected = sameName(selectedBrand, item.brand) && sameName(selectedModel, item.name);
              return (
                <button
                  key={`${item.brand}:${item.name}`}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => { setSelectedBrand(item.brand); setSelectedModel(item.name); }}
                  className={`min-h-16 min-w-0 rounded-xl border px-4 py-3 text-left transition-colors ${
                    selected
                      ? "border-[#3B82F6] bg-[#DBEAFE] text-[#1D4ED8]"
                      : "border-[#CBD5E1] bg-[#FFFFFF] text-[#0F172A] hover:border-[#93C5FD] hover:bg-[#EFF6FF]"
                  }`}
                >
                  <span className="block truncate text-sm font-bold">{item.brand} — {item.name}</span>
                  <span className="mt-1 block text-xs font-medium text-[#64748B]">
                    {vehiclesLoading ? "…" : `${modelVehicleCount} ${modelVehicleCount === 1 ? "vehicle" : "vehicles"}`}
                  </span>
                </button>
              );
            }) : items.map((item) => (
              <div key={item} className="min-w-0 rounded-xl border border-[#CBD5E1] bg-[#FFFFFF] px-4 py-3 text-sm text-[#0F172A]">
                {item}
              </div>
            ))}
            {tab === "models" && !modelsTabItems.length && <p className="col-span-full py-8 text-center text-xs text-slate-600">No matching model found.</p>}
            {tab !== "models" && !items.length && <p className="col-span-full py-8 text-center text-xs text-slate-600">No matching option found.</p>}
          </div>

          {tab === "models" && selectedBrand && (
            <div className="mt-7 border-t border-[#CBD5E1] pt-6">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  {selectedModel && (
                    <button
                      type="button"
                      onClick={() => setSelectedModel("")}
                      className="mb-2 min-h-10 rounded-lg px-2 text-sm font-bold text-[#1D4ED8] hover:bg-[#EFF6FF]"
                    >
                      ← Back to {selectedBrand} Models
                    </button>
                  )}
                  <h3 className="text-xl font-black">
                    {selectedModel ? `${selectedBrand} ${selectedModel}` : `${selectedBrand} Vehicles`}
                  </h3>
                </div>
                {selectedModel && !vehiclesLoading && (
                  <span className="text-xs text-[#64748B]">
                    {selectedBrandVehicles.length} registered {selectedBrandVehicles.length === 1 ? "vehicle" : "vehicles"}
                  </span>
                )}
              </div>
              {vehiclesLoading ? (
                <p className="mt-4 text-sm text-[#64748B]">Loading registered vehicles...</p>
              ) : selectedBrandVehicles.length ? (
                <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
                  {selectedBrandVehicles.map((vehicle) => (
                    <article key={vehicle.id} className="min-w-0 rounded-xl border border-[#CBD5E1] bg-white p-4">
                      <p className="break-words text-base font-extrabold text-[#0F172A]">{vehicle.registration_number || "Registration unavailable"}</p>
                      <p className="mt-1 break-words text-sm font-semibold text-[#0F172A]">{[vehicle.brand, vehicle.model].filter(Boolean).join(" ") || "Vehicle details unavailable"}</p>
                      <p className="mt-2 break-words text-xs text-[#64748B]">{[vehicle.vehicle_type, vehicle.fuel_type, vehicle.manufacture_year].filter((value) => value !== null && value !== undefined && value !== "").join(" · ") || "Additional vehicle details unavailable"}</p>
                    </article>
                  ))}
                </div>
              ) : (
                <p className="mt-4 rounded-lg bg-slate-50 px-4 py-5 text-sm text-[#64748B]">
                  {selectedModel
                    ? `No registered ${selectedBrand} ${selectedModel} vehicles yet.`
                    : `No registered ${selectedBrand} vehicles yet.`}
                </p>
              )}
            </div>
          )}
        </>
      )}
    </section>
  );
}
