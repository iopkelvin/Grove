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
  {
    id: "hifi",
    number: "04",
    title: "Hi-Fi Prototyping",
    scene: "afternoon",
    type: "columns",
    useTitle: true,
    parts: [
      {
        title: "Five Different Designs",
        body: "Before we picked one look, everyone on the team designed their own version of the same home screen. Same brief, five totally different styles.",
        photos: [
          {
            src: "/assets/design-process/hifi/Kelvin_prototype.png",
            alt: "Kelvin's home screen design",
            caption: "Kelvin's Prototype",
          },
          {
            src: "/assets/design-process/hifi/Kyle_prototype.png",
            alt: "Kyle's home screen design",
            caption: "Kyle's Prototype",
          },
          {
            src: "/assets/design-process/hifi/Ameya_prototype.png",
            alt: "Ameya's home screen design",
            caption: "Ameya's Prototype",
          },
          {
            src: "/assets/design-process/hifi/Turner_prototype.png",
            alt: "Turner's home screen design",
            caption: "Turner's Prototype",
          },
          {
            src: "/assets/design-process/hifi/Aatish_prototype.png",
            alt: "Aatish's home screen design",
            caption: "Aatish's Prototype",
          },
        ],
      },
      {
        title: "Converging on One Direction",
        body: "After looking at everyone's designs, we decided to move forward with Kelvin's and Kyle's — those two felt the most finished and closest to what we wanted. Kyle's felt modern and clean, and Kelvin's stuck closer to our original lo-fi idea and was easy to read. But we didn't just pick one — we pulled in the best parts from everyone else too: Ameya's \"up next\" feature, Aatish's rounded buttons, Kyle's minimalistic look and dark mode, Turner's scrolling, and Kelvin's fonts, icons, and colors. So the final design is really a mix of everyone's work.",
      },
      {
        title: "Building the Full Prototype",
        body: "Once we had a direction, we built the whole thing out in Figma — every screen you'd actually use: home, tasks, profile, calendar, the study room lobby, a real study room, friends, and the streak tree. It's all clickable and connected, so you can go through it like a real app.",
        photos: [
          {
            src: "/assets/design-process/hifi/Final_Prototype.png",
            alt: "Final Hi-Fi prototype flow",
            caption: "The final prototype — every screen connected end to end in Figma: home, tasks, profile, calendar, study room lobby, a real study room, friends, and the streak tree.",
          },
        ],
      },
    ],
  },
  {
    id: "implementation",
    scene: "afternoon",
    type: "content",
    useTitle: true,
    number: "05",
    title: "Implementation",
    blocks: [
      {
        body: "The implementation was based on the Hi-Fi prototype, but as we built it out, we added a lot of small details and features that weren't part of the original design — little things that made the final app feel more complete and easier to use.",
      },
      { divider: "THE TOOLS" },
      {
        label: "Frontend",
        body: "A React + Vite app, with React Router handling navigation and Supabase's client library managing the logged-in session.",
      },
      {
        label: "Backend",
        body: "A Flask app exposing a plain JSON REST API, split into models and services so routes stay thin and the business logic lives in one place.",
      },
      {
        label: "Authentication",
        body: "Supabase handles sign-up and login and issues a JWT. Every protected Flask route verifies that token server-side with PyJWT before touching any data.",
      },
      {
        label: "Data & Storage",
        body: "Postgres via Supabase, accessed through Flask-SQLAlchemy models, with schema changes going through Alembic migrations. Local development falls back to SQLite for zero setup; production runs on Postgres, served with gunicorn.",
      },
      {
        label: "Continuous Integration",
        body: "GitHub Actions run on every PR into main or development — one job runs the pytest suite, another runs stylelint against the frontend CSS.",
      },
      {
        label: "Uptime",
        body: "A cron job pings the web service on an interval to prevent cold starts on the hosting tier.",
      },
    ],
  },
  { id: "evaluation", number: "06", title: "User Evaluation", scene: "evening" },
  { id: "reflection", number: "07", title: "Reflection & Next Steps", scene: "evening" },
  { id: "demo", number: "08", title: "Demo Video", scene: "night" },
  {
    id: "team",
    number: "09",
    title: "Team",
    scene: "night",
    type: "team",
    useTitle: true,
    members: [
      {
        name: "Kelvin Ortiz",
        email: "iopkelvin@gmail.com",
        link: "https://www.linkedin.com/in/kelvin-ortiz/",
        linkLabel: "LinkedIn",
      },
      { name: "Kyle Gibson" },
      { name: "Ameya Amit Borkar" },
      { name: "Aatish Bagal" },
      { name: "Turner Agustin Osswald" },
    ],
  },
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
              {section.blocks.map((block, i) =>
                block.divider ? (
                  <p className="design-process-block-divider" key={`divider-${i}`}>{block.divider}</p>
                ) : (
                  <div className="design-process-block" key={block.label || `block-${i}`}>
                    {block.label && <p className="design-process-block-label">{block.label}</p>}
                    <p className="design-process-block-body">{block.body}</p>
                  </div>
                )
              )}
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
          ) : section.type === "team" ? (
            <div className="design-process-columns-inner">
              <div className="design-process-title-heading">
                {section.number && <span className="design-process-number">{section.number}</span>}
                <h2 className="design-process-title">{section.title}</h2>
              </div>
              <div className="design-process-team-members">
                {section.members.map((member) => (
                  <div className="design-process-team-member" key={member.name}>
                    <h3 className="design-process-team-name">{member.name}</h3>
                    {member.email || member.link ? (
                      <div className="design-process-team-contact">
                        {member.email && (
                          <a className="design-process-team-link" href={`mailto:${member.email}`}>
                            {member.email}
                          </a>
                        )}
                        {member.link && (
                          <a
                            className="design-process-team-link"
                            href={member.link}
                            target="_blank"
                            rel="noreferrer"
                          >
                            {member.linkLabel || "Profile"}
                          </a>
                        )}
                      </div>
                    ) : (
                      <p className="design-process-team-placeholder">Contact info coming soon</p>
                    )}
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
