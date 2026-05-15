// src/mmss/magnetic/useMagneticField.js
import { useState, useCallback, useEffect } from 'react';

const API_BASE = process.env.REACT_APP_MMSS_MAGNETIC_API || 'http://localhost:8001';

export function useMagneticField() {
  const [state, setState] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchState = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch(`${API_BASE}/state`);
      if (!res.ok) throw new Error('Ошибка загрузки состояния');
      setState(await res.json());
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  const applyChoice = useCallback(async (choiceId) => {
    try {
      const res = await fetch(`${API_BASE}/choose`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ choice: choiceId })
      });
      if (!res.ok) throw new Error('Ошибка применения выбора');
      const newState = await res.json();
      setState(newState);
      return newState;
    } catch (e) {
      setError(e.message);
      throw e;
    }
  }, []);

  useEffect(() => { fetchState(); }, [fetchState]);

  return { state, loading, error, applyChoice, refresh: fetchState };
}
