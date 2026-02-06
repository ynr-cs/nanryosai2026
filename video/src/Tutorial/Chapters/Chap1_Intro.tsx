import {
  AbsoluteFill,
  useCurrentFrame,
  interpolate,
  spring,
  useVideoConfig,
} from "remotion";
import { FolderOpen } from "lucide-react";

export const Chap1_Intro: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const opacity = interpolate(frame, [0, 30], [0, 1], {
    extrapolateRight: "clamp",
  });

  const scale = spring({
    frame,
    fps,
    from: 0.5,
    to: 1,
    config: {
      damping: 12,
    },
  });

  return (
    <AbsoluteFill
      style={{
        justifyContent: "center",
        alignItems: "center",
        backgroundColor: "#f9f9f9",
        fontFamily: "sans-serif",
      }}
    >
      <div
        style={{ opacity, transform: `scale(${scale})`, textAlign: "center" }}
      >
        <div
          style={{
            display: "inline-flex",
            padding: 40,
            backgroundColor: "white",
            borderRadius: "50%",
            boxShadow: "0 10px 30px rgba(0,0,0,0.1)",
            marginBottom: 40,
          }}
        >
          <FolderOpen size={120} color="#007bff" />
        </div>

        <h1
          style={{
            fontSize: 80,
            margin: "0 0 20px 0",
            background: "linear-gradient(45deg, #007bff, #00bdd6)",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
          }}
        >
          モバイルオーダー
          <br />
          運用マニュアル
        </h1>

        <p
          style={{
            fontSize: 36,
            color: "#666",
            marginTop: 20,
            letterSpacing: "0.1em",
          }}
        >
          南陵祭2026 DXプロジェクト
        </p>

        <div
          style={{
            marginTop: 60,
            padding: "10px 30px",
            background: "#eee",
            borderRadius: 30,
            display: "inline-block",
            fontSize: 24,
            color: "#555",
          }}
        >
          Chapter 1: イントロダクション
        </div>
      </div>
    </AbsoluteFill>
  );
};
