import { useEffect, useRef, useState } from "react";

const SCENES = {
  intro: { file: "/assets/design-process/intro.png" },
  morning: { file: "/assets/design-process/morning.png" },
  afternoon: { file: "/assets/design-process/afternoon.png" },
  evening: { file: "/assets/design-process/evening.png" },
  night: { file: "/assets/design-process/night.png" },
  ending: { file: "/assets/design-process/ending.png" },
};

const SECTIONS = [
  { id: "hero", title: "Grow together, one task at a time.", scene: "intro" },
  { id: "problem", number: "01", title: "Problem & Target Users", scene: "morning" },
  { id: "needfinding", number: "02", title: "Needfinding", scene: "morning" },
  { id: "lofi", number: "03", title: "Lo-Fi Prototyping", scene: "afternoon" },
  { id: "hifi", number: "04", title: "Hi-Fi Prototyping", scene: "afternoon" },
  { id: "implementation", number: "05", title: "Implementation", scene: "afternoon" },
  { id: "evaluation", number: "06", title: "User Evaluation", scene: "evening" },
  { id: "reflection", number: "07", title: "Reflection & Next Steps", scene: "evening" },
  { id: "demo", number: "08", title: "Demo Video", scene: "night" },
  { id: "team", number: "09", title: "Team", scene: "night" },
  { id: "closing", title: "Grow together.", scene: "ending" },
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
          className="design-process-section"
        >
          {section.number && <span className="design-process-number">{section.number}</span>}
          <h2 className="design-process-title">{section.title}</h2>
        </section>
      ))}
    </div>
  );
}

export default DesignProcess;
