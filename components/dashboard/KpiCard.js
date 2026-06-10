export default function KpiCard({ label, value, helper, tone = "blue" }) {
  return (
    <article className={`kpi-card tone-${tone}`}>
      <div className="kpi-card-glow" />

      <div className="kpi-card-top">
        <span>{label}</span>
        <i />
      </div>

      <strong>{value}</strong>

      {helper && <p>{helper}</p>}
    </article>
  );
}