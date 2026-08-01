import { useState, useEffect } from "react";
import { X } from "lucide-react";
import { getTags } from "../api/tasks";

export default function TaskFormModal({ supabaseId, onClose, onCreate, creating, error }) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [recurring, setRecurring] = useState(false);
  const [availableTags, setAvailableTags] = useState([]);
  const [selectedTags, setSelectedTags] = useState([]);
  const [newTagName, setNewTagName] = useState("");

  useEffect(() => {
    if (!supabaseId) return;
    getTags(supabaseId).then(setAvailableTags).catch(() => setAvailableTags([]));
  }, [supabaseId]);

  function toggleTag(name) {
    setSelectedTags((current) =>
      current.includes(name) ? current.filter((t) => t !== name) : [...current, name]
    );
  }

  function addNewTag() {
    const name = newTagName.trim();
    if (!name || selectedTags.includes(name)) return;
    setSelectedTags((current) => [...current, name]);
    setNewTagName("");
  }

  function submit(e) {
    e.preventDefault();
    if (!title.trim()) return;
    onCreate({
      title,
      description: description.trim() || undefined,
      tags: selectedTags,
      dueDate: dueDate || undefined,
      recurring,
    });
  }

  return (
    <div className="task-modal-backdrop" role="presentation" onMouseDown={onClose}>
      <div
        className="task-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="create-task-title"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <button className="task-modal-close" onClick={onClose} aria-label="Close">
          <X size={20} />
        </button>
        <h2 id="create-task-title">Create task</h2>

        <form className="task-form" onSubmit={submit}>
          <label>
            Task name
            <input value={title} onChange={(e) => setTitle(e.target.value)} required autoFocus />
          </label>

          <label>
            Description
            <textarea rows={3} value={description} onChange={(e) => setDescription(e.target.value)} />
          </label>

          <div className="task-form-row">
            <label>
              Due date
              <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
            </label>
            <label className="task-form-recurring">
              <input
                type="checkbox"
                checked={recurring}
                onChange={(e) => setRecurring(e.target.checked)}
              />
              Repeat daily
            </label>
          </div>

          <fieldset className="task-tag-picker">
            <legend>Tags</legend>

            {availableTags.length > 0 && (
              <div className="task-tag-options">
                {availableTags.map((tag) => (
                  <button
                    type="button"
                    key={tag.id}
                    className={`task-tag-option ${
                      selectedTags.includes(tag.name) ? "task-tag-option-selected" : ""
                    }`}
                    onClick={() => toggleTag(tag.name)}
                  >
                    {tag.name}
                  </button>
                ))}
              </div>
            )}

            <div className="task-tag-new">
              <input
                type="text"
                placeholder="New tag…"
                value={newTagName}
                onChange={(e) => setNewTagName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addNewTag();
                  }
                }}
              />
              <button type="button" onClick={addNewTag}>Add</button>
            </div>

            {selectedTags.length > 0 && (
              <div className="task-tag-selected">
                {selectedTags.map((name) => (
                  <span key={name} className="task-tag">
                    {name}
                    <button type="button" onClick={() => toggleTag(name)} aria-label={`Remove ${name}`}>
                      <X size={12} />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </fieldset>

          {error && <p className="task-api-error">{error}</p>}

          <button className="task-form-submit" type="submit" disabled={creating || !title.trim()}>
            {creating ? "Creating…" : "Create task"}
          </button>
        </form>
      </div>
    </div>
  );
}
