"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  function handleSignIn() {
    router.push("/alcohol/new-session");
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
      }}
    >
      <div
        style={{
          background: "white",
          padding: 30,
          borderRadius: 12,
          width: 360,
          boxShadow: "0 10px 25px rgba(0,0,0,0.1)",
        }}
      >
        <h1 style={{ fontSize: 24, fontWeight: 700, color: "#111" }}>
          Login
        </h1>

        <label style={{ display: "block", marginTop: 20, color: "#111" }}>
          Email
          <input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            style={{
              width: "100%",
              padding: 10,
              marginTop: 6,
              border: "1px solid #ccc",
              borderRadius: 6,
              color: "#111",
              background: "white",
            }}
          />
        </label>

        <label style={{ display: "block", marginTop: 14, color: "#111" }}>
          Password
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            style={{
              width: "100%",
              padding: 10,
              marginTop: 6,
              border: "1px solid #ccc",
              borderRadius: 6,
              color: "#111",
              background: "white",
            }}
          />
        </label>

        <button
          onClick={handleSignIn}
          style={{
            marginTop: 20,
            padding: 12,
            width: "100%",
            background: "#111",
            color: "white",
            borderRadius: 8,
            cursor: "pointer",
            border: "none",
            fontWeight: 600,
          }}
        >
          Sign in
        </button>
      </div>
    </main>
  );
}