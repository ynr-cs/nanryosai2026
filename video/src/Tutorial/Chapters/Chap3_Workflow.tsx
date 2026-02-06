import { AbsoluteFill, useCurrentFrame, interpolate } from "remotion";
import { MockOrderCard } from "../../Shared/UIComponents/MockOrderCard";

export const Chap3_Workflow: React.FC = () => {
  const frame = useCurrentFrame();

  // Sequence timeline (frames)
  // 0-60: New Order Arrives
  // 60-120: Status 'New'
  // 120-180: Click 'Start Cooking' -> Status 'Cooking'
  // 180-240: Status 'Cooking'
  // 240-300: Click 'Call' -> Status 'Ready'
  // 300-360: Status 'Ready'
  // 360-420: Click 'Complete' -> Disappear

  const cardOpacity = interpolate(frame, [0, 30], [0, 1], {
    extrapolateRight: "clamp",
  });
  const cardY = interpolate(frame, [0, 30], [50, 0], {
    extrapolateRight: "clamp",
  });

  // Simulate status changes
  let status: "new" | "cooking" | "ready" | "completed" = "new";
  if (frame > 120) status = "cooking";
  if (frame > 240) status = "ready";
  if (frame > 360) status = "completed";

  // Simulate completion disappearance
  const finalOpacity = interpolate(frame, [360, 390], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Combine opacities
  const currentOpacity = frame > 360 ? finalOpacity : cardOpacity;

  return (
    <AbsoluteFill
      style={{
        backgroundColor: "#f5f6fa",
        justifyContent: "center",
        alignItems: "center",
      }}
    >
      <h1>Chapter 3: 基本操作フロー</h1>
      <p style={{ marginBottom: 40, color: "#666" }}>
        受注 〜 調理 〜 受渡 の流れ
      </p>

      <div
        style={{
          opacity: currentOpacity,
          transform: `translateY(${cardY}px)`,
        }}
      >
        <MockOrderCard
          orderId="101"
          items={["焼きそば x2", "フランクフルト x1"]}
          status={status}
          style={{ transform: "scale(1.5)" }}
        />
      </div>

      <div style={{ marginTop: 60, fontSize: 24, color: "#555" }}>
        {status === "new" && <p>1. 注文が入るとカードが表示されます</p>}
        {status === "cooking" && <p>2. 「調理開始」で調理中のステータスへ</p>}
        {status === "ready" && <p>3. 準備ができたら「呼出」でお知らせ</p>}
        {status === "completed" && <p>4. 商品を渡して「完了」</p>}
      </div>
    </AbsoluteFill>
  );
};
