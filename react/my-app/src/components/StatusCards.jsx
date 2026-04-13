function StatusCards({ checkpoint, intent, orbitSpeed, contrast }) {
  const cards = [
    { label: "Checkpoint", value: checkpoint },
    { label: "Intent", value: intent },
    { label: "Orbit Speed", value: `${orbitSpeed.toFixed(2)}x` },
    { label: "Contrast", value: contrast.toFixed(2) },
  ];

  return (
    <div className="stats-grid">
      {cards.map((card) => (
        <div className="stat-card" key={card.label}>
          <span>{card.label}</span>
          <strong>{card.value}</strong>
        </div>
      ))}
    </div>
  );
}

export default StatusCards;
