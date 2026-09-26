"use client";

import { useEffect, useRef, useState } from "react";
import { Bell, CheckCheck } from "lucide-react";

export type BellNotification = {
  id: string;
  title: string;
  message: string;
  is_read: boolean;
  created_at: string;
  booking_id?: string | null;
};

export default function NotificationBell({
  notifications,
  onMarkRead,
  onMarkAllRead,
  onViewAll,
  onOpenBooking,
}: {
  notifications: BellNotification[];
  onMarkRead: (id: string) => void;
  onMarkAllRead: () => void;
  onViewAll: () => void;
  onOpenBooking: (bookingId: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const unread = notifications.filter((item) => !item.is_read).length;
  const sorted = [...notifications].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );
  const recent = sorted.slice(0, 8);

  useEffect(() => {
    if (!open) return;
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
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

  function handleItemClick(item: BellNotification) {
    if (!item.is_read) onMarkRead(item.id);
    if (item.booking_id) {
      onOpenBooking(item.booking_id);
      setOpen(false);
    }
  }

  return (
    <div ref={containerRef} className="relative pointer-events-auto">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-label="Notifications"
        aria-haspopup="true"
        aria-expanded={open}
        className="relative flex h-10 w-10 cursor-pointer items-center justify-center rounded-lg border border-white/10 bg-[#111] pointer-events-auto transition hover:border-red-700 hover:text-red-500"
      >
        <Bell size={19} />

        {unread > 0 && (
          <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-red-600 px-1 text-[9px] font-bold text-white">
            {unread > 99 ? "99+" : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-12 z-50 w-[min(92vw,380px)] max-w-[calc(100vw-2rem)] overflow-hidden rounded-2xl border border-white/10 bg-[#111] shadow-2xl">
          <div className="flex items-center justify-between border-b border-white/10 p-4">
            <p className="text-sm font-bold">Notifications</p>
            <button
              type="button"
              onClick={() => onMarkAllRead()}
              className="flex cursor-pointer items-center gap-1 text-[10px] font-bold text-gray-400 hover:text-white"
            >
              <CheckCheck size={14} /> Mark all read
            </button>
          </div>

          <div className="max-h-[min(70vh,420px)] overflow-y-auto">
            {recent.length === 0 ? (
              <p className="p-6 text-center text-xs text-gray-500">
                No notifications yet.
              </p>
            ) : (
              recent.map((item) => (
                <button
                  type="button"
                  key={item.id}
                  onClick={() => handleItemClick(item)}
                  className={`block w-full cursor-pointer border-b border-white/5 p-4 text-left transition hover:bg-white/[0.04] ${
                    item.is_read ? "opacity-60" : ""
                  }`}
                >
                  <div className="flex gap-3">
                    <Bell
                      size={16}
                      className={`mt-0.5 shrink-0 ${item.is_read ? "text-gray-600" : "text-red-500"}`}
                    />
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-2 text-xs font-bold text-white">
                        {item.title}
                        {!item.is_read && (
                          <i className="h-1.5 w-1.5 rounded-full bg-red-500" />
                        )}
                      </span>
                      <span className="mt-1 block text-xs leading-5 text-gray-400">
                        {item.message}
                      </span>
                      <span className="mt-2 block text-[10px] text-gray-600">
                        {new Date(item.created_at).toLocaleString()}
                      </span>
                    </span>
                  </div>
                </button>
              ))
            )}
          </div>

          <button
            type="button"
            onClick={() => {
              setOpen(false);
              onViewAll();
            }}
            className="block w-full cursor-pointer border-t border-white/10 p-3 text-center text-xs font-bold text-red-500 hover:bg-white/[0.04]"
          >
            View all notifications
          </button>
        </div>
      )}
    </div>
  );
}
