import { AbsoluteFill, useCurrentFrame, interpolate } from "remotion";
import { WifiOff, AlertTriangle, RefreshCcw } from "lucide-react";

export const Chap5_Trouble: React.FC = () => {
  const frame = useCurrentFrame();
  const opacity = interpolate(frame, [0, 30], [0, 1]);

  return (
    <AbsoluteFill
      style={{
        backgroundColor: "#fff0f0",
        justifyContent: "center",
        alignItems: "center",
      }}
    >
      <h1>Chapter 5: トラブルシューティング</h1>

      <div style={{ display: "flex", gap: 60, marginTop: 40, opacity }}>
        <div
          style={{
            textAlign: "center",
            width: 300,
            backgroundColor: "white",
            padding: 30,
            borderRadius: 16,
            boxShadow: "0 4px 10px rgba(0,0,0,0.1)",
          }}
        >
          <WifiOff size={80} color="#dc3545" />
          <h3>通信エラー!?</h3>
          <p style={{ color: "#666" }}>
            慌てずにリロードボタンを押してください。
          </p>
        </div>

        <div
          style={{
            textAlign: "center",
            width: 300,
            backgroundColor: "white",
            padding: 30,
            borderRadius: 16,
            boxShadow: "0 4px 10px rgba(0,0,0,0.1)",
          }}
        >
          <AlertTriangle size={80} color="#feca57" />
          <h3>操作ミス!?</h3>
          <p style={{ color: "#666" }}>
            間違って調理完了にしても、管理画面から戻せます。
          </p>
        </div>
      </div>

      <div style={{ marginTop: 60 }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 20,
            backgroundColor: "white",
            padding: "10px 30px",
            borderRadius: 30,
          }}
        >
          <RefreshCcw size={32} color="#007bff" />
          <span style={{ fontSize: 24, fontWeight: "bold" }}>
            困ったらまずはリロード！
          </span>
        </div>
      </div>
    </AbsoluteFill>
  );
};
