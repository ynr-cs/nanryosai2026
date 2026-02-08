import React from "react";
import {
  AbsoluteFill,
  useCurrentFrame,
  interpolate,
  spring,
  useVideoConfig,
} from "remotion";
import "../../styles/global.css";

const SubTitle: React.FC<{
  text: string;
  delay: number;
  style?: React.CSSProperties;
}> = ({ text, delay, style }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const opacity = interpolate(frame, [delay, delay + 15], [0, 1], {
    extrapolateRight: "clamp",
  });

  const translateY = interpolate(frame, [delay, delay + 15], [20, 0], {
    extrapolateRight: "clamp",
  });

  return (
    <div
      style={{
        opacity,
        transform: `translateY(${translateY}px)`,
        fontFamily: "Noto Sans JP",
        fontWeight: "bold",
        fontSize: "60px",
        color: "#333",
        ...style,
      }}
    >
      {text}
    </div>
  );
};

export const Phase1History: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Scene 1: The Problem (0:00 - 0:13)
  // 13 seconds * 30fps = 390 frames
  const problemDuration = 13 * fps;

  // Scene 2: The Mission (0:14 - 0:38)
  // Starts at frame 390

  const isProblemScene = frame < problemDuration;

  // Noise effect for problem scene (simulated with opacity flicker)
  const noiseOpacity = Math.random() * 0.1;

  // Main Title Animation (Mission)
  const titleSpring = spring({
    frame: frame - problemDuration,
    fps,
    config: { damping: 200 },
  });

  const scale = interpolate(frame - problemDuration, [0, 30], [0.8, 1], {
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill style={{ backgroundColor: "white" }}>
      {isProblemScene ? (
        <AbsoluteFill
          style={{
            justifyContent: "center",
            alignItems: "center",
            filter: "grayscale(100%) contrast(1.2)",
            backgroundColor: "#e5e5e5",
          }}
        >
          <div
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              width: "100%",
              height: "100%",
              backgroundColor: `rgba(0,0,0,${noiseOpacity})`,
              pointerEvents: "none",
            }}
          />

          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "40px",
              alignItems: "center",
            }}
          >
            {/* Text appears sequentially */}
            <SubTitle text="混雑" delay={30} />
            <SubTitle text="行列" delay={90} />
            <SubTitle
              text="集計ミス"
              delay={150}
              style={{ color: "#d32f2f" }}
            />
          </div>
        </AbsoluteFill>
      ) : (
        <AbsoluteFill
          style={{
            justifyContent: "center",
            alignItems: "center",
            background: "var(--bg-color)",
          }}
        >
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: "30px",
              transform: `scale(${scale})`,
              opacity: interpolate(frame - problemDuration, [0, 20], [0, 1]),
            }}
          >
            <div
              style={{
                fontSize: "80px",
                fontWeight: 900,
                background: "var(--primary-gradient)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                textAlign: "center",
                lineHeight: 1.2,
              }}
            >
              南陵祭2026
              <br />
              モバイルオーダー
            </div>

            <div
              style={{
                fontSize: "40px",
                color: "var(--text-sub)",
                fontWeight: 700,
                letterSpacing: "0.2em",
                marginTop: "20px",
              }}
            >
              行列のない世界へ
            </div>
          </div>
        </AbsoluteFill>
      )}
    </AbsoluteFill>
  );
};
