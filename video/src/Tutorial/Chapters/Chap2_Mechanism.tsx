import { AbsoluteFill, useCurrentFrame, interpolate } from "remotion";
import { Server, Smartphone, Monitor } from "lucide-react";

const DataPacket: React.FC<{
  progress: number;
  fromX: number;
  toX: number;
  y: number;
  color: string;
}> = ({ progress, fromX, toX, y, color }) => {
  const x = interpolate(progress, [0, 1], [fromX, toX], {
    extrapolateRight: "clamp",
  });
  const opacity = interpolate(progress, [0, 0.1, 0.9, 1], [0, 1, 1, 0]);

  return (
    <div
      style={{
        position: "absolute",
        left: x,
        top: y,
        width: 20,
        height: 20,
        borderRadius: "50%",
        backgroundColor: color,
        opacity,
        boxShadow: `0 0 10px ${color}`,
        transform: `translate(-50%, -50%)`,
      }}
    />
  );
};

export const Chap2_Mechanism: React.FC = () => {
  const frame = useCurrentFrame();

  const opacity = interpolate(frame, [0, 30], [0, 1]);

  // Animation phases
  // 0-60: Fade in
  // 60-120: Order (Phone -> Server)
  // 120-180: Sync (Server -> POS)
  // 180-240: Complete (POS -> Server)

  const orderProgress = interpolate(frame, [60, 120], [0, 1], {
    extrapolateRight: "clamp",
  });
  const syncProgress = interpolate(frame, [120, 180], [0, 1], {
    extrapolateRight: "clamp",
  });
  const completeProgress = interpolate(frame, [180, 240], [0, 1], {
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill
      style={{
        backgroundColor: "white",
        justifyContent: "center",
        alignItems: "center",
        opacity,
      }}
    >
      <h1 style={{ marginBottom: 80 }}>Chapter 2: システムの仕組み</h1>

      <div
        style={{
          position: "relative",
          width: 1200,
          height: 400,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        {/* Devices */}
        <div style={{ textAlign: "center", zIndex: 10 }}>
          <Smartphone size={120} color="#333" />
          <p style={{ fontSize: 32, fontWeight: "bold" }}>来場者スマホ</p>
          <p style={{ color: "#666" }}>注文送信</p>
        </div>

        <div style={{ textAlign: "center", zIndex: 10 }}>
          <Server size={120} color="#007bff" />
          <p style={{ fontSize: 32, fontWeight: "bold", color: "#007bff" }}>
            Firebase
          </p>
          <p style={{ color: "#666" }}>リアルタイム同期</p>
        </div>

        <div style={{ textAlign: "center", zIndex: 10 }}>
          <Monitor size={120} color="#333" />
          <p style={{ fontSize: 32, fontWeight: "bold" }}>店舗端末 (POS)</p>
          <p style={{ color: "#666" }}>受注・呼出</p>
        </div>

        {/* Packets */}
        <DataPacket
          progress={orderProgress}
          fromX={100}
          toX={600}
          y={200}
          color="#ff0000"
        />
        <DataPacket
          progress={syncProgress}
          fromX={600}
          toX={1100}
          y={200}
          color="#007bff"
        />
        <DataPacket
          progress={completeProgress}
          fromX={1100}
          toX={600}
          y={200}
          color="#28a745"
        />

        {/* Connection Lines (Static for now, could be animated) */}
        <div
          style={{
            position: "absolute",
            top: 198,
            left: 100,
            width: 1000,
            height: 4,
            backgroundColor: "#eee",
            zIndex: 0,
          }}
        />
      </div>

      <div style={{ marginTop: 50, fontSize: 24, color: "#555" }}>
        {frame > 60 && frame < 120 && <p>1. お客様がスマホで注文</p>}
        {frame > 120 && frame < 180 && <p>2. 注文が即座に店舗へ届く</p>}
        {frame > 180 && <p>3. 調理完了・呼出もワンタップで同期</p>}
      </div>
    </AbsoluteFill>
  );
};
