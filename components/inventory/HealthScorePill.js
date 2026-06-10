export default function HealthScorePill({ score, status }) {
  const value = typeof score === "number" ? score : 100;

  return (
    <div className={`health-pill health-${status || "EXCELLENT"}`}>
      <span>{value}</span>
      <div>
        <strong>{status || "EXCELLENT"}</strong>
        <i>
          <b style={{ width: `${value}%` }} />
        </i>
      </div>
    </div>
  );
}