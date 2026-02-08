import React from "react";

export const MockDashboard: React.FC<{
  children: React.ReactNode;
}> = ({ children }) => {
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        background: "#f3f4f6",
        display: "flex",
        fontFamily: "Noto Sans JP",
      }}
    >
      {/* Sidebar */}
      <div
        style={{
          width: "250px",
          background: "white",
          borderRight: "1px solid #e5e7eb",
          padding: "24px",
          display: "flex",
          flexDirection: "column",
          gap: "24px",
        }}
      >
        <div
          style={{
            fontSize: "24px",
            fontWeight: "bold",
            color: "var(--primary-color)",
          }}
        >
          Nanryosai POS
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          {["注文管理", "在庫管理", "売上分析", "設定"].map((item) => (
            <div
              key={item}
              style={{
                padding: "12px",
                borderRadius: "8px",
                background: item === "注文管理" ? "#eff6ff" : "transparent",
                color: item === "注文管理" ? "var(--primary-color)" : "#4b5563",
                fontWeight: item === "注文管理" ? "bold" : "normal",
              }}
            >
              {item}
            </div>
          ))}
        </div>
      </div>

      {/* Main Content */}
      <div
        style={{
          flex: 1,
          padding: "32px",
          overflow: "hidden",
        }}
      >
        {children}
      </div>
    </div>
  );
};
