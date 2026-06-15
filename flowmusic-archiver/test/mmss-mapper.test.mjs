import test from 'node:test';
import assert from 'node:assert/strict';

import { buildRelationGraph, enrichLineage, extractStems, mapTrackToMMSS } from '../mmss-mapper.mjs';

test('extractStems normalizes multiple stem shapes', () => {
  const stems = extractStems({
    stems: [{ stem_type: 'vocals', stem_id: 'stem-1', download_url: 'https://example.test/vocals.wav' }],
  });

  assert.equal(stems.length, 1);
  assert.deepEqual(stems[0], {
    type: 'vocals',
    id: 'stem-1',
    url: 'https://example.test/vocals.wav',
  });
});

test('enrichLineage computes origin and depth from parent chain', () => {
  const tracks = [
    { id: 'root' },
    { id: 'child', parent_id: 'root' },
    { id: 'grandchild', parent_id: 'child' },
  ];

  const graph = buildRelationGraph(tracks);
  const enriched = enrichLineage(tracks, graph);
  const grandchild = enriched.find((track) => track.id === 'grandchild');

  assert.equal(grandchild.origin_id, 'root');
  assert.equal(grandchild.derivation_depth, 2);
  assert.deepEqual(grandchild.lineage.chain, ['root', 'child', 'grandchild']);
});

test('mapTrackToMMSS keeps core fields and session-derived snapshot', () => {
  const track = {
    id: '11111111-1111-1111-1111-111111111111',
    title: 'Test Track',
    seed: 42,
    audio_url: 'https://example.test/audio.m4a',
    image_url: 'https://example.test/image.jpg',
    created_at: '2026-06-12T10:30:00Z',
    play_count: 12,
    favorite_count: 3,
    conditions: { prompt_strength: 0.85 },
    raw_data: {
      privacy_status: 'unlisted',
      operation: { sound_prompt: 'glitch metal' },
    },
    session_id: '22222222-2222-2222-2222-222222222222',
    lineage: { origin_id: '11111111-1111-1111-1111-111111111111', depth: 0, branch_index: 0, chain: ['11111111-1111-1111-1111-111111111111'] },
  };

  const sessionSnapshots = new Map([
    ['22222222-2222-2222-2222-222222222222', {
      session_id: '22222222-2222-2222-2222-222222222222',
      applied_flows: [{ name: 'explore', id: null, version: null }],
      memories_applied: ['remember this'],
      config_snapshot: { message_count: 5 },
      payload: { id: '22222222-2222-2222-2222-222222222222' },
    }],
  ]);

  const result = mapTrackToMMSS(track, { sessionSnapshots });

  assert.equal(result.core_audio.id, track.id);
  assert.equal(result.core_audio.seed, 42);
  assert.equal(result.ai_snapshot.applied_flows[0].name, 'explore');
  assert.equal(result.analytics_and_meta.privacy.status, 'unlisted');
  assert.equal(result.generation_logic.prompt.user_input, 'glitch metal');
});
