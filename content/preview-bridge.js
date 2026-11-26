(() => {
  'use strict';

  let encoding = false;

  window.addEventListener('message', async event => {
    const request = event.data;
    if (event.source !== window || event.origin !== location.origin || typeof request?.id !== 'string') return;

    let result;
    if (request.type === 'SHARETOSTORY_PREVIEW_REQUEST' && typeof request.url === 'string') {
      try {
        result = await chrome.runtime.sendMessage({
          type: request.type, url: request.url, video: request.video === true
        });
      } catch {
        result = { errorCode: 'reload_instagram' };
      }
    } else if (request.type === 'SHARETOSTORY_ENCODE_REQUEST' &&
               request.video instanceof Blob && request.video.type === 'video/mp4' &&
               request.video.size > 0 && request.video.size <= 40 * 1024 * 1024) {
      if (encoding) {
        window.postMessage({
          type: 'SHARETOSTORY_PREVIEW_RESPONSE', id: request.id,
          result: { errorCode: 'encoding_busy' }
        }, location.origin);
        return;
      }
      encoding = true;
      try {
        const { prepareStoryVideo } = await import(chrome.runtime.getURL('content/story-video.mjs'));
        result = await prepareStoryVideo(request.video);
      } catch (error) {
        const conversionErrors = ['no_video_track', 'invalid_duration', 'track_conversion_failed', 'empty_video'];
        result = { errorCode: conversionErrors.includes(error.message) ? error.message : 'encode_failed' };
      } finally {
        encoding = false;
      }
    } else {
      return;
    }

    window.postMessage({ type: 'SHARETOSTORY_PREVIEW_RESPONSE', id: request.id, result }, location.origin);
  });
})();
