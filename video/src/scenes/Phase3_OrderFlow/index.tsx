import React from "react";
import {
  AbsoluteFill,
  useCurrentFrame,
  useVideoConfig,
  Sequence,
  interpolate,
  spring,
} from "remotion";
import { MockButton } from "../../components/Mock/Button";
import { MockOrderCard } from "../../components/Mock/OrderCard";
import { Smartphone, Check } from "lucide-react";
import "../../styles/global.css";

const PhoneFrame: React.FC<{
  children: React.ReactNode;
  style?: React.CSSProperties;
}> = ({ children, style }) => {
  return (
    <div
      style={{
        width: "375px",
        height: "812px",
        background: "white",
        borderRadius: "40px",
        border: "12px solid #333",
        overflow: "hidden",
        position: "relative",
        boxShadow: "0 20px 50px rgba(0,0,0,0.3)",
        ...style,
      }}
    >
      {/* Notch */}
      <div
        style={{
          position: "absolute",
          top: 0,
          left: "50%",
          transform: "translateX(-50%)",
          width: "150px",
          height: "30px",
          background: "#333",
          borderBottomLeftRadius: "20px",
          borderBottomRightRadius: "20px",
          zIndex: 10,
        }}
      />
      {children}
    </div>
  );
};

const LaunchButton: React.FC<{ onClick?: () => void }> = () => {
  const frame = useCurrentFrame();

  // Pulse animation
  const scale = 1 + Math.sin(frame / 10) * 0.05;

  return (
    <div style={{ transform: `scale(${scale})` }}>
      <MockButton text="注文を確定する" />
    </div>
  );
};

export const Phase3OrderFlow: React.FC = () => {
  const { fps } = useVideoConfig();

  return (
    <AbsoluteFill style={{ background: "var(--bg-color)" }}>
      {/* 3-1. Launch (1:20 - 1:37) [17s] */}
      <Sequence from={0} durationInFrames={17 * fps}>
        <AbsoluteFill
          style={{ justifyContent: "center", alignItems: "center" }}
        >
          <div
            style={{
              fontFamily: "Noto Sans JP",
              fontSize: "50px",
              fontWeight: "bold",
              marginBottom: "40px",
            }}
          >
            準備は整った
          </div>
          <PhoneFrame>
            <div
              style={{
                height: "100%",
                display: "flex",
                justifyContent: "center",
                alignItems: "center",
                background: "#f9fafb",
              }}
            >
              <LaunchButton />
            </div>
          </PhoneFrame>
        </AbsoluteFill>
      </Sequence>

      {/* 3-2. Liftoff (1:38 - 1:57) [19s] */}
      <Sequence from={17 * fps} durationInFrames={19 * fps}>
        <AbsoluteFill
          style={{
            justifyContent: "center",
            alignItems: "center",
            background: "#111827",
          }}
        >
          <div
            style={{
              fontFamily: "Noto Sans JP",
              fontSize: "60px",
              fontWeight: "bold",
              color: "white",
              marginBottom: "50px",
            }}
          >
            安全に、確実に
          </div>
          {/* Abstract Rocket/Data Animation would go here */}
          <div
            style={{
              width: "20px",
              height: "20px",
              borderRadius: "50%",
              background: "var(--primary-color)",
              boxShadow: "0 0 20px var(--primary-color)",
            }}
          />
        </AbsoluteFill>
      </Sequence>

      {/* 3-3. Orbit Insertion (1:58 - 2:30) [32s] */}
      <Sequence from={(17 + 19) * fps} durationInFrames={32 * fps}>
        <AbsoluteFill
          style={{ justifyContent: "center", alignItems: "center" }}
        >
          <div
            style={{
              fontFamily: "Noto Sans JP",
              fontSize: "50px",
              fontWeight: "bold",
              marginBottom: "40px",
            }}
          >
            光の速さで、厨房へ
          </div>
          <div style={{ display: "flex", gap: "40px" }}>
            <MockOrderCard
              orderId="A001"
              items={["焼きそば", "フランクフルト"]}
              status="waiting"
            />
            <MockOrderCard
              orderId="A002"
              items={["タピオカ"]}
              status="waiting"
            />
          </div>
        </AbsoluteFill>
      </Sequence>

      {/* 3-4. Status Update (2:31 - 2:46) [15s] */}
      <Sequence from={(17 + 19 + 32) * fps} durationInFrames={15 * fps}>
        <AbsoluteFill
          style={{ justifyContent: "center", alignItems: "center" }}
        >
          <div
            style={{
              fontFamily: "Noto Sans JP",
              fontSize: "50px",
              fontWeight: "bold",
              marginBottom: "40px",
            }}
          >
            リアルタイム同期
          </div>
          <div style={{ display: "flex", gap: "100px", alignItems: "center" }}>
            {/* Store View */}
            <div>
              <h3>Store</h3>
              <MockOrderCard
                orderId="A001"
                items={["焼きそば"]}
                status="ready"
              />
            </div>
            {/* User View */}
            <div>
              <h3>Guest</h3>
              <PhoneFrame style={{ transform: "scale(0.8)" }}>
                <div style={{ padding: "20px", paddingTop: "60px" }}>
                  <div
                    style={{
                      background: "#10b981",
                      color: "white",
                      padding: "20px",
                      borderRadius: "12px",
                      textAlign: "center",
                      fontWeight: "bold",
                      fontSize: "24px",
                    }}
                  >
                    調理完了！
                  </div>
                </div>
              </PhoneFrame>
            </div>
          </div>
        </AbsoluteFill>
      </Sequence>

      {/* 3-5. Calling & Arrival (2:46 - 3:52) [66s] */}
      <Sequence from={(17 + 19 + 32 + 15) * fps} durationInFrames={66 * fps}>
        <AbsoluteFill
          style={{ justifyContent: "center", alignItems: "center" }}
        >
          <div
            style={{
              fontFamily: "Noto Sans JP",
              fontSize: "50px",
              fontWeight: "bold",
            }}
          >
            待たせない。逃さない。
          </div>
        </AbsoluteFill>
      </Sequence>

      {/* 3-6. Handover (3:53 - 4:27) [34s] */}
      <Sequence
        from={(17 + 19 + 32 + 15 + 66) * fps}
        durationInFrames={34 * fps}
      >
        <AbsoluteFill
          style={{ justifyContent: "center", alignItems: "center" }}
        >
          <div
            style={{
              fontFamily: "Noto Sans JP",
              fontSize: "50px",
              fontWeight: "bold",
              marginBottom: "20px",
            }}
          >
            体験を持ち帰ろう
          </div>
          <div
            style={{
              width: "200px",
              height: "200px",
              background: "white",
              borderRadius: "20px",
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
              boxShadow: "0 10px 30px rgba(0,0,0,0.1)",
            }}
          >
            <Check size={100} color="#10b981" />
          </div>
        </AbsoluteFill>
      </Sequence>
    </AbsoluteFill>
  );
};
