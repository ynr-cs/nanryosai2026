import { AbsoluteFill, useCurrentFrame, interpolate } from "remotion";
import { MockDashboard } from "../../Shared/UIComponents/MockDashboard";
import { MousePointer2 } from "lucide-react";

export const Chap4_Features: React.FC = () => {
  const frame = useCurrentFrame();

  // Timeline
  // 0-30: Fade In
  // 30-90: Stats Highlight
  // 90-150: Inventory Interaction (Mouse Move -> Click)

  const opacity = interpolate(frame, [0, 30], [0, 1]);

  // Mouse animation
  const mouseX = interpolate(frame, [90, 120], [800, 700], {
    extrapolateRight: "clamp",
  });
  const mouseY = interpolate(frame, [90, 120], [600, 480], {
    extrapolateRight: "clamp",
  });
  const clickScale = interpolate(frame, [120, 125, 130], [1, 0.8, 1], {
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill
      style={{
        backgroundColor: "#e9ecef",
        justifyContent: "center",
        alignItems: "center",
      }}
    >
      <h1>Chapter 4: 便利機能</h1>
      <p style={{ marginBottom: 40, color: "#666" }}>
        在庫管理・売上分析もリアルタイム
      </p>

      <div style={{ opacity, transform: "scale(1.2)" }}>
        <MockDashboard />
      </div>

      {/* Simulated Cursor */}
      {frame > 90 && (
        <div
          style={{
            position: "absolute",
            left: mouseX,
            top: mouseY,
            transform: `scale(${clickScale})`,
          }}
        >
          <MousePointer2 fill="black" size={48} />
        </div>
      )}

      <div
        style={{
          position: "absolute",
          bottom: 100,
          fontSize: 28,
          color: "#333",
          backgroundColor: "white",
          padding: "20px 40px",
          borderRadius: 50,
          boxShadow: "0 4px 10px rgba(0,0,0,0.1)",
        }}
      >
        {frame < 90
          ? "売上や注文数は自動で集計されます"
          : "完売ボタン一つで、お客様の注文を即座に停止できます"}
      </div>
    </AbsoluteFill>
  );
};
