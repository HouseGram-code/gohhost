import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          display: "flex",
          width: "100%",
          height: "100%",
          alignItems: "center",
          justifyContent: "center",
          background: "linear-gradient(135deg, #3b82f6 0%, #1e3a8a 100%)",
          color: "#ffffff",
          fontSize: 116,
          fontWeight: 800,
        }}
      >
        G
      </div>
    ),
    size,
  );
}
