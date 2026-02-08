import React from "react";
import {
  AbsoluteFill,
  useCurrentFrame,
  interpolate,
  useVideoConfig,
  spring,
} from "remotion";
import { Smartphone, Server, Store, ShieldCheck } from "lucide-react";
import "../../styles/global.css";

const IconBox: React.FC<{
  icon: React.ReactNode;
  label: string;
  x: number;
  y: number;
  delay: number;
  color: string;
}> = ({ icon, label, x, y, delay, color }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const scale = spring({
    frame: frame - delay,
    fps,
    config: { damping: 100 },
  });

  const opacity = interpolate(frame - delay, [0, 10], [0, 1], {
    extrapolateRight: "clamp",
  });

  return (
    <div
      style={{
        position: "absolute",
        left: x,
        top: y,
        transform: `translate(-50%, -50%) scale(${scale})`,
        opacity,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: "16px",
      }}
    >
      <div
        style={{
          background: "white",
          borderRadius: "50%",
          padding: "40px",
          boxShadow: `0 10px 30px ${color}40`,
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          border: `4px solid ${color}`,
        }}
      >
        {icon}
      </div>
      <div
        style={{
          fontFamily: "Noto Sans JP",
          fontWeight: "bold",
          fontSize: "32px",
          color: "#333",
          background: "white",
          padding: "8px 24px",
          borderRadius: "20px",
          boxShadow: "0 4px 10px rgba(0,0,0,0.1)",
        }}
      >
        {label}
      </div>
    </div>
  );
};

const ConnectionLine: React.FC<{
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  delay: number;
  color: string;
}> = ({ x1, y1, x2, y2, delay, color }) => {
  const frame = useCurrentFrame();
  const progress = interpolate(frame - delay, [0, 30], [0, 1], {
    extrapolateRight: "clamp",
  });

  // Calculate length and angle
  const length = Math.sqrt(Math.pow(x2 - x1, 2) + Math.pow(y2 - y1, 2));
  const angle = (Math.atan2(y2 - y1, x2 - x1) * 180) / Math.PI;

  return (
    <div
      style={{
        position: "absolute",
        left: x1,
        top: y1,
        width: length * progress,
        height: "6px",
        background: color,
        transformOrigin: "0 50%",
        transform: `rotate(${angle}deg)`,
        borderRadius: "4px",
        opacity: progress > 0 ? 0.5 : 0,
        zIndex: -1,
      }}
    />
  );
};

export const Phase2WholePicture: React.FC = () => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();

  return (
    <AbsoluteFill style={{ background: "var(--bg-color)" }}>
      <AbsoluteFill style={{ justifyContent: "center", alignItems: "center" }}>
        {/* Title */}
        <div
          style={{
            position: "absolute",
            top: "100px",
            width: "100%",
            textAlign: "center",
            fontFamily: "Noto Sans JP",
            fontWeight: 900,
            fontSize: "70px",
            color: "#333",
          }}
        >
          全校規模の、同期システム
        </div>

        {/* Main Architecture Diagram */}
        {/* Guest (Left) */}
        <IconBox
          icon={<Smartphone size={80} color="#6a11cb" />}
          label="Guest (Orion)"
          x={width * 0.2}
          y={height * 0.6}
          delay={10}
          color="#6a11cb"
        />

        {/* Server (Center Top) */}
        <IconBox
          icon={<Server size={80} color="#ff0080" />}
          label="Core System (SLS)"
          x={width * 0.5}
          y={height * 0.4}
          delay={40}
          color="#ff0080"
        />

        {/* Store (Right) */}
        <IconBox
          icon={<Store size={80} color="#2575fc" />}
          label="Store (Gateway)"
          x={width * 0.8}
          y={height * 0.6}
          delay={70}
          color="#2575fc"
        />

        {/* Connections */}
        <ConnectionLine
          x1={width * 0.2}
          y1={height * 0.6}
          x2={width * 0.5}
          y2={height * 0.4}
          delay={50}
          color="#6a11cb"
        />
        <ConnectionLine
          x1={width * 0.5}
          y1={height * 0.4}
          x2={width * 0.8}
          y2={height * 0.6}
          delay={80}
          color="#2575fc"
        />

        {/* Security Shield appearing on Server */}
        <div
          style={{
            position: "absolute",
            left: width * 0.5,
            top: height * 0.4 - 120,
            transform: "translateX(-50%)",
            opacity: interpolate(frame, [100, 120], [0, 1]),
          }}
        >
          <div
            style={{
              background: "#10b981",
              color: "white",
              padding: "10px 20px",
              borderRadius: "20px",
              display: "flex",
              alignItems: "center",
              gap: "8px",
              fontWeight: "bold",
              boxShadow: "0 4px 10px rgba(0,0,0,0.2)",
            }}
          >
            <ShieldCheck size={24} />
            <div>Secure & Realtime</div>
          </div>
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
