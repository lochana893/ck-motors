"use client";
/* eslint-disable @next/next/no-img-element */

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Bell,
  CalendarDays,
  Car,
  ClipboardList,
  History,
  Home,
  LogOut,
  Menu,
  MessageSquare,
  Paperclip,
  User,
  Wrench,
  X,
} from "lucide-react";

import { createClient } from "@/lib/supabase/client";
import VehiclesManager from "@/components/dashboard/VehiclesManager";
import BookingManager from "@/components/dashboard/BookingManager";
import ServiceHistoryManager from "@/components/dashboard/ServiceHistoryManager";
import NotificationBell from "@/components/dashboard/NotificationBell";
import CKLogo from "@/components/CKLogo";
import ThemeToggle from "@/components/ThemeToggle";
type Profile = {
  id: string;
  full_name: string;
  email: string;
  phone: string | null;
  address: string | null;
  address_line1: string | null;
  address_line2: string | null;
  city: string | null;
  district: string | null;
  postal_code: string | null;
  role: string;
  must_change_password?: boolean;
};

type Vehicle = {
  id: string;
  registration_number: string;
  brand: string;
  model: string;
  manufacture_year: number | null;
  mileage: number | null;
  fuel_type: string | null;
};

type Booking = {
  id: string;
  booking_reference: string;
  booking_date: string;
  booking_time: string;
  status: string;
  service_name_snapshot: string | null;
};

type ServiceRecord = {
  id: string;
  service_date: string;
  services_performed: string;
  mileage: number | null;
  total_cost: number;
  next_service_date: string | null;
};

type Notification = {
  id: string;
  title: string;
  message: string;
  is_read: boolean;
  created_at: string;
  booking_id: string | null;
};

type CustomerMessage = {
  id: string;
  is_read: boolean;
  created_at: string;
  message: {
    id: string;
    title: string;
    body: string;
    created_at: string;
    message_attachments: {
      id: string;
      storage_path: string;
      file_name: string;
      mime_type: string;
    }[];
  };
};

type Section =
  | "dashboard"
  | "vehicles"
  | "bookings"
  | "history"
  | "notifications"
  | "messages"
  | "profile";

