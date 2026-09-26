"use client";

import { useEffect, useState } from "react";

export default function PublicVisitCounter() {
  const [count, setCount] = useState<number | null>(null);

  useEffect(() => {
    let active = true;
    fetch("/api/public-visit-count")
      .then((response) => response.json())
      .then((data: { enabled?: boolean; count?: number }) => {
        if (!active) return;
        if (data.enabled && typeof data.count === "number") {
          setCount(data.count);
        }
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, []);

  if (count === null) return null;

  return (
    <span className="text-xs text-gray-500">
      {count.toLocaleString()}+ Website Visits
    </span>
  );
}
