export default function SmartSuggestions({ suggestions }) {
  return (
    <section className="dash-home-panel">
      <div className="dash-panel-head">
        <div>
          <span className="dash-panel-kicker">Smart suggestions</span>
          <h2>Sistemin tövsiyələri</h2>
        </div>
      </div>

      <div className="suggestion-list">
        {suggestions.map((item) => (
          <div className="suggestion-card" key={item.id}>
            <div className="suggestion-icon">{item.icon}</div>

            <div>
              <strong>{item.title}</strong>
              <p>{item.text}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}