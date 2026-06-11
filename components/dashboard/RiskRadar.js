"use client";

export default function RiskRadar({ risks = [] }) {
  const totalRisk = risks.reduce((sum, item) => sum + Number(item.count || 0), 0);

  return (
    <div className="dash-risk-radar">
      <div className="dash-risk-radar-head">
        <div>
          <span>Risk radar</span>
          <h3>Diqqət tələb edən inventarlar</h3>
        </div>

        <strong>{totalRisk} risk</strong>
      </div>

      {risks.length === 0 ? (
        <div className="dash-risk-empty">
          <strong>Risk yoxdur</strong>
          <p>Hazırda diqqət tələb edən inventar görünmür.</p>
        </div>
      ) : (
        <div className="dash-risk-list">
          {risks.map((risk) => (
            <div className={`dash-risk-item tone-${risk.tone || "blue"}`} key={risk.id}>
              <div className="dash-risk-icon">{risk.icon || "!"}</div>

              <div className="dash-risk-body">
                <strong>{risk.title}</strong>
                <p>{risk.text}</p>
              </div>

              <div className="dash-risk-count">{risk.count}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}