import { useEffect, useRef, useState } from "react";

const SCENES = {
  dawn: { file: "/assets/design-process/scene-dawn.png", dark: false },
  morning: { file: "/assets/design-process/scene-morning.png", dark: false },
  night: { file: "/assets/design-process/scene-night.png", dark: true },
  dusk: { file: "/assets/design-process/scene-dusk.png", dark: false },
};

const SECTIONS = [
  { id: "hero", title: "Grow together, one task at a time.", scene: "dawn" },
  { id: "problem", number: "01", title: "Problem & Target Users", scene: "dawn" },
  { id: "needfinding", number: "02", title: "Needfinding", scene: "dawn" },
  { id: "lofi", number: "03", title: "Lo-Fi Prototyping", scene: "morning" },
  { id: "hifi", number: "04", title: "Hi-Fi Prototyping", scene: "morning" },
  { id: "implementation", number: "05", title: "Implementation", scene: "morning" },
  { id: "evaluation", number: "06", title: "User Evaluation", scene: "night" },
  { id: "reflection", number: "07", title: "Reflection & Next Steps", scene: "night" },
  { id: "demo", number: "08", title: "Demo Video", scene: "dusk" },
  { id: "team", number: "09", title: "Team", scene: "dusk" },
  { id: "closing", title: "Grow together.", scene: "dusk" },
];

function DesignProcess() {
  const [activeScene, setActiveScene] = useState(SECTIONS[0].scene);
  const sectionRefs = useRef({});

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.find((entry) => entry.isIntersecting);
        if (visible) setActiveScene(visible.target.dataset.scene);
      },
      { rootMargin: "-50% 0px -50% 0px", threshold: 0 }
    );

    Object.values(sectionRefs.current).forEach((el) => el && observer.observe(el));
    return () => observer.disconnect();
  }, []);

  return (
    <div className="design-process">
      <div className="design-process-backgrounds">
        {Object.entries(SCENES).map(([key, scene]) => (
          <div
            key={key}
            className="design-process-bg"
            style={{
              backgroundImage: `url(${scene.file})`,
              opacity: activeScene === key ? 1 : 0,
            }}
          />
        ))}
      </div>

      {SECTIONS.map((section) => (
        <section
          key={section.id}
          id={section.id}
          data-scene={section.scene}
          ref={(el) => (sectionRefs.current[section.id] = el)}
          className={`design-process-section${SCENES[section.scene].dark ? " is-dark" : ""}`}
        >
          {section.number && <span className="design-process-number">{section.number}</span>}
          <h2 className="design-process-title">{section.title}</h2>
        </section>
      ))}
    </div>
  );
}

export default DesignProcess;
