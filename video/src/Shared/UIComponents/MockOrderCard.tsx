import React from "react";
import { MockButton } from "./MockButton";

interface OrderCardProps {
  orderId: string;
  items: string[];
  status: "new" | "cooking" | "ready" | "completed";
  style?: React.CSSProperties;
}

export const MockOrderCard: React.FC<OrderCardProps> = ({
  orderId,
  items,
  status,
  style,
}) => {
  const getStatusColor = () => {
    switch (status) {
      case "new":
        return "#ff6b6b";
      case "cooking":
        return "#feca57";
      case "ready":
        return "#1dd1a1";
      case "completed":
        return "#8395a7";
    }
  };

  return (
    <div
      style={{
        backgroundColor: "white",
        border: `2px solid ${getStatusColor()}`,
        borderRadius: 12,
        padding: 16,
        width: 300,
        boxShadow: "0 4px 8px rgba(0,0,0,0.1)",
        fontFamily: "sans-serif",
        ...style,
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          marginBottom: 12,
        }}
      >
        <span style={{ fontWeight: "bold", fontSize: 20 }}>#{orderId}</span>
        <span
          style={{
            backgroundColor: getStatusColor(),
            color: "white",
            padding: "4px 8px",
            borderRadius: 4,
            fontSize: 14,
          }}
        >
          {status.toUpperCase()}
        </span>
      </div>
      <ul style={{ listStyle: "none", padding: 0, margin: "0 0 16px 0" }}>
        {items.map((item, idx) => (
          <li
            key={idx}
            style={{
              padding: "4px 0",
              borderBottom: "1px solid #eee",
              fontSize: 18,
            }}
          >
            {item}
          </li>
        ))}
      </ul>
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
        {status === "new" && (
          <MockButton
            text="調理開始"
            color="#feca57"
            style={{ fontSize: 16, padding: "8px 16px" }}
          />
        )}
        {status === "cooking" && (
          <MockButton
            text="呼出"
            color="#1dd1a1"
            style={{ fontSize: 16, padding: "8px 16px" }}
          />
        )}
        {status === "ready" && (
          <MockButton
            text="完了"
            color="#54a0ff"
            style={{ fontSize: 16, padding: "8px 16px" }}
          />
        )}
      </div>
    </div>
  );
};
