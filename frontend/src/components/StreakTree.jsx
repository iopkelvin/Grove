export default function StreakTree({ streak = 0 }) {
  return (
    <div className="streak-column">
      <p>Your Streak:</p>
      <span className="streak-number">{streak}</span>
    </div>
  );
}