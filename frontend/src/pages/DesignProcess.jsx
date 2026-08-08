import { useEffect, useRef, useState } from "react";

const SCENES = {
  intro: { file: "/assets/design-process/intro.png", mode: "day" },
  morning: { file: "/assets/design-process/morning.png", mode: "day" },
  afternoon: { file: "/assets/design-process/afternoon.png", mode: "day" },
  evening: { file: "/assets/design-process/evening.png", mode: "night" },
  night: { file: "/assets/design-process/night.png", mode: "night" },
  ending: { file: "/assets/design-process/ending.png", mode: "night" },
};

const SECTIONS = [
  { id: "hero", heading: "Grove", title: "Grow together, one task at a time.", scene: "intro" },
  {
    id: "problem",
    scene: "morning",
    type: "content",
    kicker: "Problem & Target Users",
    blocks: [
      {
        label: "THE PROBLEM",
        body: "Starting something new is hard, whether it's a habit or an assignment. It's easy to keep putting it off, and doing it alone makes it worse, since there's no one around to keep you accountable.",
      },
      {
        label: "WHO IT'S FOR",
        body: "Anyone trying to build better habits or stay on top of their workload, who gets more done with someone else around.",
      },
    ],
    icon: "/assets/design-process/problem-tree.png",
  },
  {
    id: "needfinding",
    scene: "morning",
    type: "content",
    kicker: "Needfinding",
    blocks: [
      {
        label: "WHO WE TALKED TO",
        body: "We sat down with people to understand how they manage day-to-day tasks. We wanted to know what gets in their way, and what it costs them emotionally when the work feels like something to avoid.",
      },
      {
        label: "WHAT WE FOUND",
        body: "Starting was hard for everyone we talked to, whether it was low motivation, distractions at home, or negative feelings tied to the task itself. For most, it got easier in a calmer, more comfortable space, or with other people nearby. Feeling truly finished was harder — some said they never really felt done, even after finishing their work.",
      },
    ],
    quote: "How might we help someone feel supported enough to start, and know when they're truly done?",
  },
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
          data-mode={SCENES[section.scene].mode}
          ref={(el) => (sectionRefs.current[section.id] = el)}
          className={
            section.id === "hero"
              ? "design-process-section design-process-hero"
              : section.type === "content"
                ? "design-process-section design-process-content-section"
                : "design-process-section"
          }
        >
          {section.id === "hero" ? (
            <div className="design-process-hero-inner">
              <div className="design-process-hero-text">
                <h1 className="design-process-hero-heading">{section.heading}</h1>
                <p className="design-process-hero-tagline">{section.title}</p>
              </div>
              <img className="design-process-hero-tree" src="/assets/design-process/hero-tree.png" alt="" />
            </div>
          ) : section.type === "content" ? (
            <div className="design-process-content">
              <p className="design-process-kicker">{section.kicker}</p>
              {section.blocks.map((block) => (
                <div className="design-process-block" key={block.label}>
                  <p className="design-process-block-label">{block.label}</p>
                  <p className="design-process-block-body">{block.body}</p>
                </div>
              ))}
              {section.quote && <p className="design-process-quote">{section.quote}</p>}
              {section.icon && <img className="design-process-content-tree" src={section.icon} alt="" />}
            </div>
          ) : (
            <>
              {section.number && <span className="design-process-number">{section.number}</span>}
              <h2 className="design-process-title">{section.title}</h2>
            </>
          )}
        </section>
      ))}
    </div>
  );
}

export default DesignProcess;
