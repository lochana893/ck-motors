export function formatMediaCaption(caption: string | null | undefined): string {
  return (caption || "")
    .replace(/\\r\\n/g, "\n")
    .replace(/\\n/g, "\n")
    .replace(/\r\n?/g, "\n");
}
