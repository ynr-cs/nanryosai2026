import React from "react";
import { Series, Audio, staticFile } from "remotion";
import { Phase1History } from "./scenes/Phase1_History";
import { Phase2ThreeElements } from "./scenes/Phase2_ThreeElements";
import { Phase3OrderFlow } from "./scenes/Phase3_OrderFlow";
import { Phase4Closing } from "./scenes/Phase4_Closing";
import "./styles/global.css";

export const MainVideo: React.FC = () => {
  return (
    <>
      <Audio src={staticFile("bgm.mp3")} />

      <Series>
        {/* Phase 1: Intro & History (0:00 - 0:38) [38s] */}
        <Series.Sequence durationInFrames={38 * 30}>
          <Phase1History />
        </Series.Sequence>

        {/* Phase 2: The 3 Elements (0:38 - 1:19) [41s] */}
        <Series.Sequence durationInFrames={41 * 30}>
          <Phase2ThreeElements />
        </Series.Sequence>

        {/* Phase 3: Order Flow (1:20 - 4:27) [187s] */}
        <Series.Sequence durationInFrames={187 * 30}>
          <Phase3OrderFlow />
        </Series.Sequence>

        {/* Phase 4: Closing (4:27 - 5:25) [58s] */}
        <Series.Sequence durationInFrames={58 * 30}>
          <Phase4Closing />
        </Series.Sequence>
      </Series>
    </>
  );
};
