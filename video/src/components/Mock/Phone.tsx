import React from "react";
import { AbsoluteFill } from "remotion";

export const MockPhone: React.FC<{
  children: React.ReactNode;
  style?: React.CSSProperties;
}> = ({ children, style }) => {
  return (
    <div
      style={{
        width: "375px",
        height: "812px",
        background: "black",
        borderRadius: "40px",
        boxShadow: "0 20px 50px rgba(0,0,0,0.5)",
        border: "8px solid #333",
        position: "relative",
        overflow: "hidden",
        ...style,
      }}
    >
      {/* Dynamic Island / Notch Area */}
      <div
        style={{
          position: "absolute",
          top: "10px",
          left: "50%",
          transform: "translateX(-50%)",
          width: "120px",
          height: "30px",
          background: "black",
          borderRadius: "15px",
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
