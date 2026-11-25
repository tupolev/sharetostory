'use strict';

chrome.runtime.onMessage.addListener((request, sender, respond) => {
  if (request?.type !== 'SHARETOSTORY_PREVIEW_REQUEST' ||
      sender.origin !== 'https://www.instagram.com' || !sender.tab) return;

  loadStoryMedia(request.url, request.video === true, request.audio === true).then(
    data => respond({ data }),
    error => respond({ error: error.message })
  );
  return true;
});

async function loadStoryMedia(source, video, audio) {
  const url = new URL(source);
  if (url.protocol !== 'https:' || url.username || url.password || url.port ||
      !/(^|\.)(cdninstagram\.com|fbcdn\.net)$/.test(url.hostname)) {
    throw new Error('Instagram no proporcionó una dirección multimedia compatible.');
  }

  const response = await fetch(url, {
    credentials: 'omit',
    redirect: 'error',
    signal: AbortSignal.timeout(video || audio ? 25000 : 10000)
  });
  const type = response.headers.get('Content-Type') || '';
  if (video || audio) {
    const format = audio ? /^(audio\/mp4|video\/mp4|application\/octet-stream)(?:;|$)/i
      : /^(video\/mp4|application\/octet-stream)(?:;|$)/i;
    if (!response.ok || response.status !== 200 || !format.test(type)) {
      throw new Error(audio ? 'No se pudo descargar la pista de audio.' : 'No se pudo descargar el vídeo MP4 completo.');
    }
    return encodeMedia(await readVideo(response));
  }
  if (!response.ok || !/^image\/(jpeg|png|webp|avif)(?:;|$)/i.test(type)) {
    throw new Error('No se pudo descargar la imagen del post.');
  }

  return encodeMedia(await makeStoryPreview(await response.blob()));
}

async function readVideo(response) {
  // Chrome extension messaging serializes the binary payload as base64.
  const limit = 40 * 1024 * 1024;
  const tooLarge = () => new Error('El vídeo supera el límite de 40 MB de la extensión.');
  if (Number(response.headers.get('Content-Length')) > limit) throw tooLarge();
  const reader = response.body.getReader();
  const chunks = [];
  let size = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > limit) {
      await reader.cancel();
      throw tooLarge();
    }
    chunks.push(value);
  }

  const video = new Blob(chunks, { type: 'video/mp4' });
  const header = new Uint8Array(await video.slice(4, 8).arrayBuffer());
  if (String.fromCharCode(...header) !== 'ftyp') {
    throw new Error('Instagram no proporcionó un archivo MP4 compatible.');
  }
  return video;
}

async function makeStoryPreview(source) {
  const bitmap = await createImageBitmap(source);
  let image;
  try {
    const canvas = new OffscreenCanvas(1080, 1920);
    const context = canvas.getContext('2d');
    context.fillStyle = '#17171c';
    context.fillRect(0, 0, canvas.width, canvas.height);

    const scale = Math.min(864 / bitmap.width, 1152 / bitmap.height);
    const width = Math.round(bitmap.width * scale);
    const height = Math.round(bitmap.height * scale);
    context.drawImage(bitmap, (canvas.width - width) / 2, (canvas.height - height) / 2, width, height);
    image = await canvas.convertToBlob({ type: 'image/jpeg', quality: 0.9 });
  } finally {
    bitmap.close();
  }

  return image;
}

async function encodeMedia(media) {
  const bytes = new Uint8Array(await media.arrayBuffer());
  let binary = '';
  for (let offset = 0; offset < bytes.length; offset += 8192) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + 8192));
  }
  return btoa(binary);
}
