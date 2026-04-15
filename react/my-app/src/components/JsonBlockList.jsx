import { useMemo, useState } from "react";

function JsonBlockList({
  blocks,
  selectedBlockId,
  onSelect,
  onDuplicate,
  onDelete,
  onPrepareBind,
}) {
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [tagFilter, setTagFilter] = useState("all");
  const [sourceFilter, setSourceFilter] = useState("all");

  const categories = useMemo(
    () => ["all", ...new Set(blocks.map((block) => block.category).filter(Boolean))],
    [blocks]
  );

  const tags = useMemo(
    () => ["all", ...new Set(blocks.flatMap((block) => block.tags || []).filter(Boolean))],
    [blocks]
  );

  const visibleBlocks = useMemo(() => {
    return blocks.filter((block) => {
      const source = block.sourceMeta?.source || "manual";
      const text = `${block.name} ${block.description} ${block.category} ${(block.tags || []).join(" ")} ${source} ${block.conversationId || ""} ${block.linkedTrackId || ""}`.toLowerCase();
      const matchesSearch = text.includes(search.toLowerCase());
      const matchesCategory = categoryFilter === "all" || block.category === categoryFilter;
      const matchesTag = tagFilter === "all" || block.tags?.includes(tagFilter);
      const matchesSource = sourceFilter === "all" || source === sourceFilter;
      return matchesSearch && matchesCategory && matchesTag && matchesSource;
    });
  }, [blocks, categoryFilter, search, sourceFilter, tagFilter]);

  return (
    <div className="json-block-list">
      <div className="library-filters">
        <input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search blocks"
        />
        <select value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value)}>
          {categories.map((category) => (
            <option key={category} value={category}>
              {category}
            </option>
          ))}
        </select>
        <select value={tagFilter} onChange={(event) => setTagFilter(event.target.value)}>
          {tags.map((tag) => (
            <option key={tag} value={tag}>
              {tag}
            </option>
          ))}
        </select>
        <select value={sourceFilter} onChange={(event) => setSourceFilter(event.target.value)}>
          <option value="all">all sources</option>
          <option value="producer.ai">producer.ai</option>
          <option value="manual">manual</option>
        </select>
      </div>

      <div className="library-list-items">
        {visibleBlocks.map((block) => (
          <div
            key={block.id}
            className={`library-block-card ${selectedBlockId === block.id ? "active" : ""}`}
            draggable
            onDragStart={(event) => {
              event.dataTransfer.setData("text/plain", block.id);
            }}
            onClick={() => onSelect(block.id)}
          >
            <div className="library-block-head">
              <div className="library-block-title">
                <span className="block-color-dot" style={{ backgroundColor: block.ui.color }} />
                <strong>{block.name}</strong>
              </div>
              <span className="library-block-category">{block.category}</span>
            </div>
            <p>{block.description}</p>
            <div className="library-provenance-row">
              <span className={`library-source-pill source-${normalizeSourceLabel(block.sourceMeta?.source)}`}>
                {block.sourceMeta?.source || "manual"}
              </span>
              {block.conversationId ? (
                <span className="library-meta-pill">conv {shortId(block.conversationId)}</span>
              ) : null}
              {block.linkedTrackId ? (
                <span className="library-meta-pill">track {shortId(block.linkedTrackId)}</span>
              ) : null}
              {block.sourceMeta?.toolName ? (
                <span className="library-meta-pill">{block.sourceMeta.toolName}</span>
              ) : null}
            </div>
            <div className="library-tag-row">
              {(block.tags || []).map((tag) => (
                <span key={tag} className="library-tag-pill" style={buildTagStyle(tag)}>
                  {tag}
                </span>
              ))}
            </div>
            <div className="library-block-actions">
              <button onClick={(event) => { event.stopPropagation(); onDuplicate(block.id); }}>Duplicate</button>
              <button onClick={(event) => { event.stopPropagation(); onPrepareBind("block", block.id); }}>Bind</button>
              <button onClick={(event) => { event.stopPropagation(); onDelete(block.id); }}>Delete</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function shortId(value) {
  return String(value || "").slice(0, 8);
}

function normalizeSourceLabel(value) {
  return String(value || "manual").replace(/[^a-z0-9]+/gi, "-").toLowerCase();
}

function buildTagStyle(tag) {
  const value = String(tag || "");
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) >>> 0;
  }
  const hue = hash % 360;
  return {
    backgroundColor: `hsla(${hue}, 72%, 56%, 0.2)`,
    borderColor: `hsla(${hue}, 75%, 64%, 0.38)`,
    color: `hsl(${hue}, 88%, 86%)`,
  };
}

export default JsonBlockList;
