(() => {
'use strict';

let isUploading = false;

function getPostPermalink(pathname) {
  const match = pathname.match(/^\/(?:[\w.]+\/)?(p|reels?|tv)\/([A-Za-z0-9_-]{1,11})\/?$/);
  if (!match) return null;
  const [, route, shortcode] = match;
  const type = route === 'reels' ? 'reel' : route;
  return { url: `${location.origin}/${type}/${shortcode}/`, shortcode, type };
}

function getViewedStory(pathname) {
  const match = pathname.match(/^\/stories\/([\w.]+)(?:\/(\d+))?\/?$/);
  if (!match || ['highlights', 'archive'].includes(match[1].toLowerCase())) return null;
  const [, username, mediaId] = match;
  const path = `/stories/${username}/` + (mediaId ? `${mediaId}/` : '');
  return { url: location.origin + path, mediaId, type: 'story' };
}

function getFeedPostLink(article) {
  const links = Array.from(article.querySelectorAll('a[href]'))
    .filter(link => link.origin === location.origin)
    .map(link => ({ link, post: getPostPermalink(link.pathname) }))
    .filter(({ post }) => post);
  const timestampLink = links.find(({ link }) => link.querySelector('time'));
  if (timestampLink) return timestampLink.post;
  return new Set(links.map(({ post }) => post.shortcode)).size === 1 ? links[0].post : null;
}

function getPostMediaId(shortcode) {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
  let id = 0n;
  for (const char of shortcode) {
    id = id * 64n + BigInt(alphabet.indexOf(char));
  }
  return id.toString();
}

function getShareIcons(container, isStoryViewer = false, otherStoryControls = false) {
  const selector = 'svg[aria-label], svg:has(title), button[aria-label] svg, [role="button"][aria-label] svg';
  return Array.from(container.querySelectorAll(selector)).filter(icon => {
    const control = icon.closest('button, [role="button"]');
    const label = icon.getAttribute('aria-label') || icon.querySelector('title')?.textContent ||
      control?.getAttribute('aria-label') || '';
    const share = /^(?:share(?: (?:this )?(?:post|reel))?|compartir(?: (?:esta publicación|publicación|(?:este )?reel))?)$/i;
    if (otherStoryControls) {
      return /^(?:more(?: options)?|más(?: opciones)?|pause(?: story)?|pausar(?: historia)?|play(?: story)?|reproducir(?: historia)?|mute|unmute|silenciar|activar sonido)$/i.test(label.trim());
    }
    const storyShare = /^(?:(?:share|send) (?:this )?story|send(?: to)?|(?:compartir|enviar) (?:esta )?historia|enviar(?: a)?)$/i;
    return share.test(label.trim()) || (isStoryViewer && storyShare.test(label.trim()));
  });
}

function getShareItem(icon, container, isDetail) {
  const control = icon.closest('button, [role="button"]') || icon;
  let item = control;
  while (item.parentElement && container.contains(item.parentElement)) {
    const row = item.parentElement;
    const style = getComputedStyle(row);
    if (style.display.includes('flex') && (isDetail || style.flexDirection.startsWith('row')) &&
        Array.from(row.children).some(sibling =>
          sibling !== item && sibling.querySelector('button svg, [role="button"] svg, svg[aria-label]')
        )) return item;
    if (row === container) break;
    item = row;
  }
  // Reel detail layouts can stack the actions in a dedicated vertical rail.
  return isDetail ? control : null;
}

function insertStoryButton(shareIcon, container, getSelection, isDetail = false, useFallbackIcon = false) {
  const shareItem = shareIcon && getShareItem(shareIcon, container, isDetail);
  if (!shareItem && !useFallbackIcon) return null;

  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'sharetostory-share-story';
  button.setAttribute('aria-label', 'Compartir en mis stories');
  button.title = 'Compartir en mis stories';
  if (useFallbackIcon) {
    button.innerHTML = '<svg aria-hidden="true" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 4H4a2 2 0 0 0-1.5 3.3l6 6.7 2.7 7a1 1 0 0 0 1.8.2l9-15.6A1 1 0 0 0 21 4Z"/><path d="m8.5 14 6-6"/></svg>';
  } else {
    const icon = shareIcon.cloneNode(true);
    icon.removeAttribute('aria-label');
    icon.setAttribute('aria-hidden', 'true');
    icon.querySelector('title')?.remove();
    button.appendChild(icon);
  }
  button.addEventListener('click', event => {
    event.stopPropagation();
    const selection = getSelection();
    if (!selection) {
      alert('No se pudo identificar la publicación original.');
      return;
    }
    const { post, mediaContainer, media } = selection;
    const bounds = mediaContainer.getBoundingClientRect();
    const video = media?.tagName === 'VIDEO' ? media : !media &&
      Array.from(mediaContainer.querySelectorAll('video')).find(element => getVisibleMediaArea(element, bounds) > 0);
    openStoryModal(post.url, post.type === 'story' ? post.mediaId : getPostMediaId(post.shortcode), {
      previewUrl: media?.tagName === 'IMG' ? media.currentSrc || media.src :
        video?.poster || getPostPreviewUrl(mediaContainer),
      isVideo: Boolean(video) || post.type === 'reel' || post.type === 'tv',
      videoUrl: video?.currentSrc || video?.src,
      sourceStory: post.type === 'story' ? post.url : null
    });
  });
  if (shareItem) shareItem.before(button);
  else {
    button.classList.add('sharetostory-viewer-fallback');
    document.body.appendChild(button);
  }
  return button;
}

function getDetailShareTarget(isStoryViewer = false, otherStoryControls = false) {
  const viewport = { left: 0, top: 0, right: innerWidth, bottom: innerHeight };
  const dialogs = Array.from(document.querySelectorAll('[role="dialog"]')).reverse();
  const page = (!isStoryViewer && document.querySelector('main, [role="main"]')) || document.body;
  for (const root of [...dialogs, page]) {
    let best = null;
    for (const icon of getShareIcons(root, isStoryViewer, otherStoryControls)) {
      const rect = icon.getBoundingClientRect();
      if (!rect.width || !rect.height || rect.bottom <= 0 || rect.right <= 0 ||
          rect.top >= viewport.bottom || rect.left >= viewport.right ||
          getComputedStyle(icon).visibility !== 'visible') continue;

      let mediaContainer = icon.parentElement;
      let area = 0;
      // Use the closest common container of the share control and the displayed media.
      while (mediaContainer && root.contains(mediaContainer)) {
        for (const media of mediaContainer.querySelectorAll('img, video')) {
          area = Math.max(area, getVisibleMediaArea(media, viewport));
        }
        if (area || mediaContainer === root) break;
        mediaContainer = mediaContainer.parentElement;
      }
      if (mediaContainer && (!isStoryViewer || area > 0) && (!best || area > best.area)) {
        best = { icon, root, mediaContainer, area };
      }
    }
    if (best) return best;
  }
  return null;
}

function getViewerTarget() {
  const share = getDetailShareTarget(true);
  if (share) return share;
  const control = getDetailShareTarget(true, true);
  if (control) return { ...control, useFallbackIcon: true };

  const viewport = { left: 0, top: 0, right: innerWidth, bottom: innerHeight };
  let media;
  let bestArea = 0;
  for (const candidate of document.querySelectorAll('img, video')) {
    const rect = candidate.getBoundingClientRect();
    if (rect.left > innerWidth / 2 || rect.right < innerWidth / 2 ||
        rect.top > innerHeight / 2 || rect.bottom < innerHeight / 2) continue;
    const area = getVisibleMediaArea(candidate, viewport);
    if (area > bestArea) {
      media = candidate;
      bestArea = area;
    }
  }
  return media && { icon: null, root: document.body, mediaContainer: media, media, useFallbackIcon: true };
}

function positionViewerFallback(button, media) {
  if (!media) return;
  const rect = media.getBoundingClientRect();
  button.style.top = `${Math.max(8, rect.top + 36)}px`;
  button.style.right = `${Math.max(8, innerWidth - rect.right + 12)}px`;
}

let detailButton;
let detailIcon;
const feedButtons = new WeakMap();

function addStoryButtons() {
  const viewedStory = getViewedStory(location.pathname);
  if (viewedStory || getPostPermalink(location.pathname)) {
    const target = viewedStory ? getViewerTarget() : getDetailShareTarget();
    if (detailButton?.isConnected && target && target.icon === detailIcon) {
      positionViewerFallback(detailButton, target.media);
      return;
    }
    detailButton?.remove();
    detailIcon = target?.icon;
    if (target?.icon) feedButtons.get(target.icon)?.remove();
    detailButton = target && insertStoryButton(target.icon, target.root, () => {
      const post = getViewedStory(location.pathname) || getPostPermalink(location.pathname);
      const current = post?.type === 'story' ? getViewerTarget() : getDetailShareTarget();
      return post && current?.icon === target.icon ? { post, mediaContainer: current.mediaContainer, media: current.media } : null;
    }, true, target.useFallbackIcon);
    if (detailButton) positionViewerFallback(detailButton, target.media);
    return;
  }

  detailButton?.remove();
  detailButton = null;
  detailIcon = null;
  for (const article of document.querySelectorAll('main article, [role="main"] article')) {
    if (article.querySelector('.sharetostory-share-story') || !getFeedPostLink(article)) continue;
    const shareIcon = getShareIcons(article)[0];
    if (!shareIcon) continue;
    const button = insertStoryButton(shareIcon, article, () => {
      const post = getFeedPostLink(article);
      return post && { post, mediaContainer: article };
    });
    if (button) feedButtons.set(shareIcon, button);
  }
}

function getVisibleMediaArea(media, container) {
  if (getComputedStyle(media).visibility !== 'visible') return 0;
  const rect = media.getBoundingClientRect();
  const width = Math.min(rect.right, container.right) - Math.max(rect.left, container.left);
  const height = Math.min(rect.bottom, container.bottom) - Math.max(rect.top, container.top);
  return width >= 120 && height >= 120 ? width * height : 0;
}

function getPostPreviewUrl(article) {
  const articleRect = article.getBoundingClientRect();
  let best = { area: 0, url: '' };
  for (const media of article.querySelectorAll('img, video[poster]')) {
    const url = media.tagName === 'VIDEO' ? media.poster : media.currentSrc || media.src;
    if (!url || !/^https:\/\//i.test(url)) continue;

    const area = getVisibleMediaArea(media, articleRect);
    if (area > best.area) best = { area, url };
  }
  return best.url;
}

function requestMedia(request, timeoutMs) {
  return new Promise((resolve, reject) => {
    const id = crypto.randomUUID();
    const timeout = setTimeout(() => {
      window.removeEventListener('message', receive);
      reject(new Error('La preparación del contenido tardó demasiado.'));
    }, timeoutMs);
    function receive(event) {
      if (event.source !== window || event.origin !== location.origin ||
          event.data?.type !== 'SHARETOSTORY_PREVIEW_RESPONSE' || event.data.id !== id) return;

      clearTimeout(timeout);
      window.removeEventListener('message', receive);
      const result = event.data.result;
      if (!result || result.error) {
        reject(new Error(result?.error || 'No se pudo preparar el contenido.'));
        return;
      }
      resolve(result);
    }
    window.addEventListener('message', receive);
    window.postMessage({ ...request, id }, location.origin);
  });
}

async function loadStoryMedia(url, format = 'image/jpeg') {
  const video = format === 'video/mp4';
  const audio = format === 'audio/mp4';
  const result = await requestMedia({ type: 'SHARETOSTORY_PREVIEW_REQUEST', url, video, audio },
    video || audio ? 35000 : 15000);
  if (typeof result.data !== 'string') throw new Error('No se pudo cargar el contenido original.');
  const bytes = Uint8Array.from(atob(result.data), char => char.charCodeAt(0));
  return new Blob([bytes], { type: format });
}

function getStoryDashSources(manifest) {
  const xml = new DOMParser().parseFromString(manifest, 'application/xml');
  const elements = (node, tag) => Array.from(node.getElementsByTagNameNS('*', tag));
  if (xml.documentElement.localName !== 'MPD' || elements(xml, 'Period').length !== 1 ||
      elements(xml, 'ContentProtection').length || elements(xml, 'SegmentTemplate').length ||
      elements(xml, 'SegmentList').length) return null;

  const variants = { video: [], audio: [] };
  let hasAudio = false;
  for (const set of elements(xml, 'AdaptationSet')) {
    for (const representation of elements(set, 'Representation')) {
      const type = (representation.getAttribute('mimeType') || set.getAttribute('mimeType') ||
        set.getAttribute('contentType') || '').split('/')[0];
      if (type !== 'video' && type !== 'audio') continue;
      if (type === 'audio') hasAudio = true;
      const base = Array.from(representation.children).find(child => child.localName === 'BaseURL');
      const url = base?.textContent.trim();
      if (!url?.startsWith('https://') || /[?&]byte(?:start|end)=/i.test(url)) continue;
      const bandwidth = Number(representation.getAttribute('bandwidth')) || 0;
      const codec = representation.getAttribute('codecs') || set.getAttribute('codecs') || '';
      const compatible = type === 'video' ? /^avc[13]/i.test(codec) : /^mp4a/i.test(codec);
      variants[type].push({ url, bandwidth, compatible });
    }
  }
  const preferred = list => list.sort((a, b) => Number(b.compatible) - Number(a.compatible) || b.bandwidth - a.bandwidth)[0]?.url;
  const video = preferred(variants.video);
  const audio = preferred(variants.audio);
  return video && (!hasAudio || audio) ? { video, audio } : null;
}

function openStoryModal(url, mediaId, { previewUrl, isVideo, videoUrl, sourceStory }) {
  if (isUploading) return;
  const prepareOnly = Boolean(sourceStory && isVideo);

  document.querySelector('#sharetostory-modal .sharetostory-close-btn')?.click();
  const modal = document.createElement('div');
  modal.id = 'sharetostory-modal';
  modal.className = 'sharetostory-modal';
  modal.innerHTML = `
    <div class="sharetostory-modal-content" role="dialog" aria-modal="true" aria-labelledby="sharetostory-reshare-title">
      <div class="sharetostory-modal-header">
        <h2 id="sharetostory-reshare-title">Compartir en mi historia</h2>
        <button type="button" class="sharetostory-close-btn" aria-label="Cerrar">&times;</button>
      </div>
      <div class="sharetostory-modal-body">
        <div class="sharetostory-reshare-links">
          <a class="sharetostory-reshare-source" target="_blank" rel="noopener noreferrer">Ver publicación original</a>
          <a class="sharetostory-reshare-source sharetostory-upload-preview" target="_blank" rel="noopener noreferrer" hidden>Ver MP4 preparado</a>
          <a class="sharetostory-reshare-source sharetostory-upload-download" download="sharetostory.mp4" hidden>Descargar MP4</a>
        </div>
        <p role="status"></p>
        <div class="sharetostory-actions">
          <button type="button" class="sharetostory-btn-primary">Publicar historia</button>
        </div>
      </div>
    </div>
  `;
  const originalLink = modal.querySelector('a');
  originalLink.href = url;
  if (sourceStory) originalLink.textContent = 'Ver historia original';
  const publish = modal.querySelector('.sharetostory-btn-primary');
  if (prepareOnly) publish.textContent = 'Preparar vídeo';
  const close = modal.querySelector('.sharetostory-close-btn');
  const status = modal.querySelector('[role="status"]');
  const uploadPreview = modal.querySelector('.sharetostory-upload-preview');
  const uploadDownload = modal.querySelector('.sharetostory-upload-download');
  let previewObjectUrl;
  let completed = false;
  let sessionInterrupted = false;
  const progress = message => { status.textContent = message; };
  const closeModal = () => {
    if (previewObjectUrl) URL.revokeObjectURL(previewObjectUrl);
    modal.remove();
  };
  close.addEventListener('click', closeModal);
  publish.addEventListener('click', async () => {
    if (isUploading || publish.disabled) return;
    if (completed) {
      closeModal();
      return;
    }
    isUploading = true;
    publish.disabled = true;
    close.disabled = true;
    uploadDownload.hidden = true;
    progress(isVideo ? 'Descargando el vídeo original…' : 'Preparando la imagen…');
    try {
      let story;
      if (isVideo) {
        const source = await InstagramAPI.loadPostVideo(mediaId, videoUrl, sourceStory, previewUrl);
        const originalStory = sourceStory && !mediaId && source.mediaId
          ? sourceStory + source.mediaId + '/'
          : sourceStory;
        if (originalStory) originalLink.href = originalStory;
        progress('Ajustando el vídeo a la historia fotograma a fotograma…');
        const details = await requestMedia({
          type: 'SHARETOSTORY_ENCODE_REQUEST', video: source.video, audio: source.audio
        }, 300000);
        if (!(details.media instanceof Blob) || !(details.cover instanceof Blob)) {
          throw new Error('El vídeo preparado no es válido.');
        }
        if (previewObjectUrl) URL.revokeObjectURL(previewObjectUrl);
        previewObjectUrl = URL.createObjectURL(details.media);
        uploadPreview.href = previewObjectUrl;
        uploadPreview.hidden = false;
        if (prepareOnly) {
          uploadDownload.href = previewObjectUrl;
          uploadDownload.hidden = false;
          completed = true;
          publish.textContent = 'Cerrar ventana';
          progress('Vídeo preparado. Descarga el MP4 para publicarlo desde Instagram.');
          return;
        }
        story = await InstagramAPI.publishReshare(mediaId, details.media, progress, details, originalStory);
      } else {
        if (!previewUrl) throw new Error('Instagram no muestra una imagen para esta publicación.');
        const image = await loadStoryMedia(previewUrl);
        story = await InstagramAPI.publishReshare(mediaId, image, progress, null, sourceStory);
      }
      completed = true;
      publish.textContent = 'Cerrar ventana';
      progress('Historia publicada.');
      const username = story.user?.username || story.owner?.username;
      const id = typeof story.id === 'string' ? story.id.split('_')[0] : story.pk;
      if (/^[\w.]+$/.test(username || '') && typeof id === 'string' && /^\d+$/.test(id)) {
        const link = document.createElement('a');
        link.className = 'sharetostory-reshare-source';
        link.href = `https://www.instagram.com/stories/${username}/${id}/`;
        link.target = '_blank';
        link.rel = 'noopener noreferrer';
        link.textContent = 'Ver historia';
        status.append(' ', link);
      }
    } catch (error) {
      sessionInterrupted = error.sessionInterrupted === true;
      status.textContent = (prepareOnly ? 'No se pudo preparar el vídeo. ' : 'No se pudo publicar la historia. ') +
        error.message;
      if (previewObjectUrl) {
        uploadDownload.href = previewObjectUrl;
        uploadDownload.hidden = false;
      }
    } finally {
      isUploading = false;
      publish.disabled = sessionInterrupted;
      close.disabled = false;
    }
  });

  document.body.appendChild(modal);
  close.focus();
}

const InstagramAPI = {
  getCSRFToken() {
    const cookies = document.cookie.split(';');
    for (let cookie of cookies) {
      const [name, value] = cookie.trim().split('=');
      if (name === 'csrftoken') {
        return value;
      }
    }
    return null;
  },

  getFbDtsg() {
    // Try multiple sources
    const dtsgInput = document.querySelector('input[name="fb_dtsg"]');
    if (dtsgInput) {
      return dtsgInput.value;
    }

    if (window.__data && window.__data.fb_dtsg) {
      return window.__data.fb_dtsg;
    }

    if (window._sharedData && window._sharedData.config && window._sharedData.config.csrf_token) {
      return window._sharedData.config.csrf_token;
    }

    // Try to extract from inline scripts
    try {
      const scripts = document.querySelectorAll('script');
      for (const script of scripts) {
        const text = script.textContent;
        // Look for patterns like "DTSGInitialData":{"token":"..."}
        const dtsgMatch = text.match(/"DTSGInitialData"[^}]*"token":"([^"]+)"/);
        if (dtsgMatch) {
          return dtsgMatch[1];
        }
        // Look for fb_dtsg= pattern
        const dtsgMatch2 = text.match(/[,{]"?fb_dtsg"?:"([^"]+)"/);
        if (dtsgMatch2) {
          return dtsgMatch2[1];
        }
      }
    } catch (e) {
      console.warn('Error extracting fb_dtsg from scripts:', e);
    }

    return null;
  },

  getAppId() {
    // Try multiple sources for Instagram App ID
    const sources = [
      () => window._sharedData?.config?.ig_app_id,
      () => document.querySelector('meta[property="al:android:app_id"]')?.content,
      () => document.querySelector('meta[property="al:ios:app_store_id"]')?.content,
      () => '1217981644879628' // Instagram web app ID (from real request)
    ];

    for (const source of sources) {
      try {
        const appId = source();
        if (appId) {
          return appId;
        }
      } catch (e) {
        // Continue to next source
      }
    }

    console.warn('Using fallback App ID');
    return '1217981644879628';
  },

  generateJazoest(fbDtsg) {
    let sum = 0;
    for (let i = 0; i < fbDtsg.length; i++) {
      sum += fbDtsg.charCodeAt(i);
    }
    return '2' + sum;
  },

  getIGWWWClaim() {
    // X-IG-WWW-Claim is often stored in sessionStorage or localStorage
    try {
      const claim = sessionStorage.getItem('www-claim-v2') ||
                    localStorage.getItem('www-claim-v2') ||
                    document.cookie.match(/ig_www_claim=([^;]+)/)?.[1];
      if (claim) {
        return claim;
      }
    } catch (e) {
      console.warn('Could not get IG-WWW-Claim:', e);
    }
    return null;
  },

  getInstagramAJAX() {
    // X-Instagram-AJAX is often in window._sharedData or generated from timestamp
    try {
      if (window._sharedData?.rollout_hash) {
        return window._sharedData.rollout_hash;
      }
      // Fallback: use a recent value or timestamp-based
      return '1034745666';
    } catch (e) {
      return '1034745666';
    }
  },

  getWebSessionID() {
    // X-Web-Session-ID format appears to be random: "cridrg:rkjrdu:g7hbt4"
    try {
      const sessionId = sessionStorage.getItem('web-session-id');
      if (sessionId) return sessionId;

      // Generate a pseudo-random session ID
      const randomStr = () => Math.random().toString(36).substring(2, 8);
      return `${randomStr()}:${randomStr()}:${randomStr()}`;
    } catch (e) {
      return 'share:story:web';
    }
  },


  async loadPostVideo(mediaId, source, sourceStory, poster) {
    if (source?.startsWith('https:') && !/[?&]byte(?:start|end)=/i.test(source)) {
      try {
        return { video: await loadStoryMedia(source, 'video/mp4') };
      } catch {
        // The playback URL can point to a segment rather than a complete MP4.
      }
    }

    if (sourceStory && source?.startsWith(`blob:${location.origin}/`)) {
      try {
        const response = await fetch(source, { signal: AbortSignal.timeout(5000) });
        const video = await response.blob();
        if (response.ok && video.size <= 40 * 1024 * 1024 && await video.slice(4, 8).text() === 'ftyp') {
          return { video: video.slice(0, video.size, 'video/mp4') };
        }
      } catch {
        // A MediaSource URL is playable but cannot be read as a complete file.
      }
    }
    if (sourceStory) return this.loadViewerStoryVideo(mediaId, sourceStory, poster);

    // Instagram can play a stream through a blob URL. Resolve its downloadable MP4 by post ID.
    const response = await fetch(`https://www.instagram.com/api/v1/media/${mediaId}/info/`, {
      credentials: 'include',
      headers: { 'X-IG-App-ID': this.getAppId() },
      signal: AbortSignal.timeout(10000)
    });
    if (!response.ok) throw new Error('Instagram no permitió obtener el vídeo original.');
    const { items } = await response.json();
    const video = items?.[0]?.video_versions?.find(version => version.url);
    if (!video) throw new Error('Instagram no proporcionó un MP4 para esta publicación.');
    return { video: await loadStoryMedia(video.url, 'video/mp4') };
  },

  async loadViewerStoryVideo(mediaId, sourceStory, poster) {
    const username = new URL(sourceStory).pathname.split('/')[2];
    const detail = { mediaId, poster, username, urls: [] };
    window.dispatchEvent(new CustomEvent('sharetostory:viewer-video', { detail }));
    const selectedId = mediaId || detail.mediaId;
    let downloadError;
    for (const url of detail.urls) {
      try {
        return { video: await loadStoryMedia(url, 'video/mp4'), mediaId: selectedId };
      } catch (error) {
        downloadError = error;
      }
    }
    const tracks = detail.dash && getStoryDashSources(detail.dash);
    if (tracks) {
      const [video, audio] = await Promise.all([
        loadStoryMedia(tracks.video, 'video/mp4'),
        tracks.audio ? loadStoryMedia(tracks.audio, 'audio/mp4') : undefined
      ]);
      return { video, audio, mediaId: selectedId };
    }
    if (downloadError) throw downloadError;
    if (detail.dash) throw new Error('El visor entregó el vídeo en un formato de pistas separadas que la extensión no puede ensamblar.');

    if (!selectedId) {
      throw new Error('El visor no mostró un enlace individual ni una portada que permita identificar este vídeo.');
    }
    const headers = { 'X-IG-App-ID': this.getAppId(), 'X-Requested-With': 'XMLHttpRequest' };
    const read = async (path, description) => {
      const originalUser = document.cookie.match(/(?:^|;\s*)ds_user_id=(\d+)/)?.[1];
      const response = await fetch(path, {
        credentials: 'same-origin',
        headers,
        signal: AbortSignal.timeout(10000)
      });
      const responseText = await response.text();
      const data = parseInstagramResponse(responseText);
      const sessionError = instagramSessionError({
        status: response.status,
        responseURL: response.url,
        responseText
      }, data, originalUser);
      if (sessionError) throw sessionError;
      if (!response.ok || !data || data.status === 'fail') {
        if (response.status === 404) {
          throw new Error('El visor no expuso un MP4 para esta historia y la consulta alternativa de Instagram devolvió HTTP 404.');
        }
        const detail = instagramResponseMessage(data) || `HTTP ${response.status}`;
        throw new Error(`Instagram no permitió consultar ${description} (${detail}).`);
      }
      return data;
    };
    const profile = await read(
      `/api/v1/users/web_profile_info/?${new URLSearchParams({ username })}`, 'el perfil de la historia'
    );
    const userId = profile.data?.user?.id;
    if (!/^\d+$/.test(userId || '')) throw new Error('No se pudo identificar la cuenta de la historia.');

    const response = await read(
      `/api/v1/feed/reels_media/?${new URLSearchParams({ reel_ids: userId })}`, 'las historias de esa cuenta'
    );
    const reel = response.reels?.[userId] ||
      response.reels_media?.find(item => String(item.user?.pk ?? item.id) === String(userId));
    const item = reel?.items?.find(candidate =>
      (typeof candidate.id === 'string' && candidate.id.split('_')[0] === selectedId) ||
      (typeof candidate.pk === 'string' && candidate.pk === selectedId)
    );
    if (!item) throw new Error('La historia seleccionada ya no está disponible en el visor de Instagram.');
    const video = item.video_versions?.find(version => version.url);
    if (!video) throw new Error('Instagram no proporcionó un MP4 para la historia seleccionada.');
    return { video: await loadStoryMedia(video.url, 'video/mp4'), mediaId: selectedId };
  },

  async publishReshare(mediaId, media, progress, video, sourceStory) {
    const csrfToken = this.getCSRFToken();
    if (!csrfToken) throw new Error('Inicia sesión en Instagram.');

    const uploadId = Date.now().toString();
    const entityName = `story_${uploadId}`;
    const commonHeaders = {
      'X-Instagram-AJAX': this.getInstagramAJAX(),
      'X-IG-App-ID': this.getAppId(),
      'X-ASBD-ID': '359341',
      'X-Web-Session-ID': this.getWebSessionID()
    };

    const upload = async (endpoint, asset, params, label) => {
      const url = `https://i.instagram.com/${endpoint}/${entityName}`;
      const headers = {
        ...commonHeaders,
        'Content-Type': asset.type,
        'Offset': '0',
        'X-Entity-Length': String(asset.size),
        'X-Entity-Name': entityName,
        'X-Entity-Type': asset.type,
        'X-Instagram-Rupload-Params': JSON.stringify({ upload_id: uploadId, ...params })
      };
      try {
        try {
          return await postToInstagram(url, headers, asset);
        } catch (error) {
          if (error.status !== 572) throw error;
        }
        // Retry the same media entity once. This request does not publish the story.
        progress(`Reintentando la subida de ${label}…`);
        await new Promise(resolve => setTimeout(resolve, 1500));
        return await postToInstagram(url, headers, asset);
      } catch (error) {
        throw withInstagramStage(`Al subir ${label}`, error);
      }
    };
    const dimensions = {
      upload_media_height: video?.height ?? 1920,
      upload_media_width: video?.width ?? 1080
    };
    progress(video ? 'Subiendo el vídeo…' : 'Subiendo la imagen…');
    if (video) {
      await upload('rupload_igvideo', media, {
        media_type: 2,
        client_passthrough: '1',
        is_sidecar: '0',
        for_album: true,
        is_unified_video: '0'
      }, 'el vídeo');
      progress('Subiendo la portada…');
      await upload('rupload_igphoto', video.cover, { media_type: 2, ...dimensions }, 'la portada');
    } else {
      await upload('rupload_igphoto', media, { media_type: 1, ...dimensions }, 'la imagen');
    }

    const body = new URLSearchParams({
      upload_id: uploadId,
      caption: '',
      configure_mode: '1',
      ...(video && {
        poster_frame_index: '0',
        cover_upload_id: uploadId,
        length: video.duration,
        audio_muted: 'false',
        source_type: '4',
        extra: JSON.stringify({ source_width: video.width, source_height: video.height })
      }),
      share_to_facebook: '',
      jazoest: this.generateJazoest(this.getFbDtsg() || ''),
      ...getStoryReferenceFields(mediaId, sourceStory)
    });
    const claim = this.getIGWWWClaim();
    const headers = {
      ...commonHeaders,
      'Content-Type': 'application/x-www-form-urlencoded',
      'X-CSRFToken': csrfToken,
      'X-Requested-With': 'XMLHttpRequest',
      ...(claim && { 'X-IG-WWW-Claim': claim })
    };
    const configureUrl = 'https://www.instagram.com/api/v1/media/configure_to_story/' +
      (video ? '?video=1' : '');
    const deadline = Date.now() + 180000;
    progress(video ? 'Esperando a que Instagram procese el vídeo…' : 'Confirmando la historia…');
    do {
      try {
        const response = await postToInstagram(configureUrl, headers, body.toString());
        if (response?.status === 'ok') {
          if (response.media?.id || response.media?.pk) return response.media;
          throw new Error('Instagram respondió sin el identificador de la historia. Revisa tus historias antes de reintentar.');
        }
        throw new Error(instagramResponseMessage(response) || (response
          ? 'Instagram devolvió una respuesta sin confirmación de la historia.'
          : 'Instagram devolvió una respuesta vacía o inesperada. Revisa tus historias antes de reintentar.'));
      } catch (error) {
        if (error.sessionInterrupted) throw withInstagramStage('Al crear la historia', error);
        const processing = error.status === 202 || /transcode not finished yet/i.test(error.message);
        if (!video || !processing) {
          const checkStory = error.status === 572 ? ' Revisa tus historias antes de reintentar.' : '';
          throw new Error(`Al crear la historia: ${error.message}${checkStory}`, { cause: error });
        }
        if (Date.now() >= deadline) break;
        await new Promise(resolve => setTimeout(resolve, 3000));
      }
    } while (Date.now() < deadline);
    throw new Error('Instagram sigue procesando el vídeo.');

  }
};

function getStoryReferenceFields(mediaId, sourceStory) {
  if (sourceStory) {
    return {
      story_sticker_ids: 'link_sticker_default',
      tap_models: JSON.stringify([{
        type: 'story_link',
        link_type: 'web',
        url: sourceStory,
        x: 0.5,
        y: 0.85,
        z: 0,
        width: 0.45,
        height: 0.06,
        rotation: 0,
        is_sticker: true,
        selected_index: 0,
        tap_state: 0,
        tap_state_str_id: 'link_sticker_default'
      }])
    };
  }
  return {
    story_sticker_ids: `media_simple_${mediaId}`,
    attached_media: JSON.stringify([{
      media_id: mediaId,
      x: 0.5,
      y: 0.5,
      width: 0.8,
      height: 0.6,
      rotation: 0,
      is_sticker: true
    }])
  };
}

function instagramResponseMessage(response) {
  const message = [response?.message, response?.error_message, response?.error_type]
    .find(value => typeof value === 'string' && value.trim());
  return message?.trim().slice(0, 240);
}

function parseInstagramResponse(text) {
  try {
    return JSON.parse((text || '').trimStart().replace(/^for\s*\(;;\);\s*/, ''));
  } catch {
    // Instagram may return an HTML page instead of JSON after a redirect.
    return null;
  }
}

function withInstagramStage(stage, cause) {
  const error = new Error(`${stage}: ${cause.message}`, { cause });
  error.sessionInterrupted = cause.sessionInterrupted;
  return error;
}

function instagramSessionError(xhr, response, originalUser) {
  const currentUser = document.cookie.match(/(?:^|;\s*)ds_user_id=(\d+)/)?.[1];
  const action = [response?.message, response?.error_type, response?.error_message,
    response?.redirect_url, xhr.responseURL].filter(value => typeof value === 'string').join(' ');
  const verification = /challenge[_ /-]?required|checkpoint[_ /-]?required|\/(?:challenge|checkpoint)\//i.test(action);
  const loginForm = /<form\b[^>]*\baction=["'][^"']*\/accounts\/login\//i.test(xhr.responseText || '');
  const loginRequested = /login[_ -]?required|\/accounts\/login(?:[/?]|$)/i.test(action) || loginForm;
  const accountChanged = Boolean(originalUser && currentUser !== originalUser);
  if (!verification && !loginRequested && !accountChanged && xhr.status !== 401) return null;

  let message;
  if (verification) {
    message = 'Instagram pidió verificar la cuenta. Completa la verificación directamente en Instagram.';
  } else if (loginRequested) {
    message = 'Instagram pidió iniciar sesión para esta solicitud. Comprueba tu sesión y tus historias directamente en Instagram.';
  } else if (accountChanged) {
    message = 'La sesión del navegador cambió durante la solicitud. Comprueba tu cuenta y tus historias en Instagram.';
  } else {
    message = 'Instagram rechazó la solicitud por autenticación (HTTP 401). Comprueba si tu sesión sigue abierta y revisa tus historias.';
  }
  const error = new Error(message);
  error.sessionInterrupted = true;
  return error;
}

function postToInstagram(url, headers, body) {
  return new Promise((resolve, reject) => {
    const originalUser = document.cookie.match(/(?:^|;\s*)ds_user_id=(\d+)/)?.[1];
    const xhr = new XMLHttpRequest();
    xhr.open('POST', url);
    xhr.withCredentials = true;
    xhr.timeout = 45000;
    for (const [name, value] of Object.entries(headers)) {
      xhr.setRequestHeader(name, value);
    }
    xhr.onload = () => {
      const response = parseInstagramResponse(xhr.responseText);
      const sessionError = instagramSessionError(xhr, response, originalUser);
      if (sessionError) {
        reject(sessionError);
        return;
      }
      if (xhr.status >= 200 && xhr.status < 300 && xhr.status !== 202) {
        resolve(response);
      } else {
        const error = new Error(instagramResponseMessage(response) || `Instagram respondió con HTTP ${xhr.status}.`);
        error.status = xhr.status;
        reject(error);
      }
    };
    xhr.onerror = () => reject(instagramSessionError(xhr, null, originalUser) ||
      new Error('No se pudo conectar con Instagram.'));
    xhr.ontimeout = () => reject(new Error('Instagram tardó demasiado en responder. Revisa tus historias antes de reintentar.'));
    xhr.send(body);
  });
}

addStoryButtons();
let scanScheduled = false;
function scheduleStoryButtonScan() {
  if (scanScheduled) return;
  scanScheduled = true;
  requestAnimationFrame(() => {
    scanScheduled = false;
    addStoryButtons();
  });
}
new MutationObserver(scheduleStoryButtonScan).observe(document.body, { subtree: true, childList: true });
window.addEventListener('popstate', scheduleStoryButtonScan);
window.addEventListener('resize', scheduleStoryButtonScan);
document.addEventListener('load', () => {
  if (getViewedStory(location.pathname)) scheduleStoryButtonScan();
}, true);
window.addEventListener('scroll', () => {
  if (getPostPermalink(location.pathname) || getViewedStory(location.pathname)) scheduleStoryButtonScan();
}, { capture: true, passive: true });
})();
