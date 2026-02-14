import React from "react";
import {
  AbsoluteFill,
  useCurrentFrame,
  useVideoConfig,
  Sequence,
  interpolate,
  spring,
} from "remotion";
import "../../styles/global.css";

const ImpactWord: React.FC<{
  text: string;
  delay: number;
  x: number;
  y: number;
  color: string;
}> = ({ text, delay, x, y, color }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const opacity = interpolate(frame - delay, [0, 10, 40, 50], [0, 1, 1, 0], {
    extrapolateRight: "clamp",
  });

  const scale = interpolate(frame - delay, [0, 10], [2, 1], {
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
        fontFamily: "var(--font-main)",
        fontWeight: 900,
        fontSize: "100px",
        color: color,
        textShadow: `0 0 20px ${color}`,
      }}
    >
      {text}
    </div>
  );
};

export const Phase4Closing: React.FC = () => {
  const { fps, width, height } = useVideoConfig();
  const frame = useCurrentFrame();

  return (
    <AbsoluteFill style={{ background: "black" }}>
      {/* 4-1. Impact (4:27 - 4:40) [13s] */}
      <Sequence from={0} durationInFrames={13 * fps}>
        <AbsoluteFill>
          <ImpactWord
            text="NO QUEUE"
            delay={10}
            x={width * 0.3}
            y={height * 0.3}
            color="var(--primary-color)"
          />
          <ImpactWord
            text="NO STRESS"
            delay={40}
            x={width * 0.7}
            y={height * 0.7}
            color="#5856D6"
          />
          <ImpactWord
            text="JUST FUN"
            delay={70}
            x={width * 0.5}
            y={height * 0.5}
            color="var(--accent-color)"
          />
        </AbsoluteFill>
      </Sequence>

      {/* 4-2. Efficiency (4:40 - 4:55) [15s] */}
      <Sequence from={13 * fps} durationInFrames={15 * fps}>
        <AbsoluteFill
          style={{
            justifyContent: "center",
            alignItems: "center",
            background: "white",
          }}
        >
          <div
            style={{
              fontSize: 60,
              fontFamily: "var(--font-main)",
              fontWeight: "bold",
              color: "#333",
              textAlign: "center",
            }}
          >
            すべての来場者に
            <br />
            <span style={{ fontSize: 100, color: "var(--accent-color)" }}>
              笑顔
            </span>
            を。
          </div>
        </AbsoluteFill>
      </Sequence>

      {/* 4-3. CTA (4:55 - 5:01) [6s] */}
      <Sequence from={28 * fps} durationInFrames={6 * fps}>
        <AbsoluteFill
          style={{
            justifyContent: "center",
            alignItems: "center",
            background: "#f3f4f6",
          }}
        >
          <div
            style={{
              fontSize: 40,
              fontFamily: "var(--font-main)",
              fontWeight: "bold",
              color: "#555",
            }}
          >
            導入をご検討ください
          </div>
          <div
            style={{
              marginTop: 40,
              fontSize: 80,
              fontWeight: 900,
              color: "var(--primary-color)",
            }}
          >
            JOIN OUR VISION
          </div>
        </AbsoluteFill>
      </Sequence>

      {/* 4-4. Climax (5:01 - 5:22) [21s] */}
      <Sequence from={34 * fps} durationInFrames={21 * fps}>
        <AbsoluteFill
          style={{
            justifyContent: "center",
            alignItems: "center",
            background: "black",
          }}
        >
          {/* Light burst effect */}
          <div
            style={{
              position: "absolute",
              width: "100%",
              height: "100%",
              background:
                "radial-gradient(circle, rgba(0,122,255,0.3) 0%, rgba(0,0,0,1) 70%)",
              opacity: interpolate(frame - 34 * fps, [0, 100, 200], [0, 1, 0]),
            }}
          />

          <div
            style={{
              color: "white",
              fontFamily: "var(--font-main)",
              fontWeight: "bold",
              textAlign: "center",
              zIndex: 10,
            }}
          >
            <div style={{ fontSize: 40, marginBottom: 20 }}>
              南陵祭の未来のために
            </div>
            <div
              style={{
                fontSize: 80,
                background: "var(--primary-gradient)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
              }}
            >
              歩みを止めない。
            </div>
          </div>
        </AbsoluteFill>
      </Sequence>

      {/* 4-5. Credit (5:22 - 5:25) [3s] */}
      <Sequence from={55 * fps} durationInFrames={3 * fps}>
        <AbsoluteFill
          style={{
            justifyContent: "center",
            alignItems: "center",
            background: "black",
          }}
        >
          <div
            style={{
              color: "white",
              fontFamily: "var(--font-main)",
              fontSize: 24,
              opacity: 0.7,
            }}
          >
            制作: コンピュータ科学部
          </div>
          <div
            style={{
              color: "white",
              fontFamily: "var(--font-main)",
              fontSize: 40,
              fontWeight: "bold",
              marginTop: 20,
            }}
          >
            Nanryosai 2026 Mobile Order
          </div>
        </AbsoluteFill>
      </Sequence>
    </AbsoluteFill>
  );
};
