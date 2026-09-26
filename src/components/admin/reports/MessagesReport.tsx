"use client";

import ReportToolbar from "@/components/reports/ReportToolbar";
import ReportLayout from "@/components/reports/ReportLayout";
import ReportSummary from "@/components/reports/ReportSummary";
import PrintableTable from "@/components/reports/PrintableTable";
import CSVExportButton from "@/components/reports/CSVExportButton";
import type { CSVColumn } from "@/lib/csv";
import type { ReportProfile, ReportSentMessage } from "./types";

export default function MessagesReport({
  messages,
  profiles,
  onBack,
}: {
  messages: ReportSentMessage[];
  profiles: ReportProfile[];
  onBack: () => void;
}) {
  const recipientsCount = (message: ReportSentMessage) => message.message_recipients?.length || 0;
  const readCount = (message: ReportSentMessage) => (message.message_recipients || []).filter((recipient) => recipient.is_read).length;

  const rows = [...messages].sort((a, b) => b.created_at.localeCompare(a.created_at));

  const csvColumns: CSVColumn<ReportSentMessage>[] = [
    { header: "Title", value: (row) => row.title },
    { header: "Message", value: (row) => row.body.replace(/\s+/g, " ").slice(0, 500) },
    { header: "Date", value: (row) => new Date(row.created_at).toLocaleString() },
    { header: "Recipients", value: (row) => recipientsCount(row) },
    { header: "Read", value: (row) => readCount(row) },
  ];

  return (
    <div>
      <ReportToolbar title="Messages Report" onBack={onBack} orientation="portrait" csvButton={<CSVExportButton filename="ck-motors-messages-report" rows={rows} columns={csvColumns} />} />
      <ReportLayout title="Broadcast Messages Report" orientation="portrait">
        <ReportSummary cards={[{ label: "Total Messages", value: rows.length }, { label: "Registered Customers", value: profiles.filter((profile) => profile.role === "customer").length }]} />
        <PrintableTable
          rowKey={(row) => row.id}
          rows={rows}
          columns={[
            { header: "Title", render: (row) => row.title },
            { header: "Message", render: (row) => row.body },
            { header: "Date", render: (row) => new Date(row.created_at).toLocaleString() },
            { header: "Recipients", align: "center", render: (row) => recipientsCount(row) },
            { header: "Read", align: "center", render: (row) => readCount(row) },
          ]}
        />
      </ReportLayout>
    </div>
  );
}
