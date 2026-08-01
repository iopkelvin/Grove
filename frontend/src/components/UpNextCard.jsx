export default function UpNextCard({ task }) {
  return (
    <div className="card">
      <p>Up Next</p>
      <p>{task ? task.title : "All caught up!"}</p>
    </div>
  );
}