import React, { useEffect, useMemo, useRef, useState } from "react";
import { Layout, Model } from "flexlayout-react";
import {
  Album,
  Clapperboard,
  Database,
  ExternalLink,
  FileCode2,
  Library,
  ListMusic,
  MessageSquareText,
  Music2,
  Pause,
  Play,
  RefreshCw,
  SkipBack,
  SkipForward,
  Sparkles,
  Table2,
  Volume2,
  Waves,
} from "lucide-react";
import localMediaLibraryService from "../../services/LocalMediaLibraryService";
import flexLayoutWorkspaceService from "../../services/FlexLayoutWorkspaceService";
import { useArchivesWorkspaceStore } from "../../hooks/useArchivesWorkspaceStore";
import "./styles.css";

const CATEGORY_META = {
  tracks: { id: "tracks", label: "Треки", icon: Music2, empty: "Треки пока не загружены." },
  sessions: { id: "sessions", label: "Сессии", icon: MessageSquareText, empty: "Сессии пока не найдены." },
  spaces: { id: "spaces", label: "Пространства", icon: Waves, empty: "Пространства в текущем архиве не обнаружены." },
  music_videos: { id: "music_videos", label: "Видео", icon: Clapperboard, empty: "Сессии с видеогенерацией пока не найдены." },
  playlists: { id: "playlists", label: "Плейлисты", icon: ListMusic, empty: "Плейлист-связи в текущем архиве пока отсутствуют." },
};

const TRACK_TABLE_COLUMNS = [
  { id: "cover", label: "Обложка", sortable: false },
  { id: "title", label: "Название", sortable: true },
  { id: "created_at", label: "Дата", sortable: true },
  { id: "prompt", label: "Prompt", sortable: true },
  { id: "favorite_count", label: "Оценка", sortable: true },
  { id: "duration_s", label: "Длительность", sortable: true },
  { id: "actions", label: "Действия", sortable: false },
];

function buildLibraryLayout() {
  return {
    global: {
      tabEnableClose: false,
      tabSetEnableCloseButton: false,
      tabEnablePopout: false,
      splitterSize: 8,
    },
    borders: [
      {
        type: "border",
        location: "bottom",
        selected: 0,
        size: 148,
        children: [{ type: "tab", id: "local-media-player", name: "Плеер", component: "player" }],
      },
    ],
    layout: {
      type: "row",
      weight: 100,
      children: [
        {
          type: "tabset",
          id: "local-media-catalog-tabset",
          weight: 24,
          selected: 0,
          children: [{ type: "tab", id: "local-media-catalog", name: "Каталоги", component: "catalog" }],
        },
        {
          type: "tabset",
          id: "local-media-list-tabset",
          weight: 38,
          selected: 0,
          children: [
            { type: "tab", id: "local-media-list", name: "Карточки", component: "list" },
            { type: "tab", id: "local-media-table", name: "Таблица треков", component: "table" },
          ],
        },
        {
          type: "tabset",
          id: "local-media-detail-tabset",
          weight: 38,
          selected: 0,
          children: [{ type: "tab", id: "local-media-detail", name: "Детали", component: "detail" }],
        },
      ],
    },
  };
}

