export default function RiskRadar({ risks }) {
  return (
    <section className="dash-home-panel">
      <div className="dash-panel-head">
        <div>
          <span className="dash-panel-kicker">Risk radar</span>
          <h2>Diqqət tələb edən inventarlar</h2>
        </div>

        <span className="dash-panel-badge">{risks.length} risk</span>
      </div>

      <div className="risk-list">
        {risks.length === 0 ? (
          <div className="empty-state">
            <strong>Risk tapılmadı</strong>
            <p>Hazırda kritik inventar xəbərdarlığı yoxdur.</p>
          </div>
        ) : (
          risks.map((item) => (
            <div className="risk-row" key={item.id}>
              <div className={`risk-icon ${item.tone}`}>{item.icon}</div>

              <div>
                <strong>{item.title}</strong>
                <p>{item.text}</p>
              </div>

              <span>{item.count}</span>
            </div>
          ))
        )}
      </div>
    </section>
  );
}