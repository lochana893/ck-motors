"use client";

import { createElement, useEffect, useMemo, useState } from "react";
import { Check, Search, X } from "lucide-react";
import {
  resolveServiceIcon,
  serviceIconCategories,
  serviceIconOptions,
  suggestServiceIcon,
  type ServiceIconCategory,
} from "@/lib/service-icons";

type ServiceIconPickerProps = {
  iconName: string | null;
  serviceName: string;
  onChange: (iconName: string | null) => void;
};

export default function ServiceIconPicker({ iconName, serviceName, onChange }: ServiceIconPickerProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<(typeof serviceIconCategories)[number]>("All");
  const selectedIcon = resolveServiceIcon(iconName);
  const suggestion = suggestServiceIcon(serviceName);

  const filteredIcons = useMemo(() => {
    const query = search.trim().toLowerCase();
    return serviceIconOptions.filter((option) =>
      (category === "All" || option.category === category)
      && (!query || option.name.toLowerCase().includes(query) || option.category.toLowerCase().includes(query)),
    );
  }, [category, search]);

  useEffect(() => {
    if (!open) return;
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [open]);

  function closePicker() {
    setOpen(false);
    setSearch("");
    setCategory("All");
  }

  return (
    <div className="min-w-0">
      <label className="mb-2 block text-xs font-semibold text-gray-400">Service Icon</label>
      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-white/10 bg-black/20 p-3">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-red-950/40 text-red-400" aria-label={`Selected icon: ${iconName || "Wrench"}`}>
          {createElement(selectedIcon, { size: 22, "aria-hidden": true })}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-xs font-bold text-white">{iconName || "Wrench"}</span>
          <span className="block text-[10px] text-gray-500">Selected service icon</span>
        </span>
        <button type="button" onClick={() => setOpen(true)} className="rounded-lg border border-[#1688ff]/50 px-3 py-2.5 text-xs font-bold text-[#9bceff] transition hover:bg-[#1688ff]/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#63b4ff]">
          Choose Icon
        </button>
        {iconName && <button type="button" onClick={() => onChange(null)} className="rounded-lg border border-white/10 px-3 py-2.5 text-xs font-semibold text-gray-400 transition hover:border-red-500/50 hover:text-red-300 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#63b4ff]">Clear Icon</button>}
      </div>

      {suggestion && suggestion !== iconName && (
        <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
          <span className="text-gray-500">Suggested Icon:</span>
          <span className="inline-flex items-center gap-1.5 text-gray-300">{createElement(resolveServiceIcon(suggestion), { size: 15 })}{suggestion}</span>
          <button type="button" onClick={() => onChange(suggestion)} className="rounded-md border border-[#1688ff]/30 px-2 py-1 font-semibold text-[#9bceff] transition hover:bg-[#1688ff]/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#63b4ff]">Use suggestion</button>
        </div>
      )}

      {open && (
        <div className="fixed inset-0 z-[130] flex items-center justify-center bg-black/75 p-3 backdrop-blur-sm sm:p-5" onClick={(event) => { if (event.target === event.currentTarget) closePicker(); }}>
          <section role="dialog" aria-modal="true" aria-labelledby="service-icon-picker-title" className="flex max-h-[90dvh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-white/10 bg-[#0c111a] text-white shadow-2xl">
            <header className="flex items-center justify-between border-b border-white/10 px-4 py-4 sm:px-6">
              <div><h3 id="service-icon-picker-title" className="text-lg font-black">Choose Service Icon</h3><p className="mt-1 text-xs text-gray-400">{serviceIconOptions.length} automotive and workshop icons</p></div>
              <button type="button" aria-label="Close icon picker" onClick={closePicker} className="rounded-lg border border-white/15 p-2 text-gray-300 transition hover:border-[#1688ff] hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#63b4ff]"><X size={18} /></button>
            </header>
            <div className="space-y-4 overflow-y-auto p-4 sm:p-6">
              <label className="relative block">
                <span className="sr-only">Search icons</span>
                <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
                <input autoFocus type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search icons..." className="w-full rounded-lg border border-white/10 bg-[#080b10] py-3 pl-10 pr-4 text-sm text-white outline-none placeholder:text-gray-500 focus:border-[#1688ff] focus-visible:ring-2 focus-visible:ring-[#1688ff]/50" />
              </label>
              <div role="group" aria-label="Icon categories" className="flex gap-2 overflow-x-auto pb-1">
                {serviceIconCategories.map((item) => <button key={item} type="button" aria-pressed={category === item} onClick={() => setCategory(item as "All" | ServiceIconCategory)} className={`shrink-0 rounded-full border px-3 py-2 text-[11px] font-bold transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#63b4ff] ${category === item ? "border-[#1688ff] bg-[#102741] text-[#b9ddff]" : "border-white/10 text-gray-400 hover:border-white/25 hover:text-white"}`}>{item}</button>)}
              </div>
              {filteredIcons.length ? (
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
                  {filteredIcons.map(({ name, category: iconCategory, Icon }) => {
                    const selected = iconName === name;
                    return <button key={name} type="button" aria-pressed={selected} onClick={() => { onChange(name); closePicker(); }} className={`relative flex min-h-20 min-w-0 items-center gap-2 rounded-xl border p-3 text-left transition hover:border-[#1688ff]/70 hover:bg-[#102741]/60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#63b4ff] ${selected ? "border-[#1688ff] bg-[#102741]" : "border-white/10 bg-white/[0.02]"}`}>
                      {selected && <Check size={13} className="absolute right-2 top-2 text-[#63b4ff]" />}
                      {createElement(Icon, { size: 19, className: "shrink-0 text-[#8bc9ff]", "aria-hidden": true })}
                      <span className="min-w-0"><span className="block truncate text-[11px] font-bold text-white">{name}</span><span className="block truncate text-[9px] text-gray-500">{iconCategory}</span></span>
                    </button>;
                  })}
                </div>
              ) : <p className="rounded-xl border border-dashed border-white/10 p-8 text-center text-sm text-gray-500">No icons match your search.</p>}
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