export default function DashboardPage() {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);

  const [activeSection, setActiveSection] =
    useState<Section>("dashboard");

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  const [profile, setProfile] = useState<Profile | null>(null);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [history, setHistory] = useState<ServiceRecord[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [messages, setMessages] = useState<CustomerMessage[]>([]);
  const [messageError, setMessageError] = useState("");
  const [dataError, setDataError] = useState("");
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileError, setProfileError] = useState("");
  const [highlightBookingId, setHighlightBookingId] = useState<string | null>(null);

  useEffect(() => {
    if (!profile?.id) return;
    const channel = supabase.channel(`customer-notifications-${profile.id}`).on(
      "postgres_changes",
      { event: "INSERT", schema: "public", table: "notifications", filter: `user_id=eq.${profile.id}` },
      (payload) => {
        setNotifications((current) => [payload.new as Notification, ...current]);
      },
    ).subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [profile?.id, supabase]);

  useEffect(() => {
    async function loadDashboard() {
      const requestedSection = new URLSearchParams(window.location.search).get("section");
      if (requestedSection && ["dashboard", "vehicles", "bookings", "history", "notifications", "messages", "profile"].includes(requestedSection)) {
        setActiveSection(requestedSection as Section);
      }
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.replace("/login");
        return;
      }

      const [
        profileResult,
        vehicleResult,
        bookingResult,
        historyResult,
        notificationResult,
        messageResult,
      ] = await Promise.all([
        supabase
          .from("profiles")
          .select("*")
          .eq("id", user.id)
          .maybeSingle(),

        supabase
          .from("vehicles")
          .select(
            "id, registration_number, brand, model, manufacture_year, mileage, fuel_type"
          )
          .eq("user_id", user.id)
          .order("created_at", { ascending: false }),

        supabase
          .from("bookings")
          .select(
            "id, booking_reference, booking_date, booking_time, status, service_name_snapshot"
          )
          .eq("user_id", user.id)
          .order("created_at", { ascending: false }),

        supabase
          .from("service_records")
          .select(
            "id, service_date, services_performed, mileage, total_cost, next_service_date"
          )
          .eq("user_id", user.id)
          .order("service_date", { ascending: false }),

        supabase
          .from("notifications")
          .select("id, title, message, is_read, created_at, booking_id")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false }),

        supabase
          .from("message_recipients")
          .select(
           "id, is_read, created_at, message:messages(id, title, body, created_at, message_attachments(id, storage_path, file_name, mime_type))"
          )
          .eq("user_id", user.id)
          .order("created_at", { ascending: false }),
      ]);

      if (profileResult.error) {
        console.warn("Dashboard profile query failed:", {
          authUserId: user.id,
          code: profileResult.error.code,
          message: profileResult.error.message,
        });
        setLoading(false);
        router.replace("/login");
        return;
      }

      if (!profileResult.data) {
        console.warn("Dashboard profile missing for authenticated user:", {
          authUserId: user.id,
        });
        setLoading(false);
        router.replace("/login");
        return;
      }

      if (profileResult.data) {
        setProfile(profileResult.data as Profile);
        if (
          (profileResult.data as Profile).must_change_password === true
        ) {
          router.replace("/complete-account");
          return;
        }
      }

      if (vehicleResult.data) {
        setVehicles(vehicleResult.data as Vehicle[]);
      }

      if (bookingResult.data) {
        setBookings(bookingResult.data as Booking[]);
      }

      if (historyResult.data) {
        setHistory(historyResult.data as ServiceRecord[]);
      }

      if (notificationResult.data) {
        setNotifications(
          notificationResult.data as Notification[]
        );
      }

      const failedSections = [
        vehicleResult.error && "vehicles",
        bookingResult.error && "bookings",
        historyResult.error && "service history",
        notificationResult.error && "notifications",
      ].filter(Boolean);
      setDataError(
        failedSections.length > 0
          ? `Some account data could not be loaded (${failedSections.join(", ")}). Please refresh and try again.`
          : ""
      );

      if (messageResult.error) {
        setMessageError(messageResult.error.message);
        setMessages([]);
      } else {
        setMessageError("");
        const normalizedMessages = (messageResult.data || []).flatMap((item) => {
          const message = Array.isArray(item.message)
            ? item.message[0]
            : item.message;
          return message ? [{ ...item, message }] : [];
        });
        setMessages(normalizedMessages as unknown as CustomerMessage[]);
      }

      setLoading(false);
    }

    loadDashboard();
  }, [router, supabase]);

  async function saveProfile(fields: {
    address_line1: string;
    address_line2: string;
    city: string;
    district: string;
    postal_code: string;
  }) {
    if (!profile) return;
    setSavingProfile(true);
    setProfileError("");
    const { data, error } = await supabase
      .from("profiles")
      .update(Object.fromEntries(Object.entries(fields).map(([key, value]) => [key, value.trim() || null])))
      .eq("id", profile.id)
      .select("*")
      .single();
    setSavingProfile(false);
    if (error) {
      setProfileError("Unable to update your address. Please try again.");
      console.warn("Customer profile update failed:", { userId: profile.id, code: error.code, message: error.message });
      return;
    }
    setProfile(data as Profile);
  }

  async function handleLogout() {
    await supabase.auth.signOut();
    router.replace("/login");
    router.refresh();
  }

  async function markNotificationRead(id: string) {
    await supabase
      .from("notifications")
      .update({
        is_read: true,
        read_at: new Date().toISOString(),
      })
      .eq("id", id);

    setNotifications((current) =>
      current.map((item) =>
        item.id === id
          ? { ...item, is_read: true }
          : item
      )
    );
  }

  async function markAllNotificationsRead() {
    if (!profile?.id) return;
    await supabase
      .from("notifications")
      .update({ is_read: true, read_at: new Date().toISOString() })
      .eq("user_id", profile.id)
      .eq("is_read", false);

    setNotifications((current) =>
      current.map((item) => ({ ...item, is_read: true }))
    );
  }

  function openBookingFromNotification(bookingId: string) {
    setHighlightBookingId(bookingId);
    openSection("bookings");
  }

  async function markMessageRead(id: string) {
    await supabase
      .from("message_recipients")
      .update({ is_read: true, read_at: new Date().toISOString() })
      .eq("id", id)
      .eq("user_id", profile?.id || "");

    setMessages((current) =>
      current.map((item) => (item.id === id ? { ...item, is_read: true } : item))
    );
  }

  const unreadNotifications = notifications.filter(
    (item) => !item.is_read
  ).length;
  const unreadMessages = messages.filter((item) => !item.is_read).length;

  function openSection(section: Section) {
    setActiveSection(section);
    setSidebarOpen(false);
  }

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#070707] text-white">
        <div className="text-center">
          <div className="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-4 border-red-600 border-t-transparent" />
          <p className="text-sm text-gray-500">
            Loading CK Motors Dashboard...
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="portal-surface min-h-screen bg-[#080808] text-white">
      {/* MOBILE HEADER */}
      <header className="sticky top-0 z-40 flex h-16 items-center justify-between border-b border-white/10 bg-[#080808]/95 px-5 backdrop-blur">
  <div className="flex items-center gap-4">
    <button
      onClick={() => setSidebarOpen(true)}
      className="flex h-10 w-10 cursor-pointer items-center justify-center rounded-lg border border-white/10 bg-[#111] text-gray-400 transition hover:border-red-700 hover:bg-red-950/30 hover:text-red-500"
      aria-label="Open customer menu"
    >
      <Menu size={20} />
    </button>

    <Link href="/" aria-label="Back to CK Motors website"><Brand /></Link>
  </div>

  <div className="flex items-center gap-2">
    <ThemeToggle />
    <NotificationBell
      notifications={notifications}
      onMarkRead={markNotificationRead}
      onMarkAllRead={markAllNotificationsRead}
      onViewAll={() => openSection("notifications")}
      onOpenBooking={openBookingFromNotification}
    />
  </div>
