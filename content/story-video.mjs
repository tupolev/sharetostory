import { BlobSource, BufferTarget, Conversion, Input, MP4, Mp4OutputFormat, Output, canEncodeVideo } from '../vendor/mediabunny.min.mjs';

export function getStoryVideoFrame(videoWidth, videoHeight, width, height) {
  // Keep the full frame within the central 80% for taller phone screens.
  const scale = Math.min(width * 0.8 / videoWidth, height / videoHeight);
  const fittedWidth = Math.round(videoWidth * scale);
  const fittedHeight = Math.round(videoHeight * scale);
  return [(width - fittedWidth) / 2, (height - fittedHeight) / 2, fittedWidth, fittedHeight];
}

export function getStoryFrameRate(sourceRate) {
  if (!Number.isFinite(sourceRate) || sourceRate <= 0) return 30;
  if (sourceRate < 20) return Math.max(1, Math.round(sourceRate));

  const rates = [24000 / 1001, 24, 25, 30000 / 1001, 30, 50, 60000 / 1001, 60];
  return rates.reduce((closest, rate) =>
    Math.abs(rate - sourceRate) < Math.abs(closest - sourceRate) ? rate : closest
  );
}

export async function prepareStoryVideo(blob) {
  const input = new Input({ source: new BlobSource(blob), formats: [MP4] });
  try {
    const videoTrack = await input.getPrimaryVideoTrack();
    if (!videoTrack) throw new Error('No se encontró una pista de vídeo en el MP4.');
    const duration = await videoTrack.computeDuration();
    if (!Number.isFinite(duration) || duration <= 0) {
      throw new Error('El vídeo descargado no tiene una duración válida.');
    }
    const width = 1080;
    const height = 1920;
    const { averagePacketRate } = await videoTrack.computePacketStats(180);
    const frameRate = getStoryFrameRate(averagePacketRate);
    const bitrate = Math.round(Math.min(16000000, Math.max(8000000, blob.size * 10 / duration)));
    const codec = await canEncodeVideo('avc', { width, height, bitrate }) ? 'avc' : 'vp9';
    const canvas = new OffscreenCanvas(width, height);
    const context = canvas.getContext('2d');
    const target = new BufferTarget();
    const output = new Output({ format: new Mp4OutputFormat(), target });
    let cover;
    const conversion = await Conversion.init({
      input,
      output,
      video: {
        codec,
        bitrate,
        frameRate,
        allowTransformationMetadata: false,
        processedWidth: width,
        processedHeight: height,
        process: async sample => {
          const frame = getStoryVideoFrame(sample.displayWidth, sample.displayHeight, width, height);
          context.fillStyle = '#17171c';
          context.fillRect(0, 0, width, height);
          sample.draw(context, ...frame);
          cover ??= await canvas.convertToBlob({ type: 'image/jpeg', quality: 0.9 });
          return canvas;
        }
      }
    });
    if (!conversion.isValid || conversion.discardedTracks.some(({ track }) => track.type === 'audio')) {
      throw new Error('Chrome no pudo preparar el MP4 con las pistas del vídeo original.');
    }
    await conversion.execute();
    if (!target.buffer?.byteLength || !cover) throw new Error('Chrome generó un vídeo vacío.');
    return { media: new Blob([target.buffer], { type: 'video/mp4' }), width, height, duration, cover, frameRate };
  } finally {
    input.dispose();
  }
}
