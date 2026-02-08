import React from "react";
import { Series, Audio, staticFile } from "remotion";
import { Phase1History } from "./scenes/Phase1_History";
import { Phase2WholePicture } from "./scenes/Phase2_WholePicture";
import { Phase3OrderFlow } from "./scenes/Phase3_OrderFlow";
import { Conclusion } from "./scenes/Conclusion";
import "./styles/global.css";

export const MainVideo: React.FC = () => {
  return (
    <>
      <Audio src={staticFile("bgm.mp3")} />

      <Series>
        {/* Phase 1: History & Mission (0:00 - 0:38) [38s] */}
        <Series.Sequence durationInFrames={38 * 30}>
          <Phase1History />
        </Series.Sequence>

        {/* Phase 2: Whole Picture (0:39 - 1:19) [40s] */}
        <Series.Sequence durationInFrames={40 * 30}>
          <Phase2WholePicture />
        </Series.Sequence>

        {/* Phase 3: Order Flow (1:20 - 4:27) [187s] */}
        {/* 1:20 is 80s start. Duration = 267s end - 80s start = 187s */}
        <Series.Sequence durationInFrames={187 * 30}>
          <Phase3OrderFlow />
        </Series.Sequence>

        {/* Conclusion (4:28 - 5:25) [57s] */}
        <Series.Sequence durationInFrames={57 * 30}>
          <Conclusion />
        </Series.Sequence>
      </Series>
    </>
  );
};
