import { Composition } from "remotion";
import { MainVideo } from "./MainVideo";
import { Phase1History } from "./scenes/Phase1_History";
import { Phase2ThreeElements } from "./scenes/Phase2_ThreeElements";
import { Phase3OrderFlow } from "./scenes/Phase3_OrderFlow";
import { Phase4Closing } from "./scenes/Phase4_Closing";
import "./styles/global.css";

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="MainVideo"
        component={MainVideo}
        durationInFrames={(5 * 60 + 25) * 30} // 5m 25s
        fps={30}
        width={1920}
        height={1080}
      />
      <Composition
        id="Phase1-History"
        component={Phase1History}
        durationInFrames={38 * 30}
        fps={30}
        width={1920}
        height={1080}
      />
      <Composition
        id="Phase2-ThreeElements"
        component={Phase2ThreeElements}
        durationInFrames={41 * 30}
        fps={30}
        width={1920}
        height={1080}
      />
      <Composition
        id="Phase3-OrderFlow"
        component={Phase3OrderFlow}
        durationInFrames={187 * 30}
        fps={30}
        width={1920}
        height={1080}
      />
      <Composition
        id="Phase4-Closing"
        component={Phase4Closing}
        durationInFrames={58 * 30}
        fps={30}
        width={1920}
        height={1080}
      />
    </>
  );
};
