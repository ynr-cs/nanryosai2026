import React from "react";

export const MockTablet: React.FC<{
  children: React.ReactNode;
  orientation?: "landscape" | "portrait";
  style?: React.CSSProperties;
}> = ({ children, orientation = "landscape", style }) => {
  const width = orientation === "landscape" ? "1024px" : "768px";
  const height = orientation === "landscape" ? "768px" : "1024px";

  return (
    <div
      style={{
        width,
        height,
        background: "#1a1a1a",
        borderRadius: "24px",
        boxShadow: "0 30px 60px rgba(0,0,0,0.6)",
        border: "12px solid #2c2c2c",
        position: "relative",
        overflow: "hidden",
        ...style,
      }}
    >
      {/* Bezel / Camera */}
      <div
        style={{
          position: "absolute",
          top: orientation === "landscape" ? "50%" : "12px",
          left: orientation === "landscape" ? "12px" : "50%",
          transform: "translate(-50%, -50%)",
          width: "12px",
          height: "12px",
          background: "#444",
          borderRadius: "50%",
          zIndex: 100,
        }}
      />

      <div
        style={{
          width: "100%",
          height: "100%",
          background: "var(--bg-color)", // Screen content bg
          position: "relative",
          overflow: "hidden",
        }}
      >
        {children}
      </div>
    </div>
  );
};
