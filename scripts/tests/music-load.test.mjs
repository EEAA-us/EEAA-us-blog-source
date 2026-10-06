import test from 'node:test';
import assert from 'node:assert/strict';
import { loadMusicPlaylist } from '../../lib/music-load.ts';

const defaults = { playlistId: '', musicIds: [] };
const signal = () => new AbortController().signal;
test('configuration failure is an error, not unconfigured', async () => {
  await assert.rejects(loadMusicPlaylist(async () => { throw new Error('offline'); }, defaults, signal()), /offline/);
});
test('missing configuration and empty playlist are distinct', async () => {
  assert.equal((await loadMusicPlaylist(async () => ({}), defaults, signal())).status, 'unconfigured');
  const original = globalThis.fetch;
  globalThis.fetch = async () => Response.json([]);
  try { assert.equal((await loadMusicPlaylist(async () => ({cloud_music_playlist_id:'1'}), defaults, signal())).status, 'empty'); }
  finally { globalThis.fetch = original; }
});
test('failed request can be retried successfully', async () => {
  const original = globalThis.fetch;
  let attempt = 0;
  globalThis.fetch = async () => ++attempt === 1 ? new Response('', {status:502}) : Response.json([{id:1,src:'/api/music-audio?id=1'}]);
  const config = async () => ({cloud_music_playlist_id:'1'});
  try {
    await assert.rejects(loadMusicPlaylist(config, defaults, signal()));
    assert.equal((await loadMusicPlaylist(config, defaults, signal())).songs.length, 1);
  } finally { globalThis.fetch = original; }
});
test('stuck configuration times out and unmount cancels it', async () => {
  const keepAlive = setInterval(() => {}, 100);
  try {
    await assert.rejects(loadMusicPlaylist(() => new Promise(() => {}), defaults, signal(), 20), error => error.name === 'TimeoutError');
    const controller = new AbortController();
    const pending = loadMusicPlaylist(() => new Promise(() => {}), defaults, controller.signal);
    controller.abort();
    await assert.rejects(pending, error => error.name === 'AbortError');
  } finally { clearInterval(keepAlive); }
});