</header>

      {dataError && (
        <div className="mx-auto mt-4 max-w-[1500px] px-5 md:px-8">
          <p role="alert" className="rounded-xl border border-amber-700/50 bg-amber-950/30 px-4 py-3 text-sm text-amber-200">
            {dataError}
          </p>
        </div>
      )}
       

      {/* MOBILE OVERLAY */}
      {sidebarOpen && (
        <div
          onClick={() => setSidebarOpen(false)}
          className="fixed inset-0 z-40 bg-black/70 lg:hidden"
        />
      )}

      {/* SIDEBAR */}
      <aside
  className={`fixed left-0 top-0 z-50 flex h-screen w-[280px] flex-col border-r border-white/10 bg-[#0c0c0c] shadow-2xl transition-transform duration-300 lg:translate-x-0 ${
    sidebarOpen
      ? "translate-x-0"
      : "-translate-x-full"
  }`}
>
      
        <div className="flex h-20 items-center justify-between border-b border-white/10 px-5">
          <Brand />

          <button
  onClick={() => setSidebarOpen(false)}
  className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-lg border border-white/10 text-gray-500 transition hover:border-red-700 hover:text-white"
>
  <X size={18} />
</button>
        </div>

        <div className="px-4 py-5">
          <p className="mb-3 px-3 text-[10px] font-bold uppercase tracking-[0.2em] text-gray-600">
            Customer Menu
          </p>

          <SidebarButton
            active={activeSection === "dashboard"}
            icon={<Home size={18} />}
            label="Dashboard"
            onClick={() => openSection("dashboard")}
          />

          <SidebarButton
            active={activeSection === "vehicles"}
            icon={<Car size={18} />}
            label="My Vehicles"
            onClick={() => openSection("vehicles")}
          />

          <SidebarButton
            active={activeSection === "bookings"}
            icon={<CalendarDays size={18} />}
            label="My Bookings"
            onClick={() => openSection("bookings")}
          />

          <SidebarButton
            active={activeSection === "history"}
            icon={<History size={18} />}
            label="Service History"
            onClick={() => openSection("history")}
          />

          <SidebarButton
            active={activeSection === "notifications"}
            icon={<Bell size={18} />}
            label="Notifications"
            badge={unreadNotifications}
            onClick={() => openSection("notifications")}
          />
          <SidebarButton
            active={activeSection === "messages"}
            icon={<MessageSquare size={18} />}
            label="Messages"
            badge={unreadMessages}
            onClick={() => openSection("messages")}
          />

          <SidebarButton
            active={activeSection === "profile"}
            icon={<User size={18} />}
            label="Profile"
            onClick={() => openSection("profile")}
          />
        </div>

        <div className="mt-auto border-t border-white/10 p-4">
          <Link href="/" className="mb-2 flex w-full items-center gap-3 rounded-lg px-4 py-3 text-sm font-semibold text-gray-400 transition hover:bg-white/5 hover:text-white">
            <Home size={18} />
            CK Motors Website
          </Link>
          <button
            onClick={handleLogout}
            className="flex w-full items-center gap-3 rounded-lg px-4 py-3 text-sm font-semibold text-gray-400 transition hover:bg-red-950/40 hover:text-red-500"
          >
            <LogOut size={18} />
            Logout
          </button>
        </div>
      </aside>

      {/* MAIN */}
      <section className="min-h-screen w-full overflow-x-hidden lg:ml-[280px] lg:w-[calc(100%-280px)]">
        <div className="mx-auto w-full max-w-[1500px] px-5 py-7 sm:px-6 md:px-8 lg:px-10">
          {/* TOP */}
          <div className="mb-8 flex flex-wrap items-center justify-between gap-6 rounded-2xl border border-white/10 bg-[#0d0d0d] p-5 md:p-6">
            <div>
              <p className="mb-2 text-xs font-bold uppercase tracking-[0.2em] text-red-500">
                CK Motors Customer Portal
              </p>

              <h1 className="text-2xl font-black md:text-3xl">
                Welcome back,{" "}
                <span className="text-red-500">
                  {profile?.full_name || "Customer"}
                </span>
              </h1>
            </div>

            <div className="flex items-center gap-3">
              <ThemeToggle />
              <NotificationBell
                notifications={notifications}
                onMarkRead={markNotificationRead}
                onMarkAllRead={markAllNotificationsRead}
                onViewAll={() => openSection("notifications")}
                onOpenBooking={openBookingFromNotification}
              />
            </div>
          </div>

          {activeSection === "dashboard" && (
            <DashboardHome
              vehicles={vehicles}
              bookings={bookings}
              history={history}
              notifications={notifications}
              openSection={openSection}
            />
          )}

          {activeSection === "vehicles" && <VehiclesManager />}
           

          {activeSection === "bookings" && (
            <BookingManager
              onAddVehicle={() => openSection("vehicles")}
              highlightBookingId={highlightBookingId}
              onHighlightHandled={() => setHighlightBookingId(null)}
            />
          )}

          {activeSection === "history" && (
  <ServiceHistoryManager />
)}

          {activeSection === "notifications" && (
            <NotificationsSection
              notifications={notifications}
              onRead={markNotificationRead}
            />
          )}

          {activeSection === "messages" && (
            <MessagesSection
              messages={messages}
              error={messageError}
              onRead={markMessageRead}
              supabase={supabase}
            />
          )}

          {activeSection === "profile" && (
            <ProfileSection key={profile?.id} profile={profile} saving={savingProfile} error={profileError} onSave={saveProfile} />
          )}
        </div>
      </section>
    </main>
  );
}

