"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Bell, CalendarDays, CheckCheck } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

type AdminNotification = {
  id: string;
  type: string;
  title: string;
  message: string;
  booking_id: string | null;
  is_read: boolean;
  created_at: string;
};

export default function AdminNotificationBell() {
  const supabase = useMemo(() => createClient(), []);
  const router = useRouter();
  const [items, setItems] = useState<AdminNotification[]>([]);
  const [open, setOpen] = useState(false);
  const [toast, setToast] = useState("");
  const panelRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      const { data } = await supabase
        .from("admin_notifications")
        .select("id,type,title,message,booking_id,is_read,created_at")
        .order("created_at", { ascending: false })
        .limit(30);
      if (!cancelled) setItems((data || []) as AdminNotification[]);
    }
    void load();

    // Unique per-effect-run channel topic, created inside the effect so it
    // is never touched during render. Multiple AdminNotificationBell
    // instances can be mounted simultaneously (mobile header + desktop top
    // bar), and React Strict Mode / Fast Refresh can remount this component
    // during development — reusing a static topic name in any of those
    // cases causes "cannot add postgres_changes callbacks after subscribe()"
    // because two channel objects end up sharing the same realtime topic.
    const channelName = `admin-booking-notifications-${crypto.randomUUID()}`;

    const channel = supabase
      .channel(channelName)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "admin_notifications" },
        (payload) => {
          if (cancelled) return;
          const notification = payload.new as AdminNotification;
          setItems((current) => {
            const exists = current.some((item) => item.id === notification.id);
            if (exists) return current;
            return [notification, ...current].slice(0, 30);
          });
          setToast(`${notification.title}: ${notification.message}`);
          window.setTimeout(() => setToast(""), 6000);
        }
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "admin_notifications" },
        (payload) => {
          if (cancelled) return;
          const updated = payload.new as AdminNotification;
          setItems((current) => current.map((item) => (item.id === updated.id ? updated : item)));
        }
      )
      .subscribe((status, error) => {
        if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
          if (process.env.NODE_ENV !== "production") {
            console.warn("Admin notification realtime unavailable:", error);
          }
        }
      });

    return () => {
      cancelled = true;
      void supabase.removeChannel(channel);
    };
  }, [supabase]);

  useEffect(() => {
    if (!open) return;
    function handleClickOutside(event: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [open]);

  const unread = items.filter((item) => !item.is_read).length;

  async function markRead(item: AdminNotification) {
    setOpen(false);
    if (!item.is_read) {
      await supabase.from("admin_notifications").update({ is_read: true }).eq("id", item.id);
      setItems((current) => current.map((entry) => (entry.id === item.id ? { ...entry, is_read: true } : entry)));
    }
    if (item.booking_id) router.push(`/admin?section=bookings&bookingId=${encodeURIComponent(item.booking_id)}`);
  }

  async function markAllRead() {
    await supabase.from("admin_notifications").update({ is_read: true }).eq("is_read", false);
    setItems((current) => current.map((item) => ({ ...item, is_read: true })));
  }

  return (
    <div ref={panelRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-label="Admin notifications"
        aria-haspopup="true"
        aria-expanded={open}
        className="relative flex h-10 w-10 cursor-pointer items-center justify-center rounded-lg border border-white/10 bg-[#111] pointer-events-auto"
      >
        <Bell size={18} />
        {unread > 0 && (
          <span className="absolute -right-1 -top-1 min-w-5 rounded-full bg-red-600 px-1 text-[10px] font-bold leading-5 text-white">
            {unread > 99 ? "99+" : unread}
          </span>
        )}
      </button>
      {toast && (
        <div role="status" className="fixed right-4 top-16 z-[80] max-w-sm rounded-xl border border-blue-400/30 bg-[#111] p-4 text-xs text-white shadow-2xl">
          <p className="font-bold text-blue-400">New Booking Received</p>
          <p className="mt-1 text-gray-300">{toast}</p>
        </div>
      )}
      {open && (
        <div className="absolute right-0 top-12 z-[70] w-[min(92vw,380px)] overflow-hidden rounded-2xl border border-white/10 bg-[#111] shadow-2xl">
          <div className="flex items-center justify-between border-b border-white/10 p-4">
            <p className="font-bold">Notifications</p>
            <button type="button" onClick={() => void markAllRead()} className="flex cursor-pointer items-center gap-1 text-[10px] font-bold text-gray-400 hover:text-white">
              <CheckCheck size={14} /> Mark all read
            </button>
          </div>
          <div className="max-h-[min(70vh,480px)] overflow-y-auto">
            {items.length === 0 ? (
              <p className="p-6 text-xs text-gray-500">No notifications yet.</p>
            ) : (
              items.map((item) => (
                <button
                  type="button"
                  key={item.id}
                  onClick={() => void markRead(item)}
                  className={`block w-full cursor-pointer border-b border-white/5 p-4 text-left transition hover:bg-white/[0.04] ${item.is_read ? "opacity-60" : ""}`}
                >
                  <div className="flex gap-3">
                    <span className="mt-0.5 text-red-400">
                      {item.type === "new_booking" ? <CalendarDays size={16} /> : <Bell size={16} />}
                    </span>
                    <span className="min-w-0">
                      <span className="flex items-center gap-2 text-xs font-bold">
                        {item.title}
                        {!item.is_read && <i className="h-1.5 w-1.5 rounded-full bg-red-500" />}
                      </span>
                      <span className="mt-1 block text-xs leading-5 text-gray-400">{item.message}</span>
                      <span className="mt-2 block text-[10px] text-gray-600">{new Date(item.created_at).toLocaleString()}</span>
                    </span>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
