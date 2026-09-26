"use client";

import { useState } from "react";
import {
  BarChart3,
  Boxes,
  CalendarClock,
  ClipboardList,
  FileText,
  KeyRound,
  Mail,
  ReceiptText,
  ShieldAlert,
  Truck,
  UserCog,
  Users,
  Wrench,
} from "lucide-react";
import type { ReportBooking, ReportProfile, ReportSentMessage, ReportServiceRecord, ReportVehicle } from "./types";
import CustomerListReport from "./CustomerListReport";
import BookingsReport from "./BookingsReport";
import RevenueReport from "./RevenueReport";
import { InventoryReport, LowStockReport, StockMovementReport } from "./InventoryReports";
import { SupplierListReport, TechnicianReportView } from "./SupplierTechnicianReport";
import ServiceRecordsReport from "./ServiceRecordsReport";
import { LoginActivityReport, VisitorReport } from "./SecurityReports";
import AnalyticsReportView from "./AnalyticsReport";
import MessagesReport from "./MessagesReport";

export type ReportKey =
  | "customers"
  | "bookings"
  | "today-workshop"
  | "revenue"
  | "inventory"
  | "low-stock"
  | "stock-movement"
  | "suppliers"
  | "technicians"
  | "service-records"
  | "vehicle-history"
  | "login-activity"
  | "visitor"
  | "analytics"
  | "messages";

type ReportCard = {
  key: ReportKey;
  label: string;
  description: string;
  icon: typeof FileText;
  adminOnly?: boolean;
};

const REPORT_CARDS: ReportCard[] = [
  { key: "bookings", label: "Booking Report", description: "Filter and print bookings by status or date range.", icon: ClipboardList },
  { key: "today-workshop", label: "Today's Workshop Sheet", description: "Printable daily job sheet for the workshop floor.", icon: CalendarClock },
  { key: "customers", label: "Customer Report", description: "Printable customer list with vehicles and visit counts.", icon: Users },
  { key: "revenue", label: "Monthly Revenue Report", description: "Real invoiced revenue for a selected month.", icon: ReceiptText },
  { key: "service-records", label: "Service Records Report", description: "Completed jobs, technicians, parts and invoice totals.", icon: Wrench },
  { key: "vehicle-history", label: "Vehicle Service History", description: "Full service history for a single vehicle.", icon: FileText },
  { key: "inventory", label: "Inventory Report", description: "Full parts inventory with stock and value totals.", icon: Boxes },
  { key: "low-stock", label: "Low Stock Report", description: "Parts at or below minimum stock level.", icon: Boxes },
  { key: "stock-movement", label: "Stock Movement Report", description: "Stock in/out history for inventory parts.", icon: Boxes },
  { key: "suppliers", label: "Supplier Report", description: "Supplier directory and items supplied.", icon: Truck },
  { key: "technicians", label: "Technician Report", description: "Technician workload from service records.", icon: UserCog },
  { key: "analytics", label: "Analytics Report", description: "Website traffic summary for a date range.", icon: BarChart3 },
  { key: "login-activity", label: "Login Activity Report", description: "Confidential admin-only login security log.", icon: KeyRound, adminOnly: true },
  { key: "visitor", label: "Visitor Report", description: "Confidential admin-only visitor security detail.", icon: ShieldAlert, adminOnly: true },
  { key: "messages", label: "Messages Report", description: "Broadcast messages sent to customers.", icon: Mail },
];

export default function ReportCenter({
  isAdmin,
  profiles,
  vehicles,
  bookings,
  records,
  sentMessages,
}: {
  isAdmin: boolean;
  profiles: ReportProfile[];
  vehicles: ReportVehicle[];
  bookings: ReportBooking[];
  records: ReportServiceRecord[];
  sentMessages: ReportSentMessage[];
}) {
  const [active, setActive] = useState<ReportKey | null>(null);

  if (active) {
    const back = () => setActive(null);
    switch (active) {
      case "customers":
        return <CustomerListReport profiles={profiles} vehicles={vehicles} bookings={bookings} records={records} onBack={back} />;
      case "bookings":
        return <BookingsReport bookings={bookings} profiles={profiles} vehicles={vehicles} mode="full" onBack={back} />;
      case "today-workshop":
        return <BookingsReport bookings={bookings} profiles={profiles} vehicles={vehicles} mode="today" onBack={back} />;
      case "revenue":
        return <RevenueReport records={records} profiles={profiles} vehicles={vehicles} onBack={back} />;
      case "inventory":
        return <InventoryReport onBack={back} />;
      case "low-stock":
        return <LowStockReport onBack={back} />;
      case "stock-movement":
        return <StockMovementReport onBack={back} />;
      case "suppliers":
        return <SupplierListReport onBack={back} />;
      case "technicians":
        return <TechnicianReportView records={records} onBack={back} />;
      case "service-records":
        return <ServiceRecordsReport records={records} profiles={profiles} vehicles={vehicles} mode="all" onBack={back} />;
      case "vehicle-history":
        return <ServiceRecordsReport records={records} profiles={profiles} vehicles={vehicles} mode="vehicle" onBack={back} />;
      case "login-activity":
        return isAdmin ? <LoginActivityReport onBack={back} /> : <AccessDenied onBack={back} />;
      case "visitor":
        return isAdmin ? <VisitorReport onBack={back} /> : <AccessDenied onBack={back} />;
      case "analytics":
        return <AnalyticsReportView onBack={back} />;
      case "messages":
        return <MessagesReport messages={sentMessages} profiles={profiles} onBack={back} />;
      default:
        return null;
    }
  }

  return (
    <div className="space-y-5">
      <div>
        <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-red-500">CK Motors</p>
        <h2 className="mt-1 text-2xl font-black">Report Center</h2>
        <p className="mt-2 text-xs text-gray-500">
          Generate professional printable reports and CSV exports using real, currently filtered CK Motors data.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {REPORT_CARDS.filter((card) => !card.adminOnly || isAdmin).map((card) => {
          const Icon = card.icon;
          return (
            <button
              key={card.key}
              type="button"
              onClick={() => setActive(card.key)}
              className="cursor-pointer rounded-2xl border border-white/10 bg-[#111] p-5 text-left transition hover:border-red-600/50 hover:bg-white/[0.04]"
            >
              <Icon size={22} className="text-red-500" />
              <p className="mt-3 font-black">{card.label}</p>
              <p className="mt-1 text-xs text-gray-500">{card.description}</p>
              {card.adminOnly && <p className="mt-2 text-[9px] font-bold uppercase tracking-wider text-amber-500">Admin Only</p>}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function AccessDenied({ onBack }: { onBack: () => void }) {
  return (
    <div className="rounded-2xl border border-red-900/50 bg-red-950/10 p-8 text-center">
      <p className="text-sm font-bold text-red-400">This report is restricted to administrators.</p>
      <button type="button" onClick={onBack} className="mt-4 cursor-pointer rounded-lg border border-white/10 px-4 py-2 text-xs font-bold text-gray-300 hover:bg-white/10">
        Back to Report Center
      </button>
    </div>
  );
}
