import React from "react";
import { MockButton } from "./MockButton";

export const MockDashboard: React.FC = () => {
  return (
    <div
      style={{
        backgroundColor: "white",
        padding: 30,
        borderRadius: 16,
        boxShadow: "0 10px 30px rgba(0,0,0,0.1)",
        width: 800,
        fontFamily: "sans-serif",
      }}
    >
      <h2
        style={{
          borderBottom: "2px solid #eee",
          paddingBottom: 10,
          marginTop: 0,
        }}
      >
        店舗管理ダッシュボード
      </h2>

      <div style={{ display: "flex", gap: 20, marginBottom: 30 }}>
        <div
          style={{
            flex: 1,
            backgroundColor: "#f8f9fa",
            padding: 20,
            borderRadius: 8,
          }}
        >
          <div style={{ fontSize: 14, color: "#666" }}>総売上</div>
          <div style={{ fontSize: 32, fontWeight: "bold", color: "#333" }}>
            ¥45,000
          </div>
        </div>
        <div
          style={{
            flex: 1,
            backgroundColor: "#f8f9fa",
            padding: 20,
            borderRadius: 8,
          }}
        >
          <div style={{ fontSize: 14, color: "#666" }}>注文数</div>
          <div style={{ fontSize: 32, fontWeight: "bold", color: "#007bff" }}>
            128件
          </div>
        </div>
      </div>

      <h3 style={{ fontSize: 18, color: "#555" }}>メニュー在庫設定</h3>
      <ul style={{ listStyle: "none", padding: 0 }}>
        {[
          { name: "焼きそば", count: 42, active: true },
          { name: "フランクフルト", count: 0, active: false },
          { name: "タピオカジュース", count: 85, active: true },
        ].map((item, idx) => (
          <li
            key={idx}
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              padding: "15px 0",
              borderBottom: "1px solid #eee",
              opacity: item.active ? 1 : 0.5,
            }}
          >
            <span style={{ fontSize: 20, fontWeight: "bold" }}>
              {item.name}
            </span>
            <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
              <span
                style={{
                  fontSize: 18,
                  color: item.active ? "#28a745" : "#dc3545",
                }}
              >
                {item.active ? `残り ${item.count}` : "完売 (SOLD OUT)"}
              </span>
              <MockButton
                text={item.active ? "完売にする" : "再開する"}
                color={item.active ? "#dc3545" : "#28a745"}
                style={{ fontSize: 14, padding: "8px 16px" }}
              />
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
};
