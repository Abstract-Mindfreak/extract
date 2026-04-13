function AccordionSection({ title, subtitle, defaultOpen = false, children }) {
  return (
    <details className="accordion-panel" open={defaultOpen}>
      <summary>
        <div>
          <strong>{title}</strong>
          {subtitle ? <span>{subtitle}</span> : null}
        </div>
      </summary>
      <div className="accordion-content">{children}</div>
    </details>
  );
}

export default AccordionSection;
