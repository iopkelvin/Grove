import { Plus } from "lucide-react";

export default function CreateTaskCard({ onCreate, className = "" }) {
  return (
    <div className={`card create-task-card ${className}`.trim()}>
      <button type="button" className="create-task-button" onClick={onCreate}>
        <Plus size={16} />
        New task
      </button>
    </div>
  );
}
