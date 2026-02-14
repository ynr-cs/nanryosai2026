import React from "react";
import {
  AbsoluteFill,
  useCurrentFrame,
  interpolate,
  useVideoConfig,
  spring,
  Sequence,
} from "remotion";
import {
  Smartphone,
  Server,
  Store,
  ShieldCheck,
  Database,
  Lock,
} from "lucide-react";
import "../../styles/global.css";
import { MockPhone } from "../../components/Mock/Phone";
import { MockTablet } from "../../components/Mock/Tablet";

const IconElement: React.FC<{
  icon: React.ReactNode;
  label: string;
  x: number;
  y: number;
  delay: number;
  scale: number;
  opacity: number;
  color: string;
}> = ({ icon, label, x, y, delay, scale, opacity, color }) => {
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
          fontFamily: "var(--font-main)",
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

export const Phase2ThreeElements: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();

  // Timings (offsets from start of phase)
  const showIconsStart = 0;
  const focusGuestStart = 7 * fps;
  const focusStoreStart = 14 * fps;
  const focusDbStart = 20 * fps;
  const integrationStart = 34 * fps;

  // Animation values
  const guestScale = spring({
    frame: frame - showIconsStart - 10,
    fps,
    config: { damping: 100 },
  });

  // Focus logic: Zoom into specific elements
  const isGuestFocus = frame >= focusGuestStart && frame < focusStoreStart;
  const isStoreFocus = frame >= focusStoreStart && frame < focusDbStart;
  const isDbFocus = frame >= focusDbStart && frame < integrationStart;

  // Camera transform for focus
  const cameraX = interpolate(
    frame,
    [
      focusGuestStart,
      focusGuestStart + 20,
      focusStoreStart,
      focusStoreStart + 20,
      focusDbStart,
      focusDbStart + 20,
      integrationStart,
      integrationStart + 20,
    ],
    [0, width * 0.3, width * 0.3, -width * 0.3, -width * 0.3, 0, 0, 0],
    { extrapolateRight: "clamp" },
  );

  const cameraY = interpolate(
    frame,
    [
      focusGuestStart,
      focusGuestStart + 20,
      focusStoreStart,
      focusStoreStart + 20,
      focusDbStart,
      focusDbStart + 20,
      integrationStart,
      integrationStart + 20,
    ],
    [0, 0, 0, 0, 0, height * 0.1, height * 0.1, 0],
    { extrapolateRight: "clamp" },
  );

  const zoom = interpolate(
    frame,
    [
      focusGuestStart,
      focusGuestStart + 20,
      integrationStart,
      integrationStart + 20,
    ],
    [1, 1.5, 1.5, 1],
    { extrapolateRight: "clamp" },
  );

  return (
    <AbsoluteFill style={{ background: "var(--bg-color)", overflow: "hidden" }}>
      <div
        style={{
          position: "absolute",
          width: "100%",
          height: "100%",
          transform: `translate(${cameraX}px, ${cameraY}px) scale(${zoom})`,
          transformOrigin: "center center",
          transition: "transform 0.5s ease-out", // Smoother layout transition if needed, but remotion prefers interpolate
        }}
      >
        {/* Title */}
        <div
          style={{
            position: "absolute",
            top: 100,
            width: "100%",
            textAlign: "center",
            fontFamily: "var(--font-main)",
            fontSize: "60px",
            fontWeight: "bold",
            opacity: interpolate(frame, [0, 20], [0, 1], {
              extrapolateRight: "clamp",
            }),
          }}
        >
          3つの構成要素
        </div>

        {/* Guest Element */}
        <IconElement
          icon={<Smartphone size={80} color="var(--primary-color)" />}
          label="Guest"
          x={width * 0.2}
          y={height * 0.6}
          delay={0}
          scale={guestScale}
          opacity={1}
          color="var(--primary-color)"
        />
        {isGuestFocus && (
          <AbsoluteFill
            style={{
              left: width * 0.2 - 187,
              top: height * 0.6 + 100,
              width: 375,
              height: 812,
              transform: "scale(0.5)",
            }}
          >
            <MockPhone>
              <div style={{ padding: 20, textAlign: "center" }}>
                <h3>Mobile Order</h3>
                <p>Menu...</p>
              </div>
            </MockPhone>
          </AbsoluteFill>
        )}

        {/* Store Element */}
        <IconElement
          icon={<Store size={80} color="#5856D6" />}
          label="Store"
          x={width * 0.8}
          y={height * 0.6}
          delay={10}
          scale={spring({ frame: frame - 10, fps })}
          opacity={1}
          color="#5856D6"
        />
        {isStoreFocus && (
          <AbsoluteFill
            style={{
              left: width * 0.8 - 400,
              top: height * 0.6 + 100,
              transform: "scale(0.5)",
            }}
          >
            <MockTablet orientation="landscape">
              <div style={{ padding: 20, textAlign: "center" }}>
                <h3>Kitchen Display</h3>
                <p>Orders...</p>
              </div>
            </MockTablet>
          </AbsoluteFill>
        )}

        {/* Database Element */}
        <IconElement
          icon={<Database size={80} color="var(--accent-color)" />}
          label="Database"
          x={width * 0.5}
          y={height * 0.3}
          delay={20}
          scale={spring({ frame: frame - 20, fps })}
          opacity={1}
          color="var(--accent-color)"
        />
        {isDbFocus && (
          <div
            style={{
              position: "absolute",
              left: width * 0.5,
              top: height * 0.3 + 120,
              transform: "translateX(-50%)",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 10,
            }}
          >
            <div
              style={{
                display: "flex",
                gap: 10,
                color: "var(--success-color)",
                fontWeight: "bold",
                fontSize: 24,
                background: "white",
                padding: "10px 20px",
                borderRadius: 20,
              }}
            >
              <ShieldCheck /> Secure
            </div>
            <div
              style={{
                display: "flex",
                gap: 10,
                color: "var(--accent-color)",
                fontWeight: "bold",
                fontSize: 24,
                background: "white",
                padding: "10px 20px",
                borderRadius: 20,
              }}
            >
              <Lock /> Encrypted
            </div>
          </div>
        )}

        {/* Connection Lines (Integration) */}
        {frame >= integrationStart && (
          <svg
            style={{
              position: "absolute",
              width: "100%",
              height: "100%",
              zIndex: -1,
            }}
          >
            <line
              x1={width * 0.2}
              y1={height * 0.6}
              x2={width * 0.5}
              y2={height * 0.3}
              stroke="var(--primary-color)"
              strokeWidth="4"
              strokeDasharray="10"
            />
            <line
              x1={width * 0.8}
              y1={height * 0.6}
              x2={width * 0.5}
              y2={height * 0.3}
              stroke="#5856D6"
              strokeWidth="4"
              strokeDasharray="10"
            />
          </svg>
        )}
      </div>
    </AbsoluteFill>
  );
};
