import { Link } from "react-router-dom";
import { GENRE_PRESETS } from "@/lib/constants";
import { SuiteFactory } from "@/lib/suite-factory";
import { DNA } from "@/lib/dna";

// #ЗАЧЕМ: Маршруты определяют, какая музыка будет играть. 
// Каждый маршрут — это отдельный URL, связанный с определенным жанром и музыкальным "мозгом".
const ROUTING_PRESETS = {
  ambient: {
    brain: "ambient",
    genre: GENRE_PRESETS.ambient,
    useWhiteKeys: true,
  },
  piano_solo: {
    brain: "piano-solo",
    genre: GENRE_PRESETS.piano_solo,
    useWhiteKeys: true,
  },
  trance: {
    brain: "trance",
    genre: GENRE_PRESETS.trance,
  },
  dark_trance: {
    brain: "dark-foundry",
    genre: GENRE_PRESETS.dark_trance,
    // #РЕШЕНИЕ: Проблема была здесь. Эта строка отключала барабаны для дарк-транса. Я ее удаляю.
    // disabledInstruments: ['drums'] 
  },
  cyber_blues: {
    brain: "dark-foundry",
    genre: GENRE_PRESETS.cyber_blues,
  },
  
  reggae: {
    brain: "reggae",
    genre: GENRE_PRESETS.reggae,
  },
};

export default function Index() {
  const renderLink = (key: keyof typeof ROUTING_PRESETS) => {
    const preset = ROUTING_PRESETS[key];
    const dna = new DNA(preset.brain, preset.genre);
    const suite = SuiteFactory.create(dna);
    const title = suite.getTitle();

    return (
      <li key={key}>
        <Link to={`/suite/${key}`}>
          {title} ({key})
        </Link>
      </li>
    );
  };

  return (
    <div style={{ fontFamily: "system-ui, sans-serif", lineHeight: "1.8" }}>
      <h1>Fractal Music</h1>
      <ul>{Object.keys(ROUTING_PRESETS).map(renderLink)}</ul>
    </div>
  );
}