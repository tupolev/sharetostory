(() => {
'use strict';

const preferredLanguage = (navigator.languages?.[0] || navigator.language || 'en').toLowerCase().split(/[-_]/)[0];
const language = Object.hasOwn(shareToStoryMessages, preferredLanguage) ? preferredLanguage : 'en';
const messages = shareToStoryMessages[language];
function t(key, ...values) {
  return (messages[key] || shareToStoryMessages.en[key]).replace(/\{(\d+)\}/g, (_, index) => String(values[index] ?? ''));
}

let isUploading = false;

function getPostPermalink(pathname) {
  if (/^\/stories(?:\/|$)/.test(pathname)) return null;
  const match = pathname.match(/^\/(?:[\w.]+\/)?(p|reels?|tv)\/([A-Za-z0-9_-]{1,11})\/?$/);
  if (!match) return null;
  const [, route, shortcode] = match;
  const type = route === 'reels' ? 'reel' : route;
  return { url: `${location.origin}/${type}/${shortcode}/`, shortcode, type };
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

function getShareIcons(container) {
  const selector = 'svg[aria-label], svg:has(title), button[aria-label] svg, [role="button"][aria-label] svg';
  return Array.from(container.querySelectorAll(selector)).filter(icon => {
    const control = icon.closest('button, [role="button"]');
    const label = icon.getAttribute('aria-label') || icon.querySelector('title')?.textContent ||
      control?.getAttribute('aria-label') || '';
    const share = /^(?:share(?: (?:this )?(?:post|reel))?|compartir(?: (?:(?:esta )?publicaci[oó]n|(?:este )?reel))?|comparteix(?: (?:la publicació|el reel))?|(?:beitrag |reel )?teilen|partager(?: (?:cette publication|la publication|ce reel|le reel))?|(?:argitalpena |reela )?partekatu)$/i;
    return share.test(label.trim());
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

function insertStoryButton(shareIcon, container, getSelection, isDetail = false) {
  const shareItem = getShareItem(shareIcon, container, isDetail);
  if (!shareItem) return null;

  const button = document.createElement('button');
  button.type = 'button';
  button.lang = language;
  button.className = 'sharetostory-share-story';
  button.setAttribute('aria-label', t('share'));
  button.title = t('share');
  const icon = shareIcon.cloneNode(true);
  icon.removeAttribute('aria-label');
  icon.setAttribute('aria-hidden', 'true');
  icon.querySelector('title')?.remove();
  button.appendChild(icon);
  button.addEventListener('click', event => {
    event.stopPropagation();
    const selection = getSelection();
    if (!selection) {
      alert(t('post_not_found'));
      return;
    }
    const { post, mediaContainer } = selection;
    const bounds = mediaContainer.getBoundingClientRect();
    const video = Array.from(mediaContainer.querySelectorAll('video')).find(element => getVisibleMediaArea(element, bounds) > 0);
    const source = {
      previewUrl: video?.poster || getPostPreviewUrl(mediaContainer),
      isVideo: Boolean(video) || post.type === 'reel' || post.type === 'tv',
      videoUrl: video?.currentSrc || video?.src
    };
    openStoryModal(post.url, getPostMediaId(post.shortcode), source, button);
  });
  shareItem.before(button);
  return button;
}

function getDetailShareTarget() {
  const viewport = { left: 0, top: 0, right: innerWidth, bottom: innerHeight };
  const dialogs = Array.from(document.querySelectorAll('[role="dialog"]')).reverse();
  const page = document.querySelector('main, [role="main"]') || document.body;
  for (const root of [...dialogs, page]) {
    let best = null;
    for (const icon of getShareIcons(root)) {
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
      if (mediaContainer && (!best || area > best.area)) {
        best = { icon, root, mediaContainer, area };
      }
    }
    if (best) return best;
  }
  return null;
}

let detailButton;
let detailIcon;
const feedButtons = new WeakMap();

function addStoryButtons() {
  const { pathname } = location;
  const postPage = getPostPermalink(pathname);
  if (postPage) {
    const target = getDetailShareTarget();
    if (detailButton?.isConnected && target?.icon === detailIcon) return;
    detailButton?.remove();
    detailIcon = target?.icon;
    if (target?.icon) feedButtons.get(target.icon)?.remove();
    detailButton = target && insertStoryButton(target.icon, target.root, () => {
      const post = getPostPermalink(location.pathname);
      const current = getDetailShareTarget();
      return post && current?.icon === target.icon ? { post, mediaContainer: current.mediaContainer } : null;
    }, true);
    return;
  }

  detailButton?.remove();
  detailButton = null;
  detailIcon = null;
  if (pathname !== '/') {
    for (const button of document.querySelectorAll('.sharetostory-share-story')) button.remove();
    return;
  }

  for (const article of document.querySelectorAll('main article, [role="main"] article')) {
    if (article.querySelector('.sharetostory-share-story') || !getFeedPostLink(article)) continue;
    const shareIcon = getShareIcons(article)[0];
    if (!shareIcon) continue;
    const button = insertStoryButton(shareIcon, article, () => {
      const post = location.pathname === '/' && getFeedPostLink(article);
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
      reject(new Error(t('media_timeout')));
    }, timeoutMs);
    function receive(event) {
      if (event.source !== window || event.origin !== location.origin ||
          event.data?.type !== 'SHARETOSTORY_PREVIEW_RESPONSE' || event.data.id !== id) return;

      clearTimeout(timeout);
      window.removeEventListener('message', receive);
      const result = event.data.result;
      if (!result || result.errorCode) {
        const key = result?.errorCode;
        reject(new Error(Object.hasOwn(shareToStoryMessages.en, key) ? t(key) : t('prepare_failed')));
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
  const result = await requestMedia({ type: 'SHARETOSTORY_PREVIEW_REQUEST', url, video }, video ? 35000 : 15000);
  if (typeof result.data !== 'string') throw new Error(t('original_unavailable'));
  const bytes = Uint8Array.from(atob(result.data), char => char.charCodeAt(0));
  return new Blob([bytes], { type: format });
}

async function encodeStoryVideo(source) {
  const details = await requestMedia({
    type: 'SHARETOSTORY_ENCODE_REQUEST', video: source.video
  }, 300000);
  if (!(details.media instanceof Blob) || !(details.cover instanceof Blob)) {
    throw new Error(t('invalid_video'));
  }
  return details;
}

function openStoryModal(url, mediaId, { previewUrl, isVideo, videoUrl }, trigger) {
  if (isUploading) return;

  document.querySelector('#sharetostory-modal .sharetostory-close-btn')?.click();
  const modal = document.createElement('div');
  modal.id = 'sharetostory-modal';
  modal.className = 'sharetostory-modal';
  modal.lang = language;
  modal.innerHTML = `
    <div class="sharetostory-modal-content" role="dialog" aria-modal="true" aria-labelledby="sharetostory-reshare-title">
      <div class="sharetostory-modal-header">
        <h2 id="sharetostory-reshare-title">${t('share')}</h2>
        <button type="button" class="sharetostory-close-btn" aria-label="${t('close')}">&times;</button>
      </div>
      <div class="sharetostory-modal-body">
        <div class="sharetostory-reshare-links">
          <a class="sharetostory-reshare-source" target="_blank" rel="noopener noreferrer">${t('original')}</a>
          <a class="sharetostory-reshare-source sharetostory-upload-preview" target="_blank" rel="noopener noreferrer" hidden>${t('view_mp4')}</a>
          <a class="sharetostory-reshare-source sharetostory-upload-download" download="sharetostory.mp4" hidden>${t('download_mp4')}</a>
        </div>
        <p role="status"></p>
        <div class="sharetostory-actions">
          <button type="button" class="sharetostory-btn-primary">${t('publish')}</button>
        </div>
      </div>
    </div>
  `;
  const originalLink = modal.querySelector('a');
  originalLink.href = url;
  const publish = modal.querySelector('.sharetostory-btn-primary');
  const close = modal.querySelector('.sharetostory-close-btn');
  const status = modal.querySelector('[role="status"]');
  const uploadPreview = modal.querySelector('.sharetostory-upload-preview');
  const uploadDownload = modal.querySelector('.sharetostory-upload-download');
  let previewObjectUrl;
  let closeCountdown;
  let completed = false;
  let sessionInterrupted = false;
  const progress = message => { status.textContent = message; };
  const closeModal = () => {
    clearInterval(closeCountdown);
    if (previewObjectUrl) URL.revokeObjectURL(previewObjectUrl);
    modal.remove();
    if (trigger?.isConnected) trigger.focus({ preventScroll: true });
  };
  close.addEventListener('click', closeModal);
  modal.addEventListener('click', event => {
    if (event.target !== modal) return;
    event.stopPropagation();
    if (!isUploading) closeModal();
  });
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
    progress(isVideo ? t('downloading_video') : t('preparing_image'));
    try {
      let story;
      if (isVideo) {
        const source = await InstagramAPI.loadPostVideo(mediaId, videoUrl);
        progress(t('adjusting_video'));
        const details = await encodeStoryVideo(source);
        if (previewObjectUrl) URL.revokeObjectURL(previewObjectUrl);
        previewObjectUrl = URL.createObjectURL(details.media);
        uploadPreview.href = previewObjectUrl;
        uploadPreview.hidden = false;
        story = await InstagramAPI.publishReshare(mediaId, details.media, progress, details);
      } else {
        if (!previewUrl) throw new Error(t('missing_image'));
        const image = await loadStoryMedia(previewUrl);
        story = await InstagramAPI.publishReshare(mediaId, image, progress);
      }
      completed = true;
      progress(t('published'));
      const closeAt = performance.now() + 5000;
      publish.textContent = t('close_countdown', 5);
      closeCountdown = setInterval(() => {
        const secondsLeft = Math.ceil((closeAt - performance.now()) / 1000);
        if (secondsLeft <= 0) closeModal();
        else publish.textContent = t('close_countdown', secondsLeft);
      }, 250);
      const username = story.user?.username || story.owner?.username;
      const id = typeof story.id === 'string' ? story.id.split('_')[0] : story.pk;
      if (/^[\w.]+$/.test(username || '') && typeof id === 'string' && /^\d+$/.test(id)) {
        const link = document.createElement('a');
        link.className = 'sharetostory-reshare-source';
        link.href = `https://www.instagram.com/stories/${username}/${id}/`;
        link.target = '_blank';
        link.rel = 'noopener noreferrer';
        link.textContent = t('view_story');
        status.append(' ', link);
      }
    } catch (error) {
      sessionInterrupted = error.sessionInterrupted === true;
      status.textContent = t('publish_failed', error.message);
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


  async loadPostVideo(mediaId, source) {
    if (source?.startsWith('https:') && !/[?&]byte(?:start|end)=/i.test(source)) {
      try {
        return { video: await loadStoryMedia(source, 'video/mp4') };
      } catch {
        // The playback URL can point to a segment rather than a complete MP4.
      }
    }

    // Instagram can play a stream through a blob URL. Resolve its downloadable MP4 by post ID.
    const response = await fetch(`https://www.instagram.com/api/v1/media/${mediaId}/info/`, {
      credentials: 'include',
      headers: { 'X-IG-App-ID': this.getAppId() },
      signal: AbortSignal.timeout(10000)
    });
    if (!response.ok) throw new Error(t('video_access_denied'));
    const { items } = await response.json();
    const video = items?.[0]?.video_versions?.find(version => version.url);
    if (!video) throw new Error(t('no_post_mp4'));
    return { video: await loadStoryMedia(video.url, 'video/mp4') };
  },

  async publishReshare(mediaId, media, progress, video) {
    const csrfToken = this.getCSRFToken();
    if (!csrfToken) throw new Error(t('sign_in'));

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
        progress(t('retry_upload', label));
        await new Promise(resolve => setTimeout(resolve, 1500));
        return await postToInstagram(url, headers, asset);
      } catch (error) {
        throw withInstagramStage(t('upload_error', label, error.message), error);
      }
    };
    const dimensions = {
      upload_media_height: video?.height ?? 1920,
      upload_media_width: video?.width ?? 1080
    };
    progress(video ? t('uploading_video') : t('uploading_image'));
    if (video) {
      await upload('rupload_igvideo', media, {
        media_type: 2,
        client_passthrough: '1',
        is_sidecar: '0',
        for_album: true,
        is_unified_video: '0'
      }, t('video_asset'));
      progress(t('uploading_cover'));
      await upload('rupload_igphoto', video.cover, { media_type: 2, ...dimensions }, t('cover_asset'));
    } else {
      await upload('rupload_igphoto', media, { media_type: 1, ...dimensions }, t('image_asset'));
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
    progress(video ? t('processing_video') : t('confirming'));
    do {
      try {
        const response = await postToInstagram(configureUrl, headers, body.toString());
        if (response?.status === 'ok') {
          if (response.media?.id || response.media?.pk) return response.media;
          throw new Error(t('missing_story_id'));
        }
        throw new Error(instagramResponseMessage(response) || (response
          ? 'Instagram devolvió una respuesta sin confirmación de la historia.'
          : t('unexpected_response')));
      } catch (error) {
        if (error.sessionInterrupted) throw withInstagramStage(t('create_error', error.message), error);
        const processing = error.status === 202 || /transcode not finished yet/i.test(error.message);
        if (!video || !processing) {
          const checkStory = error.status === 572 ? ' ' + t('check_stories') : '';
          throw new Error(t('create_error', error.message + checkStory), { cause: error });
        }
        if (Date.now() >= deadline) break;
        await new Promise(resolve => setTimeout(resolve, 3000));
      }
    } while (Date.now() < deadline);
    throw new Error(t('still_processing'));

  }
};

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

function withInstagramStage(message, cause) {
  const error = new Error(message, { cause });
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
    message = t('verify_account');
  } else if (loginRequested) {
    message = t('login_requested');
  } else if (accountChanged) {
    message = t('session_changed');
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
        const error = new Error(instagramResponseMessage(response) || t('http_error', xhr.status));
        error.status = xhr.status;
        reject(error);
      }
    };
    xhr.onerror = () => reject(instagramSessionError(xhr, null, originalUser) ||
      new Error(t('network_error')));
    xhr.ontimeout = () => reject(new Error(t('instagram_timeout')));
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
window.navigation?.addEventListener('currententrychange', scheduleStoryButtonScan);
window.addEventListener('resize', scheduleStoryButtonScan);
window.addEventListener('scroll', () => {
  if (getPostPermalink(location.pathname)) scheduleStoryButtonScan();
}, { capture: true, passive: true });
})();
