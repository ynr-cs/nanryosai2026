import React from "react";

interface ButtonProps {
  text: string;
  color?: string;
  onClick?: () => void;
  style?: React.CSSProperties;
}

export const MockButton: React.FC<ButtonProps> = ({
  text,
  color = "#007bff",
  style,
}) => {
  return (
    <div
      style={{
        backgroundColor: color,
        color: "white",
        padding: "15px 30px",
        borderRadius: "8px",
        fontSize: "24px",
        fontWeight: "bold",
        display: "inline-block",
        boxShadow: "0 4px 6px rgba(0,0,0,0.1)",
        textAlign: "center",
        ...style,
      }}
    >
      {text}
    </div>
  );
};