export default function ArchivesPage() {
  const workspaceStore = useArchivesWorkspaceStore();
  const [layoutModel, setLayoutModel] = useState(() =>
    Model.fromJson(workspaceStore.layoutSnapshot || buildLibraryLayout())
  );
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [summary, setSummary] = useState({});
  const [tracks, setTracks] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [category, setCategory] = useState("tracks");
  const [search, setSearch] = useState("");
  const [selectedItem, setSelectedItem] = useState(null);
  const [detail, setDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [currentTrack, setCurrentTrack] = useState(null);
  const [sortConfig, setSortConfig] = useState({ key: "created_at", direction: "desc" });

  useEffect(() => {
    void refreshLibrary(true);
  }, []);

  useEffect(() => {
    let cancelled = false;

    const hydrateLayout = async () => {
      const resolved = await flexLayoutWorkspaceService.loadEffectiveLayout({
        workspaceId: "local_media_library",
        fallbackLayout: buildLibraryLayout(),
        legacySnapshot: workspaceStore.layoutSnapshot,
      });
      if (!cancelled && resolved?.layoutJson) {
        setLayoutModel(Model.fromJson(resolved.layoutJson));
        workspaceStore.setLayoutSnapshot(resolved.layoutJson);
      }
    };

    void hydrateLayout();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(
    () =>
      flexLayoutWorkspaceService.subscribe((event) => {
        if (event.workspaceId !== "local_media_library") return;

        if (event.type === "apply" && event.layoutJson) {
          setLayoutModel(Model.fromJson(event.layoutJson));
          workspaceStore.setLayoutSnapshot(event.layoutJson);
        }

        if (event.type === "reset") {
          const nextLayout = buildLibraryLayout();
          setLayoutModel(Model.fromJson(nextLayout));
          workspaceStore.setLayoutSnapshot(nextLayout);
        }
      }),
    []
  );

  useEffect(() => {
    const currentItems = getCategoryItems(category, tracks, sessions);
    if (!currentItems.length) {
      setSelectedItem(null);
      setDetail(null);
      return;
    }

    const filteredItems = filterItems(currentItems, search, category);
    const activeList = filteredItems.length ? filteredItems : currentItems;
    const stillExists = activeList.some((item) => item.id === selectedItem?.id);

    if (!stillExists) {
      setSelectedItem(activeList[0]);
    }
  }, [category, search, selectedItem?.id, sessions, tracks]);

  useEffect(() => {
    if (!selectedItem) {
      setDetail(null);
      return;
    }
    void loadDetail(selectedItem);
  }, [selectedItem]);

  async function refreshLibrary(initial = false) {
    setError("");
    if (initial) {
      setIsLoading(true);
    } else {
      setIsRefreshing(true);
    }

    try {
      const [nextSummary, nextTracks, nextSessions] = await Promise.all([
        localMediaLibraryService.loadSummary(),
        localMediaLibraryService.loadTracks(),
        localMediaLibraryService.loadSessions(),
      ]);
      setSummary(nextSummary || {});
      setTracks(Array.isArray(nextTracks) ? nextTracks : []);
      setSessions(Array.isArray(nextSessions) ? nextSessions : []);
    } catch (loadError) {
      setError(loadError.message || "Не удалось загрузить медиатеку.");
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }

  async function loadDetail(item) {
    setDetailLoading(true);
    try {
      if (item.entityType === "session") {
        const payload = await localMediaLibraryService.loadSessionDetail(item.id);
        setDetail({ entityType: "session", ...payload });
      } else {
        const payload = await localMediaLibraryService.loadTrackDetail(item.id);
        setDetail({ entityType: "track", payload });
      }
    } catch (detailError) {
      setDetail({ entityType: item.entityType, error: detailError.message || "Не удалось загрузить детали." });
    } finally {
      setDetailLoading(false);
    }
  }

  const categoryItems = useMemo(
    () => filterItems(getCategoryItems(category, tracks, sessions), search, category),
    [category, search, sessions, tracks]
  );

  const tableTracks = useMemo(() => {
    const baseTracks = filterItems(getCategoryItems(category, tracks, sessions), search, category).filter(
      (item) => item.entityType === "track"
    );
    return sortTrackItems(baseTracks, sortConfig);
  }, [category, search, sessions, sortConfig, tracks]);

  const factory = (node) => {
    const component = node.getComponent();
    if (component === "catalog") {
      return (
        <CatalogPanel
          category={category}
          isRefreshing={isRefreshing}
          onRefresh={() => refreshLibrary(false)}
          search={search}
          setCategory={setCategory}
          setSearch={setSearch}
          summary={summary}
        />
      );
    }

    if (component === "list") {
      return <ListPanel category={category} items={categoryItems} selectedItem={selectedItem} setSelectedItem={setSelectedItem} />;
    }

    if (component === "table") {
      return (
        <TrackTablePanel
          category={category}
          currentTrack={currentTrack}
          items={tableTracks}
          selectedItem={selectedItem}
          setCurrentTrack={setCurrentTrack}
          setSelectedItem={setSelectedItem}
          sortConfig={sortConfig}
          setSortConfig={setSortConfig}
        />
      );
    }

    if (component === "player") {
      return <PlayerPanel currentTrack={currentTrack} setCurrentTrack={setCurrentTrack} tracks={tableTracks} />;
    }

    return <DetailPanel category={category} detail={detail} detailLoading={detailLoading} selectedItem={selectedItem} />;
  };

  return (
    <div className="archives-page local-media-library-page">
      <header className="archives-header local-media-library-header">
        <div className="archives-header__copy">
          <span className="local-media-library-header__eyebrow">LocalMediaLibrary</span>
          <h1>Локальная Медиатека</h1>
          <p>
            Прямой просмотр архива из PostgreSQL: треки, сессии, видеогенерации, связи и JSON-фрагменты без упрощения
            текстов.
          </p>
        </div>
        <div className="header-actions">
          <button className="btn-secondary" onClick={() => refreshLibrary(false)} disabled={isLoading || isRefreshing}>
            <RefreshCw size={14} />
            <span>{isRefreshing ? "Обновление..." : "Обновить"}</span>
          </button>
        </div>
      </header>

      {isLoading ? (
        <div className="loading-state">
          <div className="spinner" />
          <p>Загрузка данных из abstract-mind-lab...</p>
        </div>
      ) : error ? (
        <div className="empty-state">
          <div className="empty-icon">×</div>
          <h3>Ошибка загрузки</h3>
          <p>{error}</p>
          <button className="btn-primary" onClick={() => refreshLibrary(false)}>
            Повторить
          </button>
        </div>
      ) : (
        <div className="local-media-library-shell flexlayout__theme_dark">
          <Layout
            factory={factory}
            model={layoutModel}
            onModelChange={(nextModel) => {
              const nextJson = nextModel.toJson();
              workspaceStore.setLayoutSnapshot(nextJson);
              void flexLayoutWorkspaceService.persistAutoLayout({
                workspaceId: "local_media_library",
                layoutJson: nextJson,
              });
            }}
            onRenderTab={(node, renderValues) => {
              const icons = {
                "local-media-catalog": <Library size={14} />,
                "local-media-list": <Album size={14} />,
                "local-media-table": <Table2 size={14} />,
                "local-media-detail": <FileCode2 size={14} />,
                "local-media-player": <Music2 size={14} />,
              };
              renderValues.leading = icons[node.getId()] || null;
            }}
          />
        </div>
      )}
    </div>
  );
}

function CatalogPanel({ category, isRefreshing, onRefresh, search, setCategory, setSearch, summary }) {
  const categoryCounts = {
    tracks: Number(summary.tracks || 0),
    sessions: Number(summary.sessions || 0),
    spaces: Number(summary.spaces || 0),
    music_videos: Number(summary.music_videos || 0),
    playlists: Number(summary.playlists || 0),
  };

  return (
    <div className="local-media-panel">
      <div className="local-media-panel__header">
        <div>
          <strong>Каталоги</strong>
          <span>Группы данных и быстрый фильтр по медиатеке.</span>
        </div>
        <button className="local-media-icon-button" onClick={onRefresh} title="Обновить" disabled={isRefreshing}>
          <RefreshCw size={14} />
        </button>
      </div>

      <div className="local-media-summary-grid">
        <MetricCard icon={Music2} label="Треки" value={summary.tracks || 0} />
        <MetricCard icon={MessageSquareText} label="Сессии" value={summary.sessions || 0} />
        <MetricCard icon={Clapperboard} label="Видео" value={summary.music_videos || 0} />
        <MetricCard icon={Sparkles} label="Flows" value={summary.flows || 0} />
      </div>

      <div className="local-media-search-card">
        <label htmlFor="local-media-search">Поиск</label>
        <input
          id="local-media-search"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Название, prompt, session id, tool..."
          type="text"
        />
      </div>

      <div className="local-media-category-list">
        {Object.values(CATEGORY_META).map((entry) => {
          const Icon = entry.icon;
          return (
            <button
              key={entry.id}
              className={`local-media-category-item ${category === entry.id ? "is-active" : ""}`}
              onClick={() => setCategory(entry.id)}
            >
              <span className="local-media-category-item__icon">
                <Icon size={16} />
              </span>
              <span className="local-media-category-item__copy">
                <strong>{entry.label}</strong>
                <small>{categoryCounts[entry.id] || 0}</small>
              </span>
            </button>
          );
        })}
      </div>

      <div className="local-media-footnote">
        <Database size={14} />
        <span>Источник: `abstract-mind-lab`</span>
      </div>
    </div>
  );
}

function ListPanel({ category, items, selectedItem, setSelectedItem }) {
  const meta = CATEGORY_META[category];

  return (
    <div className="local-media-panel">
      <div className="local-media-panel__header">
        <div>
          <strong>{meta.label}</strong>
          <span>{items.length} элементов в текущем представлении.</span>
        </div>
      </div>

      {items.length === 0 ? (
        <div className="local-media-empty-panel">
          <p>{meta.empty}</p>
        </div>
      ) : (
        <div className="local-media-list">
          {items.map((item) => (
            <button
              key={`${item.entityType}:${item.id}`}
              className={`local-media-list-item ${selectedItem?.id === item.id ? "is-selected" : ""}`}
              onClick={() => setSelectedItem(item)}
            >
              <div className="local-media-list-item__head">
                <strong>{item.title || item.id}</strong>
                <span className="local-media-list-item__date">{formatDateTime(item.updated_at || item.created_at)}</span>
              </div>
              <div className="local-media-list-item__meta">
                {item.entityType === "track" ? (
                  <>
                    <Tag tone="cyan">{item.op_type || item.generation_mode || "track"}</Tag>
                    <Tag tone={item.privacy_status === "public" ? "green" : "amber"}>{item.privacy_status || "private"}</Tag>
                    {item.video_job_id ? <Tag tone="pink">video job</Tag> : null}
                    {Number(item.lyrics_marker_count || 0) > 0 ? <Tag tone="violet">{item.lyrics_marker_count} lyric marks</Tag> : null}
                  </>
                ) : (
                  <>
                    <Tag tone="blue">{item.message_count || 0} сообщений</Tag>
                    {Number(item.flow_count || 0) > 0 ? <Tag tone="violet">{item.flow_count} flows</Tag> : null}
                    {Number(item.memory_count || 0) > 0 ? <Tag tone="green">{item.memory_count} memories</Tag> : null}
                    {item.has_video_tool ? <Tag tone="pink">video tools</Tag> : null}
                  </>
                )}
              </div>
              <p className="local-media-list-item__excerpt">{item.prompt || item.title || item.id}</p>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function TrackTablePanel({
  category,
  currentTrack,
  items,
  selectedItem,
  setCurrentTrack,
  setSelectedItem,
  sortConfig,
  setSortConfig,
}) {
  const isTrackMode = ["tracks", "spaces", "playlists"].includes(category);

  const handleSort = (key) => {
    setSortConfig((current) => ({
      key,
      direction: current.key === key && current.direction === "asc" ? "desc" : "asc",
    }));
  };

  return (
    <div className="local-media-panel">
      <div className="local-media-panel__header">
        <div>
          <strong>Таблица треков</strong>
          <span>Обложки, сортировка, быстрый запуск воспроизведения и переход к деталям.</span>
        </div>
      </div>

      {!isTrackMode ? (
        <div className="local-media-empty-panel">
          <p>Табличный вид доступен для трековых категорий: Треки, Пространства и Плейлисты.</p>
        </div>
      ) : !items.length ? (
        <div className="local-media-empty-panel">
          <p>В текущей категории нет треков для табличного отображения.</p>
        </div>
      ) : (
        <div className="local-media-table-shell">
          <div className="local-media-table-scroll">
            <table className="local-media-track-table">
              <thead>
                <tr>
                  {TRACK_TABLE_COLUMNS.map((column) => (
                    <th
                      key={column.id}
                      className={column.sortable ? "is-sortable" : ""}
                      onClick={column.sortable ? () => handleSort(column.id) : undefined}
                    >
                      <span>{column.label}</span>
                      {column.sortable ? <small>{getSortMarker(sortConfig, column.id)}</small> : null}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {items.map((track) => {
                  const isSelected = selectedItem?.id === track.id;
                  const isPlaying = currentTrack?.id === track.id;
                  return (
                    <tr
                      key={track.id}
                      className={`${isSelected ? "is-selected" : ""} ${isPlaying ? "is-playing" : ""}`}
                      onClick={() => setSelectedItem(track)}
                    >
                      <td>
                        <button
                          className="local-media-table-cover"
                          onClick={(event) => {
                            event.stopPropagation();
                            setCurrentTrack(normalizePlayableTrack(track));
                          }}
                          title="Воспроизвести"
                        >
                          <img src={track.image_url || "/default-cover.png"} alt={track.title || track.id} />
                          <span className="local-media-table-cover__overlay">
                            {isPlaying ? <Pause size={16} /> : <Play size={16} />}
                          </span>
                        </button>
                      </td>
                      <td>
                        <div className="local-media-table-title">
                          <strong>{track.title || track.id}</strong>
                          <span>{track.op_type || track.generation_mode || "track"}</span>
                        </div>
                      </td>
                      <td>{formatDateTime(track.created_at)}</td>
                      <td>
                        <div className="local-media-table-prompt">{track.prompt || "—"}</div>
                      </td>
                      <td>{track.favorite_count ?? 0}</td>
                      <td>{formatSeconds(track.duration_s)}</td>
                      <td>
                        <div className="local-media-table-actions">
                          <button
                            className="local-media-mini-button"
                            onClick={(event) => {
                              event.stopPropagation();
                              setCurrentTrack(normalizePlayableTrack(track));
                            }}
                          >
                            {isPlaying ? "Пауза" : "Слушать"}
                          </button>
                          <button
                            className="local-media-mini-button"
                            onClick={(event) => {
                              event.stopPropagation();
                              setSelectedItem(track);
                            }}
                          >
                            Детали
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

function DetailPanel({ category, detail, detailLoading, selectedItem }) {
  return (
    <div className="local-media-panel local-media-panel--detail">
      <div className="local-media-panel__header">
        <div>
          <strong>Детали</strong>
          <span>{selectedItem ? "Подробный просмотр без сокращения текста и JSON." : `Выберите элемент из раздела ${CATEGORY_META[category].label}.`}</span>
        </div>
      </div>

      {!selectedItem ? (
        <div className="local-media-empty-panel">
          <p>Ничего не выбрано.</p>
        </div>
      ) : detailLoading ? (
        <div className="local-media-empty-panel">
          <div className="spinner" />
          <p>Загрузка деталей...</p>
        </div>
      ) : detail?.error ? (
        <div className="local-media-empty-panel">
          <p>{detail.error}</p>
        </div>
      ) : detail?.entityType === "track" ? (
        <TrackDetailView payload={detail.payload} />
      ) : (
        <SessionDetailView payload={detail?.payload} tracks={detail?.tracks || []} />
      )}
    </div>
  );
}

function TrackDetailView({ payload }) {
  if (!payload) {
    return (
      <div className="local-media-empty-panel">
        <p>Детали трека отсутствуют.</p>
      </div>
    );
  }

  const rawTrack = payload.raw_data?.raw_track || {};
  const sessionSnapshot = payload.raw_data?.session_snapshot || null;
  const videoPageUrl = payload.video_job_id ? `https://www.flowmusic.app/video/${payload.video_job_id}` : "";

  return (
    <div className="local-media-detail">
      <div className="local-media-hero">
        <div className="local-media-hero__copy">
          <span className="local-media-hero__eyebrow">Track</span>
          <h2>{payload.title || payload.id}</h2>
          <div className="local-media-chip-row">
            <Tag tone="cyan">{rawTrack.op_type || payload.generation_mode || "track"}</Tag>
            <Tag tone={payload.privacy_status === "public" ? "green" : "amber"}>{payload.privacy_status || "private"}</Tag>
            {payload.model_name ? <Tag tone="violet">{payload.model_name}</Tag> : null}
            {payload.video_job_id ? <Tag tone="pink">video job</Tag> : null}
          </div>
        </div>
        <div className="local-media-link-group">
          <ExternalAnchor href={`https://www.flowmusic.app/song/${payload.id}`} label="Страница трека" />
          {videoPageUrl ? <ExternalAnchor href={videoPageUrl} label="Страница видео" /> : null}
          {payload.session_id ? <ExternalAnchor href={`https://www.flowmusic.app/session/${payload.session_id}`} label="Сессия" /> : null}
        </div>
      </div>

      <div className="local-media-stat-grid">
        <DataStat label="Длительность" value={formatSeconds(payload.duration_s)} />
        <DataStat label="Прослушивания" value={payload.play_count ?? 0} />
        <DataStat label="Избранное" value={payload.favorite_count ?? 0} />
        <DataStat label="Таймкоды лирики" value={Array.isArray(payload.lyrics_timestamped) ? payload.lyrics_timestamped.length : 0} />
      </div>

      {payload.prompt ? (
        <DetailSection title="Prompt">
          <RichTextBlock text={payload.prompt} />
        </DetailSection>
      ) : null}

      {rawTrack.operation?.sound_prompt ? (
        <DetailSection title="Sound Prompt операции">
          <RichTextBlock text={rawTrack.operation.sound_prompt} />
        </DetailSection>
      ) : null}

      {sessionSnapshot ? (
        <DetailSection title="Связанный session snapshot">
          <div className="local-media-inline-meta">
            <span>ID: {sessionSnapshot.id}</span>
            <span>Название: {sessionSnapshot.title || "—"}</span>
          </div>
        </DetailSection>
      ) : null}

      <DetailSection title="Raw Track JSON">
        <JsonBlock value={rawTrack} />
      </DetailSection>

      {sessionSnapshot ? (
        <DetailSection title="Session Snapshot JSON">
          <JsonBlock value={sessionSnapshot} />
        </DetailSection>
      ) : null}
    </div>
  );
}

function SessionDetailView({ payload, tracks }) {
  if (!payload) {
    return (
      <div className="local-media-empty-panel">
        <p>Детали сессии отсутствуют.</p>
      </div>
    );
  }

  const aiSnapshot = payload.ai_snapshot || {};
  const sessionPayload = aiSnapshot.payload || {};
  const messages = Array.isArray(sessionPayload.messages) ? sessionPayload.messages : [];
  const snapshotString = JSON.stringify(aiSnapshot);
  const hasVideoWorkflow =
    snapshotString.includes("video__create_music_video") || snapshotString.includes("video__propose_music_video");

  return (
    <div className="local-media-detail">
      <div className="local-media-hero">
        <div className="local-media-hero__copy">
          <span className="local-media-hero__eyebrow">Session</span>
          <h2>{payload.title || payload.id}</h2>
          <div className="local-media-chip-row">
            <Tag tone="blue">{messages.length} сообщений</Tag>
            {Array.isArray(aiSnapshot.applied_flows) && aiSnapshot.applied_flows.length ? <Tag tone="violet">{aiSnapshot.applied_flows.length} flows</Tag> : null}
            {Array.isArray(aiSnapshot.memories_applied) && aiSnapshot.memories_applied.length ? <Tag tone="green">{aiSnapshot.memories_applied.length} memories</Tag> : null}
            {hasVideoWorkflow ? <Tag tone="pink">video workflow</Tag> : null}
          </div>
        </div>
        <div className="local-media-link-group">
          <ExternalAnchor href={`https://www.flowmusic.app/session/${payload.id}`} label="Открыть сессию" />
        </div>
      </div>

      {tracks.length ? (
        <DetailSection title="Связанные треки">
          <div className="local-media-related-list">
            {tracks.map((track) => (
              <div key={track.id} className="local-media-related-item">
                <strong>{track.title || track.id}</strong>
                <div className="local-media-chip-row">
                  <Tag tone={track.privacy_status === "public" ? "green" : "amber"}>{track.privacy_status || "private"}</Tag>
                  {track.video_job_id ? <Tag tone="pink">video job</Tag> : null}
                  <Tag tone="cyan">{formatSeconds(track.duration_s)}</Tag>
                </div>
              </div>
            ))}
          </div>
        </DetailSection>
      ) : null}

      <DetailSection title="Диалог">
        <div className="local-media-message-list">
          {messages.map((message, index) => (
            <MessageCard key={`${payload.id}:${index}`} message={message} />
          ))}
        </div>
      </DetailSection>

      <DetailSection title="AI Snapshot JSON">
        <JsonBlock value={aiSnapshot} />
      </DetailSection>

      {payload.config ? (
        <DetailSection title="Config JSON">
          <JsonBlock value={payload.config} />
        </DetailSection>
      ) : null}
    </div>
  );
}

function PlayerPanel({ currentTrack, setCurrentTrack, tracks }) {
  const audioRef = useRef(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);

  useEffect(() => {
    let cancelled = false;

    async function syncTrackPlayback() {
      if (!currentTrack || !audioRef.current || !currentTrack.audioUrl) {
        setIsPlaying(false);
        setCurrentTime(0);
        setDuration(0);
        return;
      }

      const audio = audioRef.current;
      if (audio.src !== currentTrack.audioUrl) {
        audio.pause();
        audio.src = currentTrack.audioUrl;
        audio.load();
      }

      try {
        await audio.play();
        if (!cancelled) {
          setIsPlaying(true);
        }
      } catch (_error) {
        if (!cancelled) {
          setIsPlaying(false);
        }
      }
    }

    void syncTrackPlayback();

    return () => {
      cancelled = true;
    };
  }, [currentTrack]);

  const playAdjacent = (step) => {
    if (!currentTrack || !tracks.length) return;
    const playableTracks = tracks.filter((track) => track.audio_url_local);
    if (!playableTracks.length) return;
    const currentIndex = playableTracks.findIndex((track) => track.id === currentTrack.id);
    const nextIndex = currentIndex < 0 ? 0 : (currentIndex + step + playableTracks.length) % playableTracks.length;
    setCurrentTrack(normalizePlayableTrack(playableTracks[nextIndex]));
  };

  const togglePlay = async () => {
    if (!audioRef.current || !currentTrack?.audioUrl) return;
    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
      return;
    }
    try {
      await audioRef.current.play();
      setIsPlaying(true);
    } catch {
      setIsPlaying(false);
    }
  };

  if (!currentTrack) {
    return (
      <div className="local-media-player local-media-player--empty">
        <Music2 size={18} />
        <span>Выберите трек в таблице или карточках, чтобы включить воспроизведение.</span>
      </div>
    );
  }

  return (
    <div className="local-media-player">
      <audio
        ref={audioRef}
        onEnded={() => playAdjacent(1)}
        onLoadedMetadata={() => setDuration(audioRef.current?.duration || 0)}
        onTimeUpdate={() => setCurrentTime(audioRef.current?.currentTime || 0)}
      />

      <div className="local-media-player__track">
        <img src={currentTrack.coverUrl || "/default-cover.png"} alt={currentTrack.title || currentTrack.id} />
        <div>
          <strong>{currentTrack.title || currentTrack.id}</strong>
          <span>{currentTrack.prompt || "Без prompt"}</span>
        </div>
      </div>

      <div className="local-media-player__controls">
        <button className="local-media-player__button" onClick={() => playAdjacent(-1)}>
          <SkipBack size={16} />
        </button>
        <button className="local-media-player__button local-media-player__button--primary" onClick={togglePlay}>
          {isPlaying ? <Pause size={18} /> : <Play size={18} />}
        </button>
        <button className="local-media-player__button" onClick={() => playAdjacent(1)}>
          <SkipForward size={16} />
        </button>
      </div>

      <div className="local-media-player__timeline">
        <span>{formatSeconds(currentTime)}</span>
        <input
          type="range"
          min={0}
          max={duration || currentTrack.durationSeconds || 0}
          step={0.1}
          value={Math.min(currentTime, duration || currentTrack.durationSeconds || 0)}
          onChange={(event) => {
            const nextTime = Number(event.target.value);
            if (audioRef.current) {
              audioRef.current.currentTime = nextTime;
              setCurrentTime(nextTime);
            }
          }}
        />
        <span>{formatSeconds(duration || currentTrack.durationSeconds || 0)}</span>
      </div>

      <div className="local-media-player__volume">
        <Volume2 size={16} />
        <input
          type="range"
          min={0}
          max={1}
          step={0.05}
          value={volume}
          onChange={(event) => {
            const nextVolume = Number(event.target.value);
            setVolume(nextVolume);
            if (audioRef.current) {
              audioRef.current.volume = nextVolume;
            }
          }}
        />
      </div>
    </div>
  );
}

function MessageCard({ message }) {
  const parts = Array.isArray(message.parts) ? message.parts : [];

  return (
    <article className="local-media-message-card">
      <div className="local-media-message-card__head">
        <div className="local-media-chip-row">
          <Tag tone={message.kind === "response" ? "blue" : "amber"}>{message.kind || "message"}</Tag>
          <Tag tone="slate">{formatDateTime(message.timestamp)}</Tag>
        </div>
      </div>

      <div className="local-media-message-card__body">
        {parts.map((part, index) => (
          <PartBlock key={`${message.timestamp || "part"}:${index}`} part={part} />
        ))}
      </div>
    </article>
  );
}

function PartBlock({ part }) {
  const tone = resolvePartTone(part);

  return (
    <div className="local-media-part-block">
      <div className="local-media-chip-row">
        <Tag tone={tone}>{part.part_kind || "part"}</Tag>
        {part.tool_name ? <Tag tone="pink">{part.tool_name}</Tag> : null}
        {part.timestamp ? <Tag tone="slate">{formatDateTime(part.timestamp)}</Tag> : null}
      </div>

      {typeof part.content === "string" ? <RichTextBlock text={part.content} /> : null}
      {part.args && typeof part.args === "object" ? <JsonBlock value={part.args} /> : null}
      {part.content && typeof part.content === "object" ? <JsonBlock value={part.content} /> : null}
      {typeof part.instructions === "string" && part.instructions.trim() ? <div className="local-media-inline-note">{part.instructions}</div> : null}
    </div>
  );
}

function MetricCard({ icon: Icon, label, value }) {
  return (
    <div className="local-media-metric-card">
      <div className="local-media-metric-card__icon">
        <Icon size={15} />
      </div>
      <div>
        <span>{label}</span>
        <strong>{value}</strong>
      </div>
    </div>
  );
}

function DataStat({ label, value }) {
  return (
    <div className="local-media-data-stat">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function DetailSection({ title, children }) {
  return (
    <section className="local-media-detail-section">
      <div className="local-media-detail-section__head">
        <strong>{title}</strong>
      </div>
      <div className="local-media-detail-section__body">{children}</div>
    </section>
  );
}

function Tag({ children, tone = "slate" }) {
  return <span className={`local-media-tag local-media-tag--${tone}`}>{children}</span>;
}

function ExternalAnchor({ href, label }) {
  return (
    <a className="local-media-link" href={href} target="_blank" rel="noreferrer">
      <ExternalLink size={14} />
      <span>{label}</span>
    </a>
  );
}

function RichTextBlock({ text }) {
  const normalized = String(text || "").replace(/\r\n/g, "\n").trim();
  if (!normalized) return null;

  const fencedJsonMatch = normalized.match(/```json\s*([\s\S]*?)```/i);
  if (fencedJsonMatch) {
    const before = normalized.slice(0, fencedJsonMatch.index).trim();
    const after = normalized.slice((fencedJsonMatch.index || 0) + fencedJsonMatch[0].length).trim();

    return (
      <div className="local-media-rich-text">
        {before ? <pre className="local-media-text-block">{before}</pre> : null}
        <JsonStringBlock text={fencedJsonMatch[1]} />
        {after ? <pre className="local-media-text-block">{after}</pre> : null}
      </div>
    );
  }

  if (looksLikeJson(normalized)) {
    return <JsonStringBlock text={normalized} />;
  }

  return <pre className="local-media-text-block">{normalized}</pre>;
}

function JsonStringBlock({ text }) {
  try {
    const parsed = JSON.parse(text);
    return <JsonBlock value={parsed} />;
  } catch {
    return <pre className="local-media-json-block">{text}</pre>;
  }
}

function JsonBlock({ value }) {
  return <pre className="local-media-json-block">{JSON.stringify(value, null, 2)}</pre>;
}

function resolvePartTone(part) {
  if (part.part_kind === "tool-call") return "pink";
  if (part.part_kind === "tool-return") return "violet";
  if (part.part_kind === "thinking") return "amber";
  if (part.part_kind === "user-prompt") return "blue";
  return "slate";
}

function looksLikeJson(value) {
  if (!value) return false;
  if (value[0] !== "{" && value[0] !== "[") return false;
  try {
    JSON.parse(value);
    return true;
  } catch {
    return false;
  }
}

function getCategoryItems(category, tracks, sessions) {
  if (category === "sessions") {
    return sessions.map((item) => ({ ...item, entityType: "session" }));
  }
  if (category === "spaces") {
    return tracks.filter((item) => item.is_space).map((item) => ({ ...item, entityType: "track" }));
  }
  if (category === "music_videos") {
    return sessions.filter((item) => item.has_video_tool).map((item) => ({ ...item, entityType: "session" }));
  }
  if (category === "playlists") {
    return tracks.filter((item) => Number(item.playlist_count || 0) > 0).map((item) => ({ ...item, entityType: "track" }));
  }
  return tracks.map((item) => ({ ...item, entityType: "track" }));
}

function filterItems(items, search, category) {
  const needle = String(search || "").trim().toLowerCase();
  if (!needle) return items;

  return items.filter((item) => {
    const haystacks =
      item.entityType === "track"
        ? [item.title, item.prompt, item.id, item.session_id, item.op_type, category]
        : [item.title, item.id, item.updated_at, item.created_at, category];
    return haystacks.some((value) => String(value || "").toLowerCase().includes(needle));
  });
}

function sortTrackItems(items, sortConfig) {
  const sorted = [...items];
  sorted.sort((left, right) => compareTrackValues(left, right, sortConfig));
  return sorted;
}

function compareTrackValues(left, right, sortConfig) {
  const { key, direction } = sortConfig;
  const factor = direction === "asc" ? 1 : -1;
  let a = left[key];
  let b = right[key];

  if (key === "created_at") {
    a = a ? new Date(a).getTime() : 0;
    b = b ? new Date(b).getTime() : 0;
  } else if (key === "duration_s" || key === "favorite_count") {
    a = Number(a || 0);
    b = Number(b || 0);
  } else {
    a = String(a || "").toLowerCase();
    b = String(b || "").toLowerCase();
  }

  if (a < b) return -1 * factor;
  if (a > b) return 1 * factor;
  return 0;
}

function getSortMarker(sortConfig, columnId) {
  if (sortConfig.key !== columnId) return "↕";
  return sortConfig.direction === "asc" ? "↑" : "↓";
}

function normalizePlayableTrack(track) {
  return {
    id: track.id,
    title: track.title,
    prompt: track.prompt,
    coverUrl: track.cover_url_local || track.image_url || "/default-cover.png",
    audioUrl: track.audio_url_local || "",
    durationSeconds: Number(track.duration_s || 0),
  };
}

function formatDateTime(value) {
  if (!value) return "—";
  try {
    return new Date(value).toLocaleString("ru-RU");
  } catch {
    return String(value);
  }
}

function formatSeconds(value) {
  const seconds = Number(value);
  if (!Number.isFinite(seconds) || seconds <= 0) return "—";
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${String(secs).padStart(2, "0")}`;
}
