(() => {
  'use strict';

  const mediaById = new Map();
  function mediaPath(value) {
    if (typeof value !== 'string') return null;
    try {
      const url = new URL(value);
      return url.protocol === 'https:' && /(^|\.)(cdninstagram\.com|fbcdn\.net)$/.test(url.hostname)
        ? url.pathname
        : null;
    } catch {
      return null;
    }
  }
  const matchesViewerEndpoint = value => {
    try {
      const url = new URL(value, location.origin);
      return url.origin === location.origin && /^\/(?:graphql\/query|api\/graphql|api\/v1\/feed\/reels_media)\/?$/.test(url.pathname);
    } catch {
      return false;
    }
  };

  function findVideoUrls(data, onlyId) {
    const pending = [data];
    while (pending.length) {
      const item = pending.pop();
      if (!item || typeof item !== 'object') continue;

      const id = [item.pk, item.id, item.media_id].filter(value => typeof value === 'string')
        .map(value => value.split('_')[0]).find(value => /^\d+$/.test(value));
      if (id && (!onlyId || id === onlyId)) {
        const variants = Array.isArray(item.video_versions) ? item.video_versions : [];
        const urls = [item.video_url, ...variants.map(variant => variant?.url)].filter(value => {
          if (typeof value !== 'string') return false;
          try {
            const url = new URL(value);
            return mediaPath(value) &&
              !url.searchParams.has('bytestart') && !url.searchParams.has('byteend');
          } catch {
            return false;
          }
        });
        const manifest = item.video_dash_manifest || item.dash_info?.video_dash_manifest;
        const dash = typeof manifest === 'string' && manifest.length < 200000 ? manifest : null;
        if (urls.length || dash) {
          const previous = mediaById.get(id);
          const images = item.image_versions2?.candidates || item.image_versions?.candidates || [];
          const posters = [item.display_url, item.thumbnail_url, item.thumbnail_src, item.poster_url,
            ...(Array.isArray(images) ? images.map(image => image?.url) : [])].map(mediaPath).filter(Boolean);
          mediaById.delete(id);
          mediaById.set(id, {
            urls: Array.from(new Set([...urls, ...(previous?.urls || [])])).slice(0, 5),
            dash: dash || previous?.dash,
            posters: Array.from(new Set([...posters, ...(previous?.posters || [])])).slice(0, 16),
            username: item.user?.username || item.owner?.username || previous?.username
          });
          if (mediaById.size > 50) mediaById.delete(mediaById.keys().next().value);
          if (onlyId) return;
        }
      }
      for (const child of Object.values(item)) {
        if (child && typeof child === 'object') pending.push(child);
      }
    }
  }

  function indexResponse(text, onlyId) {
    if (!text || text.length > 6_000_000 || !/"(?:video_versions|video_url|video_dash_manifest)"/.test(text)) return;
    const json = text.trim().replace(/^for\s*\(;;\);\s*/, '');
    try {
      findVideoUrls(JSON.parse(json), onlyId);
      return;
    } catch {
      // Some viewer responses arrive as newline-delimited JSON.
    }
    for (const line of json.split('\n')) {
      try {
        findVideoUrls(JSON.parse(line), onlyId);
      } catch {
        // Ignore non-JSON separators.
      }
    }
  }

  const fetchOriginal = window.fetch;
  window.fetch = function (input, ...args) {
    const request = Reflect.apply(fetchOriginal, this, [input, ...args]);
    const viewerQuery = /PolarisStoriesV3/.test(String(args[0]?.body || ''));
    if ((location.pathname.startsWith('/stories/') || viewerQuery) && matchesViewerEndpoint(input?.url || input)) {
      request.then(response => {
        if (response.ok && matchesViewerEndpoint(response.url)) {
          return response.clone().text().then(text => indexResponse(text));
        }
      }).catch(() => {});
    }
    return request;
  };

  const xhrUrls = new WeakMap();
  const openOriginal = XMLHttpRequest.prototype.open;
  XMLHttpRequest.prototype.open = function (method, url, ...args) {
    const result = Reflect.apply(openOriginal, this, [method, url, ...args]);
    if (matchesViewerEndpoint(url)) xhrUrls.set(this, url);
    else xhrUrls.delete(this);
    return result;
  };

  const sendOriginal = XMLHttpRequest.prototype.send;
  XMLHttpRequest.prototype.send = function (body) {
    if (xhrUrls.has(this) &&
        (location.pathname.startsWith('/stories/') || /PolarisStoriesV3/.test(String(body || '')))) {
      this.addEventListener('load', () => {
        if (this.status < 200 || this.status >= 300 || !matchesViewerEndpoint(this.responseURL)) return;
        if (this.responseType === 'json') findVideoUrls(this.response);
        else if (this.responseType === '' || this.responseType === 'text') indexResponse(this.responseText);
      }, { once: true });
    }
    return Reflect.apply(sendOriginal, this, arguments);
  };

  window.addEventListener('sharetostory:viewer-video', ({ detail }) => {
    const exactId = /^\d+$/.test(detail?.mediaId || '') ? detail.mediaId : null;
    const poster = mediaPath(detail?.poster);
    if (!exactId && !poster) return;
    if (!exactId || !mediaById.has(exactId)) {
      for (const script of document.querySelectorAll('script[type="application/json"]')) {
        if (!script.textContent.includes(exactId || poster)) continue;
        indexResponse(script.textContent, exactId);
        if (exactId && mediaById.has(exactId)) break;
      }
    }
    let id = exactId;
    if (!id && poster) {
      const matches = Array.from(mediaById).filter(([, item]) =>
        item.posters.includes(poster) && (!item.username || !detail.username ||
          item.username.toLowerCase() === detail.username.toLowerCase())
      );
      if (matches.length === 1) id = matches[0][0];
    }
    const result = mediaById.get(id);
    detail.mediaId = id;
    detail.urls = result?.urls.slice() || [];
    detail.dash = result?.dash;
  });
})();
