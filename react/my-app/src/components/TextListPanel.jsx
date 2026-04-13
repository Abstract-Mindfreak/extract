function TextListPanel({ className = "", items, emptyText }) {
  return (
    <div className={className}>
      {(items.length ? items : [emptyText]).map((item) => (
        <div className={className === "checkpoint-list" ? "checkpoint-item" : "log-item"} key={item}>
          {item}
        </div>
      ))}
    </div>
  );
}

export default TextListPanel;
