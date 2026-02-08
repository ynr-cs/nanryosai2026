import { Composition } from "remotion";
import { MainVideo } from "./MainVideo";
import { Phase1History } from "./scenes/Phase1_History";
import { Phase2WholePicture } from "./scenes/Phase2_WholePicture";
import { Phase3OrderFlow } from "./scenes/Phase3_OrderFlow";
import { Conclusion } from "./scenes/Conclusion";
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
        id="Phase2-WholePicture"
        component={Phase2WholePicture}
        durationInFrames={40 * 30}
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
        id="Conclusion"
        component={Conclusion}
        durationInFrames={57 * 30}
        fps={30}
        width={1920}
        height={1080}
      />
    </>
  );
};
