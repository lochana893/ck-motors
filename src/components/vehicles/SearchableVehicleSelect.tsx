"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown, X } from "lucide-react";

export default function SearchableVehicleSelect({ label, value, options, required, onChange, placeholder = "Search or select..." }: { label: string; value: string; options: string[]; required?: boolean; onChange: (value: string) => void; placeholder?: string }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState(value);
  const [highlight, setHighlight] = useState(0);
  const [customValue, setCustomValue] = useState("");
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const timer = window.setTimeout(() => setQuery(value), 0);
    return () => window.clearTimeout(timer);
  }, [value]);
  useEffect(() => {
    const close = (event: MouseEvent) => { if (!ref.current?.contains(event.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", close); return () => document.removeEventListener("mousedown", close);
  }, []);
  const normalized = query.trim().toLowerCase();
  const filtered = options.filter((option) => option !== "Other" && option.toLowerCase().includes(normalized));
  function choose(option: string) { onChange(option); setQuery(option); setCustomValue(""); setOpen(false); }
  return <div ref={ref} className="relative">
    <label className="block text-xs font-bold text-gray-500">{label}{required ? " *" : ""}</label>
    <div className="relative mt-2"><input required={required} value={query} placeholder={placeholder} onFocus={() => setOpen(true)} onChange={(event) => { setQuery(event.target.value); setHighlight(0); setOpen(true); onChange(event.target.value); }} onKeyDown={(event) => { if (!open) return; if (event.key === "ArrowDown") { event.preventDefault(); setHighlight((current) => Math.min(current + 1, filtered.length - 1)); } else if (event.key === "ArrowUp") { event.preventDefault(); setHighlight((current) => Math.max(current - 1, 0)); } else if (event.key === "Enter" && filtered[highlight]) { event.preventDefault(); choose(filtered[highlight]); } else if (event.key === "Escape") setOpen(false); }} className="w-full rounded-lg border border-white/10 bg-[#080808] px-3 py-2.5 pr-16 text-sm outline-none focus:border-red-600" />
      {query && <button type="button" aria-label={`Clear ${label}`} onClick={() => { setQuery(""); onChange(""); setOpen(true); }} className="absolute right-8 top-1/2 -translate-y-1/2 text-gray-600 hover:text-white"><X size={14} /></button>}<button type="button" aria-label={`Open ${label}`} onClick={() => setOpen((current) => !current)} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500"><ChevronDown size={15} /></button>
    </div>
    {(value === "Other" || customValue.length > 0 || (Boolean(value) && !options.includes(value))) && <input required={required} value={customValue || (value !== "Other" && !options.includes(value) ? value : "")} onChange={(event) => { setCustomValue(event.target.value); onChange(event.target.value || "Other"); }} placeholder={`Custom ${label}`} className="mt-2 w-full rounded-lg border border-amber-900/40 bg-[#080808] px-3 py-2.5 text-sm outline-none focus:border-amber-500" />}
    {open && <div className="absolute z-[140] mt-1 max-h-56 w-full overflow-y-auto rounded-lg border border-white/10 bg-[#151515] p-1 shadow-2xl">{filtered.map((option, index) => <button type="button" key={option} onMouseDown={(event) => event.preventDefault()} onClick={() => choose(option)} className={`block w-full rounded px-3 py-2 text-left text-xs ${index === highlight ? "bg-red-950/50 text-red-300" : "text-gray-300 hover:bg-white/5"}`}>{option}</button>)}<button type="button" onClick={() => choose("Other")} className="block w-full rounded border-t border-white/10 px-3 py-2 text-left text-xs font-bold text-amber-400">{filtered.length ? "Other" : `No matching ${label.toLowerCase()} found. Use Other`}</button></div>}
  </div>;
}
