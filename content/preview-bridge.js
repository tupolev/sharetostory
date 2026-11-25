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
          type: request.type, url: request.url, video: request.video === true, audio: request.audio === true
        });
      } catch {
        result = { error: 'No se pudo cargar el contenido. Recarga Instagram y vuelve a intentarlo.' };
      }
    } else if (request.type === 'SHARETOSTORY_ENCODE_REQUEST' &&
               request.video instanceof Blob && request.video.type === 'video/mp4' &&
               request.video.size > 0 && request.video.size <= 40 * 1024 * 1024 &&
               (request.audio === undefined || (request.audio instanceof Blob && request.audio.type === 'audio/mp4' &&
                 request.audio.size > 0 && request.audio.size <= 40 * 1024 * 1024)) && !encoding) {
      encoding = true;
      try {
        const { prepareStoryVideo } = await import(chrome.runtime.getURL('content/story-video.mjs'));
        result = await prepareStoryVideo(request.video, request.audio);
      } catch (error) {
        result = { error: 'No se pudo ajustar el vídeo fotograma a fotograma. ' + error.message };
      } finally {
        encoding = false;
      }
    } else {
      return;
    }

    window.postMessage({ type: 'SHARETOSTORY_PREVIEW_RESPONSE', id: request.id, result }, location.origin);
  });
})();