function Brand() {
  return (
    <div className="flex items-center">
      <CKLogo size="small" surface />
    </div>
  );
}
function SidebarButton({
  icon,
  label,
  active,
  badge,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  active: boolean;
  badge?: number;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`mb-1 flex w-full items-center gap-3 rounded-lg px-4 py-3 text-left text-sm font-semibold transition ${
        active
          ? "bg-red-600 text-white"
          : "text-gray-500 hover:bg-white/5 hover:text-white"
      }`}
    >
      {icon}

      <span className="flex-1">{label}</span>

      {!!badge && badge > 0 && (
        <span className="rounded-full bg-white px-2 py-0.5 text-[10px] font-black text-red-600">
          {badge}
        </span>
      )}
    </button>
  );
}

function DashboardHome({
  vehicles,
  bookings,
  history,
  notifications,
  openSection,
}: {
  vehicles: Vehicle[];
  bookings: Booking[];
  history: ServiceRecord[];
  notifications: Notification[];
  openSection: (section: Section) => void;
}) {
  const activeBookings = bookings.filter(
    (item) =>
      item.status !== "completed" &&
      item.status !== "cancelled"
  );

  const unread = notifications.filter(
    (item) => !item.is_read
  ).length;

  return (
    <>
      <div className="mb-8 grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          icon={<Car />}
          title="My Vehicles"
          value={vehicles.length}
        />

        <StatCard
          icon={<CalendarDays />}
          title="Active Bookings"
          value={activeBookings.length}
        />

        <StatCard
          icon={<Wrench />}
          title="Completed Services"
          value={history.length}
        />

        <StatCard
          icon={<Bell />}
          title="Unread Notifications"
          value={unread}
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <Panel
          title="Upcoming / Active Bookings"
          action="View All"
          onAction={() => openSection("bookings")}
        >
          {activeBookings.length === 0 ? (
            <EmptyState text="No active service bookings yet." />
          ) : (
            <div className="space-y-3">
              {activeBookings.slice(0, 4).map((booking) => (
                <div
                  key={booking.id}
                  className="rounded-xl border border-white/10 bg-black/30 p-4"
                >
                  <div className="mb-2 flex items-center justify-between gap-3">
                    <span className="font-bold">
                      {booking.service_name_snapshot ||
                        "Vehicle Service"}
                    </span>

                    <Status status={booking.status} />
                  </div>

                  <p className="text-xs text-gray-500">
                    {booking.booking_reference} •{" "}
                    {booking.booking_date}
                  </p>
                </div>
              ))}
            </div>
          )}
        </Panel>

        <Panel
          title="Recent Service History"
          action="View History"
          onAction={() => openSection("history")}
        >
          {history.length === 0 ? (
            <EmptyState text="No completed service records yet." />
          ) : (
            <div className="space-y-3">
              {history.slice(0, 4).map((record) => (
                <div
                  key={record.id}
                  className="rounded-xl border border-white/10 bg-black/30 p-4"
                >
                  <div className="font-bold">
                    {record.services_performed}
                  </div>

                  <div className="mt-2 flex justify-between text-xs text-gray-500">
                    <span>{record.service_date}</span>

                    <span>
                      LKR{" "}
                      {Number(record.total_cost || 0).toLocaleString()}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Panel>
      </div>
    </>
  );
}

function NotificationsSection({
  notifications,
  onRead,
}: {
  notifications: Notification[];
  onRead: (id: string) => void;
}) {
  return (
    <Panel title="Notifications">
      {notifications.length === 0 ? (
        <EmptyState text="You do not have any notifications." />
      ) : (
        <div className="space-y-3">
          {notifications.map((notification) => (
            <button
              key={notification.id}
              onClick={() =>
                !notification.is_read &&
                onRead(notification.id)
              }
              className={`w-full rounded-xl border p-4 text-left transition ${
                notification.is_read
                  ? "border-white/10 bg-black/20"
                  : "border-red-900/60 bg-red-950/20"
              }`}
            >
              <div className="flex items-start gap-3">
                <Bell
                  size={18}
                  className={
                    notification.is_read
                      ? "text-gray-600"
                      : "text-red-500"
                  }
                />

                <div>
                  <h3 className="text-sm font-bold">
                    {notification.title}
                  </h3>

                  <p className="mt-1 text-xs leading-5 text-gray-500">
                    {notification.message}
                  </p>

                  <p className="mt-2 text-[10px] text-gray-700">
                    {new Date(
                      notification.created_at
                    ).toLocaleString()}
                  </p>
                </div>
              </div>
            </button>
          ))}
        </div>
      )}
    </Panel>
  );
}

function MessagesSection({
  messages,
  error,
  onRead,
  supabase,
}: {
  messages: CustomerMessage[];
  error: string;
  onRead: (id: string) => void;
  supabase: ReturnType<typeof createClient>;
}) {
  const [selectedMessage, setSelectedMessage] = useState<CustomerMessage | null>(null);
  const [attachmentUrls, setAttachmentUrls] = useState<Record<string, string>>({});
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!selectedMessage) return;
    const message = selectedMessage;
    let cancelled = false;
    async function loadUrls() {
      const entries = await Promise.all(
        message.message.message_attachments.map(async (attachment) => {
          const { data, error } = await supabase.storage
            .from("message-attachments")
            .createSignedUrl(attachment.storage_path, 300);
          return error || !data ? null : [attachment.id, data.signedUrl] as const;
        })
      );
      if (!cancelled) {
        setAttachmentUrls(Object.fromEntries(entries.filter((entry): entry is readonly [string, string] => entry !== null)));
      }
    }
    void loadUrls();
    return () => {
      cancelled = true;
    };
  }, [selectedMessage, supabase]);

  function openMessage(message: CustomerMessage) {
    setSelectedMessage(message);
    if (!message.is_read) onRead(message.id);
  }

  return (
    <Panel title="Messages">
      {error && (
        <div className="mb-4 rounded-xl border border-red-900/60 bg-red-950/20 p-4 text-xs text-red-400">
          Messages could not be loaded: {error}
        </div>
      )}
      {messages.length === 0 ? (
        <EmptyState text="You do not have any messages from CK Motors." />
      ) : (
        <div className="space-y-3">
          {messages.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => openMessage(item)}
              className={`w-full rounded-xl border p-4 text-left transition ${
                item.is_read ? "border-white/10 bg-black/20" : "border-red-900/60 bg-red-950/20"
              }`}
            >
              <div className="flex items-start gap-3">
                <MessageSquare size={18} className={item.is_read ? "text-gray-600" : "text-red-500"} />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h3 className="text-sm font-bold">{item.message.title}</h3>
                    <span className="text-[10px] text-gray-600">{new Date(item.created_at).toLocaleString()}</span>
                  </div>
                  <p className="mt-1 line-clamp-2 text-xs leading-5 text-gray-500">{item.message.body || "Photo message"}</p>
                  {item.message.message_attachments.length > 0 && (
                    <p className="mt-2 flex items-center gap-1 text-[10px] font-bold text-red-500">
                      <Paperclip size={12} /> {item.message.message_attachments.length} photo{item.message.message_attachments.length === 1 ? "" : "s"}
                    </p>
                  )}
                </div>
              </div>
            </button>
          ))}
        </div>
      )}

      {selectedMessage && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/75 p-4">
          <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-white/10 bg-[#111] p-6 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-red-500">CK Motors</p>
                <h2 className="mt-1 text-xl font-black">{selectedMessage.message.title}</h2>
              </div>
              <button type="button" onClick={() => setSelectedMessage(null)} aria-label="Close message" className="rounded-lg p-2 text-gray-500 hover:text-red-500">
                <X size={18} />
              </button>
            </div>
            <p className="mt-5 whitespace-pre-wrap text-sm leading-7 text-gray-400">{selectedMessage.message.body || "Photo message"}</p>
            <p className="mt-4 text-xs text-gray-600">
              From CK Motors · {new Date(selectedMessage.created_at).toLocaleString()}
            </p>
            {selectedMessage.message.message_attachments.length > 0 && (
              <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3">
                {selectedMessage.message.message_attachments.map((attachment) => (
                  <button key={attachment.id} type="button" onClick={() => attachmentUrls[attachment.id] && setPreviewUrl(attachmentUrls[attachment.id])} className="overflow-hidden rounded-xl border border-white/10">
                    {attachmentUrls[attachment.id] ? (
                      <img src={attachmentUrls[attachment.id]} alt={attachment.file_name} loading="lazy" className="aspect-square w-full object-cover" />
                    ) : (
                      <span className="flex aspect-square items-center justify-center text-xs text-gray-600">Loading...</span>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
      {previewUrl && (
        <button type="button" onClick={() => setPreviewUrl(null)} className="fixed inset-0 z-[130] flex items-center justify-center bg-black/90 p-5">
          <img src={previewUrl} alt="Expanded message attachment" className="max-h-full max-w-full object-contain" />
        </button>
      )}
    </Panel>
  );
}

function ProfileSection({
  profile,
  saving,
  error,
  onSave,
}: {
  profile: Profile | null;
  saving: boolean;
  error: string;
  onSave: (fields: { address_line1: string; address_line2: string; city: string; district: string; postal_code: string }) => void;
}) {
  const [form, setForm] = useState({
    address_line1: profile?.address_line1 || "",
    address_line2: profile?.address_line2 || "",
    city: profile?.city || "",
    district: profile?.district || "",
    postal_code: profile?.postal_code || "",
  });

  return (
    <Panel title="My Profile">
      <div className="mx-auto max-w-xl rounded-2xl border border-white/10 bg-black/30 p-6">
        <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-red-600 to-red-900 text-2xl font-black">
          {profile?.full_name?.charAt(0).toUpperCase() || "C"}
        </div>

        <ProfileRow
          label="Full Name"
          value={profile?.full_name || "—"}
        />

        <ProfileRow
          label="Email"
          value={profile?.email || "—"}
        />

        <ProfileRow
          label="Phone"
          value={profile?.phone || "—"}
        />

        <form onSubmit={(event) => { event.preventDefault(); onSave(form); }} className="mt-4 space-y-3">
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-red-500">Address Information</p>
          {([
            ["address_line1", "Address Line 1"],
            ["address_line2", "Address Line 2"],
            ["city", "City"],
            ["district", "District"],
            ["postal_code", "Postal Code"],
          ] as const).map(([key, label]) => (
            <label key={key} className="block text-xs font-semibold text-gray-500">
              {label}
              <input value={form[key]} onChange={(event) => setForm({ ...form, [key]: event.target.value })} className="mt-1 w-full rounded-lg border border-white/10 bg-[#080808] px-3 py-2 text-sm text-white outline-none focus:border-red-600" />
            </label>
          ))}
          {error && <p className="text-xs text-red-400">{error}</p>}
          <button disabled={saving} className="rounded-lg bg-red-600 px-4 py-2 text-xs font-bold text-white disabled:opacity-50">{saving ? "Saving..." : "Save Address"}</button>
        </form>

        <ProfileRow
          label="Account Type"
          value={profile?.role || "customer"}
        />
      </div>
    </Panel>
  );
}

function StatCard({
  icon,
  title,
  value,
}: {
  icon: React.ReactNode;
  title: string;
  value: number;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-[#111] p-5">
      <div className="mb-5 flex h-11 w-11 items-center justify-center rounded-xl bg-red-950/40 text-red-500">
        {icon}
      </div>

      <div className="text-3xl font-black">{value}</div>

      <div className="mt-1 text-xs font-semibold text-gray-500">
        {title}
      </div>
    </div>
  );
}

function Panel({
  title,
  children,
  action,
  onAction,
}: {
  title: string;
  children: React.ReactNode;
  action?: string;
  onAction?: () => void;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-[#111] p-5 md:p-6">
      <div className="mb-5 flex items-center justify-between gap-4">
        <h2 className="text-lg font-black">{title}</h2>

        {action && onAction && (
          <button
            onClick={onAction}
            className="text-xs font-bold text-red-500 hover:text-red-400"
          >
            {action} →
          </button>
        )}
      </div>

      {children}
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="flex min-h-40 flex-col items-center justify-center rounded-xl border border-dashed border-white/10 p-6 text-center">
      <ClipboardList
        size={30}
        className="mb-3 text-gray-700"
      />

      <p className="text-sm text-gray-600">{text}</p>
    </div>
  );
}

function Status({ status }: { status: string }) {
  const readable = status
    .replaceAll("_", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());

  return (
    <span className="rounded-full border border-red-900/50 bg-red-950/30 px-3 py-1 text-[10px] font-bold text-red-400">
      {readable}
    </span>
  );
}

function ProfileRow({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="flex flex-wrap justify-between gap-3 border-b border-white/10 py-4 text-sm last:border-0">
      <span className="text-gray-600">{label}</span>
      <span className="font-semibold text-gray-300">
        {value}
      </span>
    </div>
  );
}