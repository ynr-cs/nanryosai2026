import React from "react";
import {
  AbsoluteFill,
  useCurrentFrame,
  useVideoConfig,
  Sequence,
  interpolate,
  spring,
  Img,
} from "remotion";
import { MockPhone } from "../../components/Mock/Phone";
import { MockTablet } from "../../components/Mock/Tablet";
import { MockButton } from "../../components/Mock/Button";
import { MockOrderCard } from "../../components/Mock/OrderCard";
import {
  Check,
  CreditCard,
  ShoppingBag,
  Utensils,
  Bell,
  ChevronRight,
  TrendingUp,
  ToggleRight,
} from "lucide-react";
import "../../styles/global.css";

const TitleText: React.FC<{ text: string }> = ({ text }) => (
  <div
    style={{
      fontFamily: "var(--font-main)",
      fontSize: "60px",
      fontWeight: "bold",
      marginBottom: "40px",
      textAlign: "center",
      color: "#333",
    }}
  >
    {text}
  </div>
);

export const Phase3OrderFlow: React.FC = () => {
  const { fps, width, height } = useVideoConfig();
  const frame = useCurrentFrame();

  return (
    <AbsoluteFill style={{ background: "var(--bg-color)" }}>
      {/* 3-1. Ready (1:20 - 1:26) [6s] */}
      <Sequence from={0} durationInFrames={6 * fps}>
        <AbsoluteFill
          style={{ justifyContent: "center", alignItems: "center" }}
        >
          <TitleText text="System Ready" />
          <div
            style={{
              fontSize: "100px",
              color: "var(--success-color)",
              fontWeight: "900",
            }}
          >
            ALL GREEN
          </div>
        </AbsoluteFill>
      </Sequence>

      {/* 3-2. Order (1:26 - 1:36) [10s] */}
      <Sequence from={6 * fps} durationInFrames={10 * fps}>
        <AbsoluteFill
          style={{ justifyContent: "center", alignItems: "center" }}
        >
          <MockPhone>
            <div style={{ padding: 20 }}>
              <div
                style={{ fontSize: 24, fontWeight: "bold", marginBottom: 20 }}
              >
                Menu
              </div>
              <div
                style={{ display: "flex", flexDirection: "column", gap: 10 }}
              >
                <div
                  style={{
                    padding: 10,
                    border: "1px solid #ddd",
                    borderRadius: 8,
                  }}
                >
                  Yakisoba - ¥500
                </div>
                <div
                  style={{
                    padding: 10,
                    border: "1px solid #ddd",
                    borderRadius: 8,
                    background: "#eef2ff",
                  }}
                >
                  Tapioca - ¥300 (Selected)
                </div>
              </div>
              <div style={{ marginTop: 240, textAlign: "center" }}>
                <MockButton text="注文を確定する" />
              </div>
            </div>
          </MockPhone>
        </AbsoluteFill>
      </Sequence>

      {/* 3-3. Transfer & Arrive (1:36 - 1:55) [19s] */}
      <Sequence from={16 * fps} durationInFrames={19 * fps}>
        <AbsoluteFill
          style={{
            justifyContent: "center",
            alignItems: "center",
            background: "#0f172a",
          }}
        >
          <div style={{ color: "white", fontSize: 24 }}>
            Data Transfer Encryption...
          </div>
          {/* Simple particle flowing animation could be added here */}
        </AbsoluteFill>
      </Sequence>

      {/* 3-4. Display (1:55 - 2:00) [5s] */}
      <Sequence from={35 * fps} durationInFrames={5 * fps}>
        <AbsoluteFill
          style={{ justifyContent: "center", alignItems: "center" }}
        >
          <MockTablet>
            <div
              style={{
                padding: 40,
                display: "flex",
                justifyContent: "center",
                alignItems: "center",
                height: "100%",
              }}
            >
              <div
                style={{
                  fontSize: 80,
                  fontWeight: "bold",
                  color: "var(--primary-color)",
                }}
              >
                New Order!
              </div>
            </div>
          </MockTablet>
        </AbsoluteFill>
      </Sequence>

      {/* 3-5. Cooking (2:00 - 2:10) [10s] */}
      <Sequence from={40 * fps} durationInFrames={10 * fps}>
        <AbsoluteFill
          style={{
            flexDirection: "row",
            justifyContent: "center",
            alignItems: "center",
            gap: 50,
          }}
        >
          <MockTablet style={{ transform: "scale(0.6)" }}>
            <div style={{ padding: 20 }}>
              <h3>Kitchen View</h3>
              <div
                style={{
                  background: "#fef3c7",
                  padding: 20,
                  borderRadius: 10,
                  border: "2px solid var(--warning-color)",
                }}
              >
                Status: Cooking
              </div>
            </div>
          </MockTablet>
          <MockPhone style={{ transform: "scale(0.6)" }}>
            <div style={{ padding: 20, textAlign: "center", paddingTop: 100 }}>
              Status:{" "}
              <span
                style={{ color: "var(--warning-color)", fontWeight: "bold" }}
              >
                調理中...
              </span>
            </div>
          </MockPhone>
        </AbsoluteFill>
      </Sequence>

      {/* 3-6. Cook Done (2:10 - 2:30) [20s] */}
      <Sequence from={50 * fps} durationInFrames={20 * fps}>
        <AbsoluteFill
          style={{
            flexDirection: "row",
            justifyContent: "center",
            alignItems: "center",
            gap: 50,
          }}
        >
          {/* Simulation of tapping 'Done' */}
          <MockTablet style={{ transform: "scale(0.6)" }}>
            <div style={{ padding: 20 }}>
              <h3>Kitchen View</h3>
              <MockButton
                text="調理完了"
                style={{ background: "var(--success-color)" }}
              />
            </div>
          </MockTablet>
          <MockPhone style={{ transform: "scale(0.6)" }}>
            <div style={{ padding: 20, textAlign: "center", paddingTop: 100 }}>
              Status:{" "}
              <span
                style={{ color: "var(--success-color)", fontWeight: "bold" }}
              >
                調理完了
              </span>
            </div>
          </MockPhone>
        </AbsoluteFill>
      </Sequence>

      {/* 3-7. Presenter (2:30 - 2:45) [15s] */}
      <Sequence from={70 * fps} durationInFrames={15 * fps}>
        <AbsoluteFill
          style={{ justifyContent: "center", alignItems: "center" }}
        >
          <MockTablet>
            <div
              style={{
                padding: 20,
                textAlign: "center",
                height: "100%",
                display: "flex",
                flexDirection: "column",
                justifyContent: "center",
                alignItems: "center",
              }}
            >
              <h2>Presenter View</h2>
              <p>Picking items...</p>
              <MockButton
                text="準備完了 (Call)"
                style={{ background: "var(--primary-color)", width: 300 }}
              />
            </div>
          </MockTablet>
        </AbsoluteFill>
      </Sequence>

      {/* 3-8. Call (2:45 - 3:00) [15s] */}
      <Sequence from={85 * fps} durationInFrames={15 * fps}>
        <AbsoluteFill
          style={{ justifyContent: "center", alignItems: "center" }}
        >
          <div
            style={{
              position: "absolute",
              top: 100,
              fontSize: 40,
              fontWeight: "bold",
            }}
          >
            Notification Burst!
          </div>
          <div style={{ display: "flex", gap: 40 }}>
            <MockPhone style={{ transform: "scale(0.8)" }}>
              <div
                style={{
                  background: "rgba(0,0,0,0.8)",
                  margin: 10,
                  padding: 15,
                  borderRadius: 10,
                  color: "white",
                  display: "flex",
                  gap: 10,
                  alignItems: "center",
                }}
              >
                <Bell size={20} /> Order Ready!
              </div>
            </MockPhone>
            <div
              style={{
                width: 400,
                height: 300,
                background: "black",
                border: "10px solid #333",
                borderRadius: 20,
                display: "flex",
                justifyContent: "center",
                alignItems: "center",
                color: "white",
                fontSize: 80,
                fontWeight: "bold",
              }}
            >
              A-001
            </div>
          </div>
        </AbsoluteFill>
      </Sequence>

      {/* 3-9. Approach (3:00 - 3:15) [15s] */}
      <Sequence from={100 * fps} durationInFrames={15 * fps}>
        <AbsoluteFill
          style={{ justifyContent: "center", alignItems: "center" }}
        >
          <MockTablet orientation="landscape">
            <div style={{ padding: 40, textAlign: "center" }}>
              <h2>Monitor Display</h2>
              <div
                style={{
                  border: "2px solid #ccc",
                  padding: 20,
                  fontSize: 40,
                  width: 300,
                  margin: "20px auto",
                }}
              >
                Input No.
              </div>
            </div>
          </MockTablet>
        </AbsoluteFill>
      </Sequence>

      {/* 3-10. Confirm (3:15 - 3:35) [20s] */}
      <Sequence from={115 * fps} durationInFrames={20 * fps}>
        <AbsoluteFill
          style={{ justifyContent: "center", alignItems: "center" }}
        >
          <MockTablet orientation="landscape">
            <div style={{ padding: 40 }}>
              <h2>Confirm Order</h2>
              <div style={{ fontSize: 24, marginBottom: 20 }}>
                Tapioca (Milk Tea) x1
              </div>
              <div
                style={{
                  fontSize: 40,
                  fontWeight: "bold",
                  textAlign: "right",
                  margin: "40px 0",
                }}
              >
                ¥300
              </div>
              <MockButton
                text="決済を確定する"
                style={{ width: "100%", background: "var(--accent-color)" }}
              />
            </div>
          </MockTablet>
        </AbsoluteFill>
      </Sequence>

      {/* 3-11. Payment (3:35 - 3:55) [20s] */}
      <Sequence from={135 * fps} durationInFrames={20 * fps}>
        <AbsoluteFill
          style={{
            justifyContent: "center",
            alignItems: "center",
            background: "white",
          }}
        >
          <div
            style={{
              fontSize: 80,
              fontWeight: "bold",
              color: "var(--accent-color)",
              marginBottom: 20,
            }}
          >
            au PAY
          </div>
          <div style={{ fontSize: 40, color: "#333" }}>
            Payment Processing...
          </div>
          <Check
            size={120}
            color="var(--success-color)"
            style={{ marginTop: 40 }}
          />
        </AbsoluteFill>
      </Sequence>

      {/* 3-12. Freedom (3:55 - 4:09) [14s] */}
      <Sequence from={155 * fps} durationInFrames={14 * fps}>
        <AbsoluteFill
          style={{
            justifyContent: "center",
            alignItems: "center",
            background: "#e0f2fe",
          }}
        >
          <TitleText text="No More Lines." />
          <div style={{ display: "flex", gap: 20 }}>
            <ShoppingBag size={60} />
            <Utensils size={60} />
            <div style={{ fontSize: 60 }}>😊</div>
          </div>
        </AbsoluteFill>
      </Sequence>

      {/* 3-13. Admin (4:09 - 4:27) [18s] */}
      <Sequence from={169 * fps} durationInFrames={18 * fps}>
        <AbsoluteFill
          style={{ justifyContent: "center", alignItems: "center" }}
        >
          <MockTablet>
            <div style={{ padding: 20 }}>
              <h2>Admin Dashboard</h2>
              <div style={{ display: "flex", gap: 20, marginBottom: 20 }}>
                <div
                  style={{
                    padding: 20,
                    background: "#f3f4f6",
                    borderRadius: 10,
                    flex: 1,
                  }}
                >
                  <TrendingUp /> Sales: ¥120,000
                </div>
                <div
                  style={{
                    padding: 20,
                    background: "#f3f4f6",
                    borderRadius: 10,
                    flex: 1,
                  }}
                >
                  TC: 450
                </div>
              </div>
              <div
                style={{
                  padding: 10,
                  borderBottom: "1px solid #eee",
                  display: "flex",
                  justifyContent: "space-between",
                }}
              >
                <span>Yakisoba</span>
                <ToggleRight color="var(--success-color)" />
              </div>
            </div>
          </MockTablet>
        </AbsoluteFill>
      </Sequence>
    </AbsoluteFill>
  );
};
