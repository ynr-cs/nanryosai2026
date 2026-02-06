import {
  AbsoluteFill,
  useCurrentFrame,
  interpolate,
  spring,
  useVideoConfig,
} from "remotion";
import { Heart } from "lucide-react";

export const Chap6_Ending: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const opacity = interpolate(frame, [0, 30], [0, 1]);
  const scale = spring({ frame: frame - 30, fps, config: { damping: 10 } });

  return (
    <AbsoluteFill
      style={{
        backgroundColor: "#007bff",
        justifyContent: "center",
        alignItems: "center",
        color: "white",
      }}
    >
      <div style={{ opacity, textAlign: "center" }}>
        <h1 style={{ fontSize: 80, marginBottom: 40 }}>
          南陵祭2026
          <br />
          モバイルオーダー
        </h1>
        <p style={{ fontSize: 32 }}>みんなで最高の文化祭をつくりましょう！</p>

        <div style={{ marginTop: 60, transform: `scale(${scale})` }}>
          <Heart size={100} fill="white" color="white" />
        </div>

        <div style={{ marginTop: 80, fontSize: 24, opacity: 0.8 }}>
          マニュアルURL: https://nanryosai-2026.web.app/manual
        </div>
      </div>
    </AbsoluteFill>
  );
};
