export default function UndoToast({ task, onUndo }) {
  if (!task) return null;

  return (
    <div className="task-undo-toast">
      <span>Deleted "{task.title}"</span>
      <button type="button" onClick={onUndo}>Undo</button>
    </div>
  );
}
