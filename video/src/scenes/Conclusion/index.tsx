import React from "react";
import {
  AbsoluteFill,
  useCurrentFrame,
  useVideoConfig,
  Sequence,
  interpolate,
} from "remotion";
import "../../styles/global.css";

export const Conclusion: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  return (
    <AbsoluteFill style={{ background: "var(--bg-color)" }}>
      {/* 4:28 - 5:00 Summary (32s) */}
      <Sequence from={0} durationInFrames={32 * fps}>
        <AbsoluteFill
          style={{ justifyContent: "center", alignItems: "center" }}
        >
          <div
            style={{
              fontFamily: "Noto Sans JP",
              fontSize: "60px",
              fontWeight: "bold",
              color: "var(--primary-color)",
              textAlign: "center",
              lineHeight: 1.5,
            }}
          >
            導入のお願い
            <br />
            <span style={{ fontSize: "40px", color: "#666" }}>
              あなたのクラスも、未来へ
            </span>
          </div>
        </AbsoluteFill>
      </Sequence>

      {/* 5:01 - 5:25 Finale (24s) */}
      <Sequence from={32 * fps} durationInFrames={25 * fps}>
        <AbsoluteFill
          style={{
            justifyContent: "center",
            alignItems: "center",
            background: "black", // Fade to black finish
          }}
        >
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: "20px",
            }}
          >
            <div
              style={{
                fontFamily: "Noto Sans JP",
                fontSize: "80px",
                fontWeight: 900,
                color: "white",
                opacity: interpolate(frame - 32 * fps, [0, 60], [0, 1]),
              }}
            >
              南陵祭2026
            </div>
            <div
              style={{
                fontFamily: "Noto Sans JP",
                fontSize: "30px",
                color: "#aaa",
                opacity: interpolate(frame - 32 * fps, [30, 90], [0, 1]),
              }}
            >
              制作: コンピュータ科学部
            </div>
          </div>
        </AbsoluteFill>
      </Sequence>
    </AbsoluteFill>
  );
};
