import React from "react";
import { CheckCircle, Clock, ChefHat } from "lucide-react";

export type OrderStatus = "waiting" | "cooking" | "ready" | "completed";

export const MockOrderCard: React.FC<{
  orderId: string;
  items: string[];
  status: OrderStatus;
  style?: React.CSSProperties;
}> = ({ orderId, items, status, style }) => {
  const getStatusColor = (s: OrderStatus) => {
    switch (s) {
      case "waiting":
        return "#f59e0b"; // Amber
      case "cooking":
        return "#ef4444"; // Red
      case "ready":
        return "#10b981"; // Green
      case "completed":
        return "#6b7280"; // Gray
      default:
        return "#6b7280";
    }
  };

  const getStatusIcon = (s: OrderStatus) => {
    switch (s) {
      case "waiting":
        return <Clock size={24} color="white" />;
      case "cooking":
        return <ChefHat size={24} color="white" />;
      case "ready":
        return <CheckCircle size={24} color="white" />;
      case "completed":
        return <CheckCircle size={24} color="white" />;
    }
  };

  const getStatusText = (s: OrderStatus) => {
    switch (s) {
      case "waiting":
        return "受付待ち";
      case "cooking":
        return "調理中";
      case "ready":
        return "呼出中";
      case "completed":
        return "受渡完了";
    }
  };

  return (
    <div
      style={{
        background: "white",
        borderRadius: "16px",
        padding: "24px",
        boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
        width: "100%",
        maxWidth: "400px",
        display: "flex",
        flexDirection: "column",
        gap: "16px",
        fontFamily: "Noto Sans JP",
        ...style,
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          borderBottom: "1px solid #e5e7eb",
          paddingBottom: "12px",
        }}
      >
        <span
          style={{ fontWeight: "bold", fontSize: "20px", color: "#374151" }}
        >
          #{orderId}
        </span>
        <div
          style={{
            background: getStatusColor(status),
            padding: "6px 16px",
            borderRadius: "20px",
            color: "white",
            fontWeight: "bold",
            fontSize: "16px",
            display: "flex",
            alignItems: "center",
            gap: "8px",
          }}
        >
          {getStatusIcon(status)}
          {getStatusText(status)}
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
        {items.map((item, i) => (
          <div key={i} style={{ fontSize: "18px", color: "#1f2937" }}>
            {item}
          </div>
        ))}
      </div>

      <div
        style={{
          display: "flex",
          justifyContent: "flex-end",
          gap: "10px",
          marginTop: "8px",
        }}
      >
        {/* Action buttons could go here if needed for animation */}
      </div>
    </div>
  );
};
