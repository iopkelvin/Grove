import { useEffect, useRef, useState } from "react";
import PhotoCluster from "../components/PhotoCluster";

const SCENES = {
  intro: { file: "/assets/design-process/intro.png", mode: "day" },
  morning: { file: "/assets/design-process/morning.png", mode: "day" },
  afternoon: { file: "/assets/design-process/afternoon.png", mode: "day" },
  evening: { file: "/assets/design-process/evening.png", mode: "night" },
  night: { file: "/assets/design-process/night.png", mode: "night" },
  ending: { file: "/assets/design-process/ending.png", mode: "night" },
};

const LOFI_PROTOTYPE_CAPTION =
  "These two lo-fi prototypes are very close to the final application. They show the process flow across the following pages and modals: 1. Home, 2. Calendar, 3. Task Creation modal, 4. Tasks, 5. Profile, 6. Streaks, 7. Main Hub, 8. Rooms, 9. Invitation modal, 10. Friends.";

const SECTIONS = [
  { id: "hero", heading: "Grove", title: "Grow together, one task at a time.", scene: "intro" },
  {
    id: "problem",
    scene: "morning",
    type: "content",
    useTitle: true,
    number: "01",
    title: "Problem & Target Users",
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
    useTitle: true,
    number: "02",
    title: "Needfinding",
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
  {
    id: "lofi",
    scene: "afternoon",
    type: "columns",
    useTitle: true,
    number: "03",
    title: "Lo-Fi Prototyping",
    parts: [
      {
        title: "Sketching & Brainstorming",
        body: "20–30 rough sketches across our 11 needfinding-driven ideas, sketched fast with Crazy 8's to explore breadth before depth.",
        photos: [
          {
            src: "/assets/design-process/lofi/sketch_1.png",
            alt: "Crazy 8's brainstorming sketch",
            caption:
              "First sketch: growth tree increasing for completing a task per day.\nSecond sketch: the streak counter shown on the profile page.",
          },
          {
            src: "/assets/design-process/lofi/sketch_2.png",
            alt: "Crazy 8's brainstorming sketch",
            caption: "Creating a task, which can be added to the calendar and set to notify the user.",
          },
          {
            src: "/assets/design-process/lofi/sketch_3.png",
            alt: "Crazy 8's brainstorming sketch",
            caption: "Viewing the streak count of the user's friends.",
          },
          {
            src: "/assets/design-process/lofi/sketch_4.png",
            alt: "Crazy 8's brainstorming sketch",
            caption: "A study room where users can invite friends.",
          },
        ],
      },
      {
        title: "Concept Sketches & Tasks",
        body: "3–5 concept sketches per top solution, narrowed down to 3 core tasks that would guide our prototype.",
      },
      {
        title: "Paper Prototype",
        body: "Two hand-drawn prototypes built to run users through all three tasks end to end, plus a third, more minimalist version sketched after early testing.",
        photos: [
          { src: "/assets/design-process/lofi/lofi_1.png", alt: "Hand-drawn paper prototype", caption: LOFI_PROTOTYPE_CAPTION },
          { src: "/assets/design-process/lofi/lofi_2.png", alt: "Hand-drawn paper prototype", caption: LOFI_PROTOTYPE_CAPTION },
        ],
      },
      {
        title: "Testing & Interviews",
        body: "6 usability interviews across both prototypes surfaced issues that directly shaped our next iteration.",
      },
    ],
  },
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
              : section.type === "content" || (section.type === "columns" && !section.useTitle)
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
              {section.useTitle ? (
                <div className="design-process-title-heading">
                  {section.number && <span className="design-process-number">{section.number}</span>}
                  <h2 className="design-process-title">{section.title}</h2>
                </div>
              ) : (
                <p className="design-process-kicker">{section.kicker}</p>
              )}
              {section.blocks.map((block) => (
                <div className="design-process-block" key={block.label}>
                  <p className="design-process-block-label">{block.label}</p>
                  <p className="design-process-block-body">{block.body}</p>
                </div>
              ))}
              {section.quote && <p className="design-process-quote">{section.quote}</p>}
              {section.icon && <img className="design-process-content-tree" src={section.icon} alt="" />}
            </div>
          ) : section.type === "columns" ? (
            <div className="design-process-columns-inner">
              {section.useTitle ? (
                <div className="design-process-title-heading">
                  {section.number && <span className="design-process-number">{section.number}</span>}
                  <h2 className="design-process-title">{section.title}</h2>
                </div>
              ) : (
                <p className="design-process-kicker">{section.kicker}</p>
              )}
              <div className="design-process-columns">
                {section.parts.map((part) => (
                  <div className="design-process-column" key={part.title}>
                    <h3 className="design-process-column-title">{part.title}</h3>
                    <p className="design-process-column-body">{part.body}</p>
                    {part.photos && <PhotoCluster photos={part.photos} label={part.title} />}
                  </div>
                ))}
              </div>
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
