export type UserAgentDetails = {
  deviceType: string;
  browser: string;
  operatingSystem: string;
};

export function parseUserAgent(userAgent: string): UserAgentDetails {
  const value = userAgent || "";
  const deviceType = /iPad|Tablet|Android(?!.*Mobile)/i.test(value)
    ? "Tablet"
    : /Mobile|iPhone|Android/i.test(value)
      ? "Mobile"
      : "Desktop";

  const browser = /Edg\//i.test(value)
    ? "Edge"
    : /OPR\//i.test(value)
      ? "Opera"
      : /Chrome\//i.test(value)
        ? "Chrome"
        : /Firefox\//i.test(value)
          ? "Firefox"
          : /Safari\//i.test(value)
            ? "Safari"
            : /MSIE|Trident\//i.test(value)
              ? "Internet Explorer"
              : "Unknown";

  const operatingSystem = /iPhone|iPad/i.test(value)
    ? "iOS"
    : /Android/i.test(value)
      ? "Android"
      : /Windows/i.test(value)
        ? "Windows"
        : /Mac OS X/i.test(value)
          ? "macOS"
          : /Linux/i.test(value)
            ? "Linux"
            : "Unknown";

  return { deviceType, browser, operatingSystem };
}
