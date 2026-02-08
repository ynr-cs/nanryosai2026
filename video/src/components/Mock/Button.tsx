import React from "react";
import { AbsoluteFill } from "remotion";

export const MockButton: React.FC<{
  text: string;
  variant?: "primary" | "secondary" | "danger";
  onClick?: () => void;
  style?: React.CSSProperties;
}> = ({ text, variant = "primary", style }) => {
  const baseStyle: React.CSSProperties = {
    padding: "12px 24px",
    borderRadius: "12px",
    border: "none",
    fontWeight: "bold",
    fontSize: "24px",
    color: "white",
    boxShadow: "0 4px 6px rgba(0,0,0,0.1)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontFamily: "var(--font-family)",
    ...style,
  };

  const variants = {
    primary: {
      background: "var(--primary-gradient)",
    },
    secondary: {
      background: "var(--bg-color)",
      color: "var(--text-main)",
      border: "1px solid var(--border-color)",
    },
    danger: {
      background: "#ef4444",
    },
  };

  return <div style={{ ...baseStyle, ...variants[variant] }}>{text}</div>;
};
