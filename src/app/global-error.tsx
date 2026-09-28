"use client";

import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "24px",
          fontFamily: "Arial, Helvetica, sans-serif",
          background: "#f7f2ec",
          color: "#1c1917",
        }}
      >
        <div
          style={{
            width: "100%",
            maxWidth: "420px",
            textAlign: "center",
            background: "#fff",
            borderRadius: "24px",
            border: "1px solid rgba(0,0,0,0.06)",
            boxShadow: "0 12px 32px -16px rgba(16,24,40,0.15)",
            padding: "32px",
          }}
        >
          <div
            style={{
              margin: "0 auto",
              height: "56px",
              width: "56px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              borderRadius: "16px",
              background: "rgba(220,38,38,0.1)",
              color: "#dc2626",
              fontSize: "28px",
            }}
          >
            !
          </div>
          <h1 style={{ marginTop: "16px", fontSize: "18px", fontWeight: 600 }}>
            The application failed to load
          </h1>
          <p style={{ marginTop: "8px", fontSize: "14px", color: "#6b6259", lineHeight: 1.5 }}>
            Something went wrong at startup. Reloading usually fixes this.
          </p>
          {error.digest && (
            <p
              style={{
                marginTop: "12px",
                fontSize: "12px",
                fontFamily: "monospace",
                background: "#f2ede6",
                borderRadius: "6px",
                padding: "4px 8px",
                display: "inline-block",
                color: "#6b6259",
              }}
            >
              Reference: {error.digest}
            </p>
          )}
          <div style={{ marginTop: "24px" }}>
            <button
              onClick={() => reset()}
              style={{
                background: "#c9822f",
                color: "#fff",
                border: "none",
                borderRadius: "8px",
                padding: "10px 20px",
                fontSize: "14px",
                fontWeight: 500,
                cursor: "pointer",
              }}
            >
              Reload
            </button>
          </div>
        </div>
      </body>
    </html>
  );
}
