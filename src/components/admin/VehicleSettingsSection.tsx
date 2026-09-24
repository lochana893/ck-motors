"use client";

import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { useVehicleMasterData } from "@/lib/vehicle-master-data";

export default function VehicleSettingsSection() {
  const data = useVehicleMasterData();
  const [tab, setTab] = useState("brands");
  const [query, setQuery] = useState("");
  const [brand, setBrand] = useState("");
  const items = useMemo(() => {
    const text = query.toLowerCase();
    if (tab === "models") return data.models.filter((item) => (!brand || item.brand === brand) && `${item.brand} ${item.name}`.toLowerCase().includes(text)).map((item) => `${item.brand} — ${item.name}`);
    const values = tab === "brands" ? data.brands : tab === "types" ? data.vehicleTypes : tab === "fuel" ? data.fuelTypes : tab === "transmissions" ? data.transmissions : data.engineCapacities;
    return values.filter((item) => item.toLowerCase().includes(text));
  }, [brand, data, query, tab]);
  const tabs = [["brands", "Brands"], ["models", "Models"], ["types", "Vehicle Types"], ["fuel", "Fuel Types"], ["transmissions", "Transmissions"], ["capacities", "Engine Capacities"]];
  return <section className="rounded-2xl border border-white/10 bg-[#111] p-5"><h2 className="text-lg font-black">Vehicle Settings</h2><p className="mt-1 text-xs text-gray-500">Search active master-data options used by every vehicle form.</p><div className="mt-5 flex flex-wrap gap-2">{tabs.map(([value, label]) => <button type="button" key={value} onClick={() => { setTab(value); setQuery(""); }} className={`rounded-lg px-3 py-2 text-xs font-bold ${tab === value ? "bg-red-600 text-white" : "border border-white/10 text-gray-400"}`}>{label}</button>)}</div><div className="mt-4 flex flex-wrap gap-3"><label className="flex flex-1 items-center gap-2 rounded-lg border border-white/10 bg-[#080808] px-3"><Search size={15} className="text-gray-600" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={`Search ${tabs.find(([value]) => value === tab)?.[1].toLowerCase()}...`} className="w-full bg-transparent py-3 text-sm outline-none" /></label>{tab === "models" && <select value={brand} onChange={(event) => setBrand(event.target.value)} className="rounded-lg border border-white/10 bg-[#080808] px-3 py-3 text-xs outline-none"><option value="">All Brands</option>{data.brands.map((item) => <option key={item} value={item}>{item}</option>)}</select>}</div><div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">{items.map((item) => <div key={item} className="rounded-lg border border-white/10 bg-black/20 px-4 py-3 text-sm text-gray-300">{item}</div>)}{!items.length && <p className="col-span-full py-8 text-center text-xs text-gray-500">No matching option found.</p>}</div></section>;
}
