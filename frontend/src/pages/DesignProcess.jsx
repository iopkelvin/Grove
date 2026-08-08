const SECTIONS = [
  { id: "hero", title: "Grow together, one task at a time." },
  { id: "problem", number: "01", title: "Problem & Target Users" },
  { id: "needfinding", number: "02", title: "Needfinding" },
  { id: "lofi", number: "03", title: "Lo-Fi Prototyping" },
  { id: "hifi", number: "04", title: "Hi-Fi Prototyping" },
  { id: "implementation", number: "05", title: "Implementation" },
  { id: "evaluation", number: "06", title: "User Evaluation" },
  { id: "reflection", number: "07", title: "Reflection & Next Steps" },
  { id: "demo", number: "08", title: "Demo Video" },
  { id: "team", number: "09", title: "Team" },
  { id: "closing", title: "Grow together." },
];

function DesignProcess() {
  return (
    <div className="design-process">
      {SECTIONS.map((section) => (
        <section key={section.id} id={section.id} className="design-process-section">
          {section.number && <span className="design-process-number">{section.number}</span>}
          <h2 className="design-process-title">{section.title}</h2>
        </section>
      ))}
    </div>
  );
}

export default DesignProcess;
