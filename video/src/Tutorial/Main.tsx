import { Series } from "remotion";
import { Chap1_Intro } from "./Chapters/Chap1_Intro";
import { Chap2_Mechanism } from "./Chapters/Chap2_Mechanism";
import { Chap3_Workflow } from "./Chapters/Chap3_Workflow";
import { Chap4_Features } from "./Chapters/Chap4_Features";
import { Chap5_Trouble } from "./Chapters/Chap5_Trouble";
import { Chap6_Ending } from "./Chapters/Chap6_Ending";

export const Tutorial: React.FC = () => {
  return (
    <Series>
      <Series.Sequence durationInFrames={30 * 45}>
        <Chap1_Intro />
      </Series.Sequence>
      <Series.Sequence durationInFrames={30 * 60}>
        <Chap2_Mechanism />
      </Series.Sequence>
      <Series.Sequence durationInFrames={30 * 20}>
        <Chap3_Workflow />
      </Series.Sequence>
      <Series.Sequence durationInFrames={30 * 20}>
        <Chap4_Features />
      </Series.Sequence>
      <Series.Sequence durationInFrames={30 * 20}>
        <Chap5_Trouble />
      </Series.Sequence>
      <Series.Sequence durationInFrames={30 * 15}>
        <Chap6_Ending />
      </Series.Sequence>
      {/* Future chapters will be added here */}
    </Series>
  );
};
