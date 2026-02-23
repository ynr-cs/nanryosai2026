import React from "react";
import {
  AbsoluteFill,
  useCurrentFrame,
  interpolate,
  useVideoConfig,
  Sequence,
  Img,
  staticFile,
} from "remotion";
import { User, ArrowRight, FileText } from "lucide-react";
import "../../styles/global.css";

const TitleText: React.FC<{
  text: string;
  y: number;
  opacity: number;
  scale?: number;
}> = ({ text, y, opacity, scale = 1 }) => (
  <div
    style={{
      position: "absolute",
      top: y,
      left: "50%",
      transform: `translateX(-50%) scale(${scale})`,
      fontFamily: "var(--font-main)",
      fontWeight: 900,
      fontSize: "80px",
      color: "white",
      opacity,
      whiteSpace: "nowrap",
      textAlign: "center",
    }}
  >
    {text}
  </div>
);

export const Phase1History: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // 0:00 - 0:17 : The 2025 Era
  const scene1Duration = 17 * fps;

  // 0:17 - 0:38 : The 2026 Revolution
  const scene2Start = 17 * fps;

  return (
    <AbsoluteFill style={{ backgroundColor: "black" }}>
      {/* 2025 Sequence */}
      <Sequence durationInFrames={scene1Duration}>
        <AbsoluteFill>
          {/* "2025" Text (0-6s) */}
          <Sequence durationInFrames={6 * fps}>
            <AbsoluteFill
              style={{ justifyContent: "center", alignItems: "center" }}
            >
              <TitleText
                text="2025"
                y={500}
                opacity={interpolate(frame, [30, 120, 150, 180], [0, 1, 1, 0])}
              />
            </AbsoluteFill>
          </Sequence>

          {/* Website Simple Display (6-12s) */}
          <Sequence from={6 * fps} durationInFrames={6 * fps}>
            <AbsoluteFill
              style={{ justifyContent: "center", alignItems: "center" }}
            >
              <Img
                src={staticFile("2025_website.png")}
                style={{
                  width: "70%",
                  borderRadius: "10px",
                  boxShadow: "0 10px 40px rgba(0,0,0,0.6)",
                  opacity: interpolate(frame - 6 * fps, [0, 12], [0, 1]),
                }}
              />
            </AbsoluteFill>
          </Sequence>

          {/* Paper -> Web Transition (12-17s) */}
          <Sequence from={12 * fps}>
            <AbsoluteFill
              style={{
                justifyContent: "center",
                alignItems: "center",
                backgroundColor: "#0a0a0a",
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "60px",
                  width: "100%",
                  opacity: interpolate(frame - 12 * fps, [0, 10], [0, 1]),
                }}
              >
                {/* Paper Icon */}
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
                      width: "160px",
                      height: "220px",
                      background: "#fff",
                      borderRadius: "5px",
                      display: "flex",
                      justifyContent: "center",
                      alignItems: "center",
                      boxShadow: "0 5px 15px rgba(255,255,255,0.1)",
                    }}
                  >
                    <FileText size={90} color="#333" />
                  </div>
                  <span
                    style={{
                      color: "white",
                      fontSize: "24px",
                      fontFamily: "var(--font-main)",
                      fontWeight: "bold",
                    }}
                  >
                    紙のパンフレット
                  </span>
                </div>

                {/* Arrow (Static/Stable) */}
                <div
                  style={{
                    opacity: interpolate(frame - 12 * fps, [10, 20], [0, 1]),
                  }}
                >
                  <ArrowRight size={80} color="var(--primary-color)" />
                </div>

                {/* Web Image */}
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    gap: "20px",
                    opacity: interpolate(frame - 12 * fps, [25, 40], [0, 1]),
                    transform: `scale(${interpolate(frame - 12 * fps, [25, 40], [0.9, 1], { extrapolateRight: "clamp" })})`,
                  }}
                >
                  <Img
                    src={staticFile("2025_website.png")}
                    style={{
                      width: "320px",
                      borderRadius: "8px",
                      boxShadow: "0 10px 30px rgba(0,0,0,0.5)",
                    }}
                  />
                  <span
                    style={{
                      color: "white",
                      fontSize: "24px",
                      fontFamily: "var(--font-main)",
                      fontWeight: "bold",
                    }}
                  >
                    ウェブサイト
                  </span>
                </div>
              </div>
            </AbsoluteFill>
          </Sequence>
        </AbsoluteFill>
      </Sequence>

      {/* 2026 Sequence */}
      <Sequence from={scene2Start}>
        <AbsoluteFill style={{ backgroundColor: "black" }}>
          {/* Image Relay Animation (20s - 26s) -> 3s after scene2Start */}
          {/* Render this before Text to keep images in background while opaque */}
          <Sequence from={3 * fps} durationInFrames={6 * fps}>
            <AbsoluteFill>
              {[
                { src: "mock_portal.png" },
                { src: "mock_monitor.png" },
                { src: "mock_training.png" },
                { src: "mock_status.png" },
                { src: "mock_presenter.png" },
              ].map((img, i) => {
                const displayFrames = 24; // 0.8s per image
                const start = i * displayFrames;
                const end = (i + 1) * displayFrames;
                const relativeFrame = frame - scene2Start - 3 * fps;

                // Sharp cut logic
                const isVisible = relativeFrame >= start && relativeFrame < end;

                // Zoom effect: scale from 1.0 to 1.1 during its own duration
                const scale = interpolate(
                  relativeFrame,
                  [start, end],
                  [1, 1.1],
                  { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
                );

                return (
                  <Img
                    key={i}
                    src={staticFile(img.src)}
                    style={{
                      position: "absolute",
                      width: "100%",
                      height: "100%",
                      objectFit: "cover",
                      opacity: isVisible ? 1 : 0, // Fully opaque when visible
                      transform: `scale(${scale})`,
                      transition: "none",
                    }}
                  />
                );
              })}
            </AbsoluteFill>
          </Sequence>

          {/* Dark overlay on top of images, behind text */}
          <Sequence from={3 * fps} durationInFrames={6 * fps}>
            <AbsoluteFill
              style={{
                backgroundColor: "rgba(0, 0, 0, 0.5)",
              }}
            />
          </Sequence>

          {/* Logo & Text (17s - 38s) */}
          <AbsoluteFill
            style={{ justifyContent: "center", alignItems: "center" }}
          >
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: "20px",
                transform: "translateY(-60px)",
              }}
            >
              <div
                style={{
                  fontFamily: "var(--font-main)",
                  fontWeight: 900,
                  fontSize: "200px",
                  background: "var(--primary-gradient)",
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                  // Fade out before NEXT DIMENSION (30s mark = 13s from scene2Start)
                  opacity: interpolate(
                    frame - scene2Start,
                    [0, 20, 12 * fps, 13 * fps],
                    [0, 1, 1, 0],
                  ),
                  zIndex: 10,
                  textShadow: "0 10px 30px rgba(0,0,0,0.5)",
                }}
              >
                2026
              </div>
              <div
                style={{
                  fontFamily: "var(--font-main)",
                  fontWeight: 700,
                  fontSize: "60px",
                  color: "white",
                  letterSpacing: "0.2em",
                  // Fade out before NEXT DIMENSION
                  opacity: interpolate(
                    frame - scene2Start,
                    [15, 35, 12 * fps, 13 * fps],
                    [0, 1, 1, 0],
                  ),
                  zIndex: 10,
                  textShadow: "0 5px 15px rgba(0,0,0,0.5)",
                }}
              >
                モバイルオーダー
              </div>
            </div>
          </AbsoluteFill>

          {/* Queue Animation (24s - 28s) */}
          <Sequence from={7 * fps} durationInFrames={4 * fps}>
            <AbsoluteFill
              style={{ justifyContent: "center", alignItems: "center" }}
            >
              <div
                style={{
                  display: "flex",
                  gap: "15px",
                  position: "absolute",
                  bottom: "180px",
                  opacity: interpolate(
                    frame - scene2Start - 7 * fps,
                    [0, 5, 20, 30],
                    [0, 1, 1, 0],
                  ),
                  zIndex: 10,
                }}
              >
                {Array.from({ length: 15 }).map((_, i) => (
                  <div
                    key={i}
                    style={{
                      opacity: interpolate(
                        frame - scene2Start - 7 * fps,
                        [20, 30],
                        [1, 0],
                      ),
                      transform: `scale(${interpolate(frame - scene2Start - 7 * fps, [20, 30], [1, 1.5], { extrapolateRight: "clamp" })})`,
                      filter: `blur(${interpolate(frame - scene2Start - 7 * fps, [20, 30], [0, 10])}px)`,
                    }}
                  >
                    <User size={50} color="white" />
                  </div>
                ))}
              </div>
            </AbsoluteFill>
          </Sequence>

          {/* Title Display at the end (30-38s) */}
          <Sequence from={13 * fps}>
            <AbsoluteFill
              style={{ justifyContent: "center", alignItems: "center" }}
            >
              <div
                style={{
                  textAlign: "center",
                  opacity: interpolate(
                    frame - scene2Start - 13 * fps,
                    [0, 20],
                    [0, 1],
                  ),
                }}
              >
                <div
                  style={{
                    fontSize: "40px",
                    color: "var(--text-sub)",
                    marginBottom: "20px",
                    letterSpacing: "0.1em",
                  }}
                >
                  革命の始まり
                </div>
                <div
                  style={{
                    fontSize: "100px",
                    fontWeight: 900,
                    color: "white",
                    textShadow: "0 0 30px rgba(255,255,255,0.4)",
                  }}
                >
                  NEXT DIMENSION
                </div>
              </div>
            </AbsoluteFill>
          </Sequence>
        </AbsoluteFill>
      </Sequence>
    </AbsoluteFill>
  );
};
