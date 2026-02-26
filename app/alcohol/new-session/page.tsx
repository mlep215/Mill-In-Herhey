"use client";

import { useRouter } from "next/navigation";

type LocationOption = { id: string; name: string };

const LOCATIONS: LocationOption[] = [
  { id: "bar-one", name: "Bar One" },
  { id: "bar-two", name: "Bar Two" },
  { id: "bar-three", name: "Bar Three" },
  { id: "liquor-cabinet", name: "Liquor Cabinet" },
];

export default function NewSessionPage() {
  const router = useRouter();

  function handlePickLocation(locationId: string) {
    const sessionId = crypto.randomUUID();
    router.push(`/alcohol/session/${sessionId}/location/${locationId}`);
  }

  return (
    <main
      style={{
        minHeight: "100vh",
        backgroundColor: "#f4f4f5",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: "sans-serif",
        padding: 24,
      }}
    >
      <div
        style={{
          background: "white",
          padding: 30,
          borderRadius: 12,
          width: 440,
          boxShadow: "0 10px 25px rgba(0,0,0,0.1)",
        }}
      >
        <h1 style={{ fontSize: 24, fontWeight: 700, color: "#111" }}>
          Select Location
        </h1>
        <p style={{ marginTop: 8, color: "#444" }}>
          Choose where you’re counting inventory.
        </p>

        <div style={{ marginTop: 18, display: "grid", gap: 12 }}>
          {LOCATIONS.map((loc) => (
            <button
              key={loc.id}
              onClick={() => handlePickLocation(loc.id)}
              style={{
                padding: 14,
                borderRadius: 8,
                border: "1px solid #ddd",
                background: "#fafafa",
                color: "#111",
                fontSize: 16,
                fontWeight: 700,
                cursor: "pointer",
                textAlign: "left",
              }}
            >
              {loc.name}
              <div style={{ marginTop: 4, fontSize: 12, color: "#666" }}>
                {loc.id}
              </div>
            </button>
          ))}
        </div>

        <div style={{ marginTop: 18, fontSize: 12, color: "#666" }}>
          This will create a new session ID and route you into that location.
        </div>
      </div>
    </main>
  );
}