function SectionCard({ title, subtitle, children, className = "", actions = null }) {
  return (
    <section className={`panel ${className}`.trim()}>
      <div className="panel-head">
        <strong>{title}</strong>
        <div className="panel-head-meta">
          {subtitle ? <span>{subtitle}</span> : null}
          {actions}
        </div>
      </div>
      {children}
    </section>
  );
}

export default SectionCard;
