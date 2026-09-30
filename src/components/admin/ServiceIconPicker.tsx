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
      <div className="service-icon-preview flex flex-col gap-3 rounded-xl border p-4 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
        <div className="flex min-w-0 items-center gap-3">
          <span className="service-icon-preview-box flex h-11 w-11 shrink-0 items-center justify-center rounded-xl" aria-label={`Selected icon: ${iconName || "Wrench"}`}>
            {createElement(selectedIcon, { size: 22, className: "service-icon-preview-glyph", "aria-hidden": true })}
          </span>
          <span className="min-w-0">
            <span className="service-icon-preview-name block truncate text-sm font-semibold">{iconName || "Wrench"}</span>
            <span className="service-icon-preview-caption block text-xs">Selected service icon</span>
          </span>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          <button type="button" onClick={() => setOpen(true)} className="service-icon-choose-button rounded-lg border px-4 py-2.5 text-xs font-semibold transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#63b4ff]">
            Choose Icon
          </button>
          {iconName && <button type="button" onClick={() => onChange(null)} className="service-icon-clear-button rounded-lg border px-4 py-2.5 text-xs font-medium transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#63b4ff]">Clear Icon</button>}
        </div>
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
          <section role="dialog" aria-modal="true" aria-labelledby="service-icon-picker-title" className="service-icon-picker max-h-[90dvh] w-full max-w-3xl overflow-y-auto rounded-2xl border border-slate-700 bg-[#0c111a] text-white shadow-2xl">
            <header className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-700 bg-[#0c111a] px-4 py-4 sm:px-6">
              <div><h3 id="service-icon-picker-title" className="service-icon-picker-title text-lg font-black text-white">Choose Service Icon</h3><p className="service-icon-picker-subtitle mt-1 text-xs text-slate-400">{serviceIconOptions.length} automotive and workshop icons</p></div>
              <button type="button" aria-label="Close icon picker" onClick={closePicker} className="rounded-lg border border-white/15 p-2 text-gray-300 transition hover:border-[#1688ff] hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#63b4ff]"><X size={18} /></button>
            </header>
            <div className="service-icon-picker-content space-y-4 p-4 sm:p-6">
              <label className="relative block">
                <span className="sr-only">Search icons</span>
                <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
                <input autoFocus type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search icons..." className="service-icon-search w-full rounded-lg border border-slate-300 bg-white py-3 pl-10 pr-4 text-sm text-slate-900 outline-none placeholder:text-slate-500 focus:border-[#1688ff] focus-visible:ring-2 focus-visible:ring-[#1688ff]/50" />
              </label>
              <div role="group" aria-label="Icon categories" className="flex flex-wrap gap-2 pb-1">
                {serviceIconCategories.map((item) => <button key={item} type="button" aria-pressed={category === item} onClick={() => setCategory(item as "All" | ServiceIconCategory)} className={`service-icon-category shrink-0 rounded-full border px-3 py-2 text-[11px] font-bold transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#63b4ff] ${category === item ? "is-active border-blue-400 bg-blue-600 text-white" : "border-slate-500 bg-transparent text-slate-300 hover:border-blue-400 hover:text-white"}`}>{item}</button>)}
              </div>
              {filteredIcons.length ? (
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
                  {filteredIcons.map(({ name, category: iconCategory, Icon }) => {
                    const selected = iconName === name;
                    return <button key={name} type="button" aria-pressed={selected} onClick={() => { onChange(name); closePicker(); }} className={`service-icon-card relative flex min-h-20 min-w-0 items-center gap-2 rounded-xl border p-3 text-left transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#63b4ff] ${selected ? "is-selected border-blue-500 bg-[#102741]" : "border-slate-600 bg-[#111827] hover:border-blue-400 hover:bg-[#13233A]"}`}>
                      {selected && <Check size={13} className="absolute right-2 top-2 text-[#63b4ff]" />}
                      {createElement(Icon, { size: 19, className: "service-icon-card-icon shrink-0 text-sky-400", "aria-hidden": true })}
                      <span className="min-w-0"><span className="service-icon-name block truncate text-[11px] font-medium text-slate-100">{name}</span><span className="service-icon-caption block truncate text-[9px] text-slate-400">{iconCategory}</span></span>
                    </button>;
                  })}
                </div>
              ) : <p className="rounded-xl border border-dashed border-slate-600 p-8 text-center text-sm text-slate-400">No icons match your search.</p>}
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
