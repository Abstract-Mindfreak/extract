// Φ_total(ui:collapse) — сворачиваемая панель с памятью состояния
// Самоподобный компонент для всех панелей приложения

import React, { useState, useCallback } from 'react';

interface CollapsiblePanelProps {
  id: string;
  title: string;
  eyebrow?: string;
  badge?: string;
  badgeType?: 'default' | 'success' | 'warning' | 'error';
  children: React.ReactNode;
  defaultExpanded?: boolean;
  persistState?: boolean;
  headerActions?: React.ReactNode;
}

const STORAGE_PREFIX = 'mmss:panel:';

export const CollapsiblePanel: React.FC<CollapsiblePanelProps> = ({
  id,
  title,
  eyebrow,
  badge,
  badgeType = 'default',
  children,
  defaultExpanded = true,
  persistState = true,
  headerActions,
}) => {
  // Восстанавливаем состояние из localStorage
  const getInitialState = (): boolean => {
    if (!persistState) return defaultExpanded;
    try {
      const stored = localStorage.getItem(`${STORAGE_PREFIX}${id}`);
      return stored !== null ? JSON.parse(stored) : defaultExpanded;
    } catch {
      return defaultExpanded;
    }
  };

  const [isExpanded, setIsExpanded] = useState<boolean>(getInitialState);
  const [isAnimating, setIsAnimating] = useState(false);

  const toggle = useCallback(() => {
    setIsAnimating(true);
    const newState = !isExpanded;
    setIsExpanded(newState);
    
    if (persistState) {
      localStorage.setItem(`${STORAGE_PREFIX}${id}`, JSON.stringify(newState));
    }
    
    setTimeout(() => setIsAnimating(false), 300);
  }, [isExpanded, id, persistState]);

  const badgeStyles = {
    default: { background: '#2a2a4e', color: '#00d4aa' },
    success: { background: '#00d4aa', color: '#1a1a2e' },
    warning: { background: '#ffaa00', color: '#1a1a2e' },
    error: { background: '#ff4444', color: '#fff' },
  };

  return (
    <section 
      className={`panel collapsible-panel ${isExpanded ? 'expanded' : 'collapsed'}`}
      style={{
        marginBottom: '20px',
        transition: 'all 0.3s ease',
        opacity: isAnimating ? 0.8 : 1,
      }}
      data-panel-id={id}
    >
      {/* Header */}
      <div 
        className="panel-heading collapsible-header"
        onClick={toggle}
        style={{
          cursor: 'pointer',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '16px 20px',
          borderBottom: isExpanded ? '1px solid #333' : 'none',
          userSelect: 'none',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          {/* Collapse Icon */}
          <span 
            className="collapse-icon"
            style={{
              transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)',
              transition: 'transform 0.2s ease',
              fontSize: '0.8em',
              color: '#00d4aa',
            }}
          >
            ▶
          </span>
          
          <div>
            {eyebrow && <p className="eyebrow">{eyebrow}</p>}
            <h2 style={{ margin: 0, fontSize: '1.2em' }}>{title}</h2>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          {headerActions}
          
          {badge && (
            <span 
              className={`badge badge-${badgeType}`}
              style={{
                ...badgeStyles[badgeType],
                padding: '4px 10px',
                borderRadius: '12px',
                fontSize: '0.75em',
                fontWeight: 'bold',
              }}
            >
              {badge}
            </span>
          )}
        </div>
      </div>

      {/* Content */}
      <div 
        className="panel-content"
        style={{
          maxHeight: isExpanded ? '2000px' : '0',
          overflow: isExpanded ? 'auto' : 'hidden',
          transition: 'max-height 0.3s ease, opacity 0.3s ease',
          opacity: isExpanded ? 1 : 0,
        }}
      >
        <div style={{ padding: '20px' }}>
          {children}
        </div>
      </div>
    </section>
  );
};

// Хук для управления несколькими панелями
export function usePanelGroup(panelIds: string[]) {
  const [expandedPanels, setExpandedPanels] = useState<Set<string>>(() => {
    const initial = new Set<string>();
    panelIds.forEach(id => {
      const stored = localStorage.getItem(`${STORAGE_PREFIX}${id}`);
      if (stored === null || JSON.parse(stored)) {
        initial.add(id);
      }
    });
    return initial;
  });

  const expandAll = () => {
    setExpandedPanels(new Set(panelIds));
    panelIds.forEach(id => {
      localStorage.setItem(`${STORAGE_PREFIX}${id}`, 'true');
    });
  };

  const collapseAll = () => {
    setExpandedPanels(new Set());
    panelIds.forEach(id => {
      localStorage.setItem(`${STORAGE_PREFIX}${id}`, 'false');
    });
  };

  const expandOnly = (id: string) => {
    setExpandedPanels(new Set([id]));
    panelIds.forEach(pid => {
      localStorage.setItem(`${STORAGE_PREFIX}${pid}`, JSON.stringify(pid === id));
    });
  };

  return { expandedPanels, expandAll, collapseAll, expandOnly };
}

export default CollapsiblePanel;
