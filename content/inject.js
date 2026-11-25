(() => {
'use strict';

let isUploading = false;

function getFeedPostLink(article) {
  const links = Array.from(article.querySelectorAll('a[href]')).filter(link =>
    link.origin === location.origin && /^\/(?:p|reel|tv)\/[A-Za-z0-9_-]{1,11}\/?$/.test(link.pathname)
  );
  const timestampLink = links.find(link => link.querySelector('time'));
  if (timestampLink) return timestampLink;
  return new Set(links.map(link => link.pathname.replace(/\/$/, ''))).size === 1 ? links[0] : null;
}

function getPostMediaId(shortcode) {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
  let id = 0n;
  for (const char of shortcode) {
    id = id * 64n + BigInt(alphabet.indexOf(char));
  }
  return id.toString();
}

function addFeedStoryButtons() {
  for (const article of document.querySelectorAll('main article')) {
    if (article.querySelector('.sharetostory-share-story')) continue;
    if (!getFeedPostLink(article)) continue;

    const shareIcon = Array.from(article.querySelectorAll('svg[aria-label], svg:has(title)')).find(icon => {
      const label = icon.getAttribute('aria-label') || icon.querySelector('title')?.textContent || '';
      return /^(?:share(?: post)?|compartir(?: publicación)?)$/i.test(label.trim());
    });
    if (!shareIcon) continue;

    // Find the action row, which can contain the share count as a separate item.
    let shareItem = shareIcon.closest('button, [role="button"]') || shareIcon;
    while (shareItem.parentElement && shareItem.parentElement !== article) {
      const row = shareItem.parentElement;
      const style = getComputedStyle(row);
      if (style.display.includes('flex') && style.flexDirection.startsWith('row') &&
          Array.from(row.children).some(item =>
            item !== shareItem && item.querySelector('button svg, [role="button"] svg, svg[aria-label]')
          )) {
        break;
      }
      shareItem = row;
    }
    if (shareItem.parentElement === article || !shareItem.parentElement) continue;

    let insertionPoint = shareItem;
    let next = shareItem.nextSibling;
    while (next && !next.textContent.trim() && next.nodeType !== Node.ELEMENT_NODE) {
      next = next.nextSibling;
    }
    const shareCount = /^\d[\d\s.,\u202f]*(?:mil(?:l?\.)?|[kmb])?$/i;
    if (next && !next.matches?.('button, [role="button"], svg') &&
        !next.querySelector?.('button, [role="button"], svg') &&
        shareCount.test(next.textContent.trim())) {
      insertionPoint = next;
    }

    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'sharetostory-share-story';
    button.setAttribute('aria-label', 'Compartir en mis stories');
    button.title = 'Compartir en mis stories';
    const icon = shareIcon.cloneNode(true);
    icon.removeAttribute('aria-label');
    icon.setAttribute('aria-hidden', 'true');
    icon.querySelector('title')?.remove();
    button.appendChild(icon);
    button.addEventListener('click', event => {
      event.stopPropagation();
      const link = getFeedPostLink(article);
      if (!link) {
        alert('No se pudo identificar la publicación original.');
        return;
      }
      const shortcode = link.pathname.split('/')[2];
      openFeedStoryModal(link.origin + link.pathname, getPostMediaId(shortcode));
    });
    insertionPoint.after(button);
  }
}

function openFeedStoryModal(url, mediaId) {
  if (isUploading) return;

  document.getElementById('sharetostory-modal')?.remove();
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
        <a class="sharetostory-reshare-source" target="_blank" rel="noopener noreferrer">Ver publicación original</a>
        <p role="status"></p>
        <div class="sharetostory-actions">
          <button type="button" class="sharetostory-btn-primary">Publicar historia</button>
        </div>
      </div>
    </div>
  `;
  modal.querySelector('a').href = url;
  const publish = modal.querySelector('.sharetostory-btn-primary');
  const close = modal.querySelector('.sharetostory-close-btn');
  const status = modal.querySelector('[role="status"]');
  close.addEventListener('click', () => modal.remove());
  publish.addEventListener('click', async () => {
    if (isUploading) return;
    isUploading = true;
    publish.disabled = true;
    close.disabled = true;
    status.textContent = 'Publicando historia…';
    try {
      const canvas = document.createElement('canvas');
      canvas.width = 1080;
      canvas.height = 1920;
      const context = canvas.getContext('2d');
      context.fillStyle = '#17171c';
      context.fillRect(0, 0, canvas.width, canvas.height);
      const background = await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', 0.9));
      if (!background) throw new Error('No se pudo preparar el fondo de la historia.');
      await InstagramAPI.publishReshare(mediaId, background, canvas.width, canvas.height);
      status.textContent = 'Instagram aceptó la historia. Ábrela para comprobar la publicación adjunta.';
    } catch (error) {
      status.textContent = 'No se pudo publicar la historia. ' + error.message;
      publish.disabled = false;
    } finally {
      isUploading = false;
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

  getFBDestinationId() {
    // Try to extract Facebook destination ID from page data
    try {
      // Check localStorage for cached FB ID
      const fbDestId = localStorage.getItem('fb_destination_id');
      if (fbDestId) {
        return fbDestId;
      }

      // Try to find in inline scripts
      const scripts = document.querySelectorAll('script');
      for (const script of scripts) {
        const content = script.textContent || '';
        // Look for fb_destination_id pattern
        const match = content.match(/["|']fb_destination_id["|']:\s*["|']([^"']+)["|']/);
        if (match) {
          localStorage.setItem('fb_destination_id', match[1]); // Cache it
          return match[1];
        }
      }

      console.warn('FB destination ID not found, using empty string (story upload may fail)');
    } catch (e) {
      console.warn('Could not extract FB destination ID:', e);
    }
    return '';
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


  async publishReshare(mediaId, background, width, height) {
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

    await postToInstagram(`https://i.instagram.com/rupload_igphoto/${entityName}`, {
      ...commonHeaders,
      'Content-Type': 'image/jpeg',
      'Offset': '0',
      'X-Entity-Length': String(background.size),
      'X-Entity-Name': entityName,
      'X-Entity-Type': 'image/jpeg',
      'X-Instagram-Rupload-Params': JSON.stringify({
        media_type: 1,
        upload_id: uploadId,
        upload_media_height: height,
        upload_media_width: width
      })
    }, background);

    const body = new URLSearchParams({
      upload_id: uploadId,
      caption: '',
      configure_mode: '1',
      share_to_facebook: '',
      share_to_fb_destination_id: this.getFBDestinationId(),
      share_to_fb_destination_type: 'USER',
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
    const response = await postToInstagram('https://www.instagram.com/api/v1/media/configure_to_story/', {
      ...commonHeaders,
      'Content-Type': 'application/x-www-form-urlencoded',
      'X-CSRFToken': csrfToken,
      'X-Requested-With': 'XMLHttpRequest',
      ...(claim && { 'X-IG-WWW-Claim': claim })
    }, body.toString());
    if (response?.status !== 'ok') {
      throw new Error(response?.message || 'Instagram no confirmó la publicación.');
    }
  }
};

function postToInstagram(url, headers, body) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', url);
    xhr.withCredentials = true;
    xhr.responseType = 'json';
    for (const [name, value] of Object.entries(headers)) {
      xhr.setRequestHeader(name, value);
    }
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve(xhr.response);
      } else {
        reject(new Error(xhr.response?.message || `Instagram respondió con HTTP ${xhr.status}.`));
      }
    };
    xhr.onerror = () => reject(new Error('No se pudo conectar con Instagram.'));
    xhr.send(body);
  });
}

addFeedStoryButtons();
let scanScheduled = false;
new MutationObserver(() => {
  if (scanScheduled) return;
  scanScheduled = true;
  requestAnimationFrame(() => {
    scanScheduled = false;
    addFeedStoryButtons();
  });
}).observe(document.body, { subtree: true, childList: true });
})();
