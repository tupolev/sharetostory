# ShareToStory

[English](#english) · [Español](#español)

## English

ShareToStory is a Chrome extension that adds a share-to-Story button to the Instagram home feed and to individual photos, videos and reels. It uses your active Instagram session. The extension prepares media in the browser and keeps a reference to the original post in the new story when Instagram accepts it.

### Install locally

1. Open `chrome://extensions/` in Chrome 120 or later.
2. Enable **Developer mode**, click **Load unpacked**, and select the folder containing `manifest.json`.
3. Sign in to Instagram and reload the tab.

### Share a post

Click the orange **Share to my story** icon next to Instagram’s share button. Check the link to the original post, then click **Publish story**. After Instagram confirms publication, the dialog closes after five seconds.

Photos are shared as images. Videos and reels are prepared as vertical 9:16 videos with the full frame visible and the original audio. The extension accepts source MP4 files up to 40 MiB. **View prepared MP4** opens the file used for upload. Publishing depends on your Instagram session and the original post’s sharing settings.

### Languages

The interface uses the browser’s preferred language. It supports English, Spanish, German, Catalan, Galician, Basque and French, with English as the fallback. After changing your preferred browser language, reload the Instagram tab.

## Español

ShareToStory es una extensión de Chrome que añade un botón para compartir en tus historias desde el feed principal de Instagram y desde la página individual de una foto, un vídeo o un reel. Usa tu sesión activa de Instagram. La extensión prepara el archivo en el navegador y conserva una referencia a la publicación original cuando Instagram la acepta.

### Instalar en local

1. Abre `chrome://extensions/` en Chrome 120 o posterior.
2. Activa **Modo de desarrollador**, pulsa **Cargar descomprimida** y selecciona la carpeta que contiene `manifest.json`.
3. Inicia sesión en Instagram y recarga la pestaña.

### Compartir una publicación

Pulsa el icono naranja **Compartir en mi historia**, junto al botón de compartir de Instagram. Comprueba el enlace a la publicación original y pulsa **Publicar historia**. Cuando Instagram confirma la publicación, el diálogo se cierra al cabo de cinco segundos.

Las fotos se comparten como imagen. Los vídeos y reels se preparan en formato vertical 9:16 para mostrar el fotograma completo y conservar el audio original. La extensión admite archivos MP4 de origen de hasta 40 MiB. **Ver MP4 preparado** abre el archivo que se envía. La publicación depende de tu sesión de Instagram y de la configuración para compartir del post original.

### Idiomas

La interfaz usa el idioma preferido del navegador. Admite inglés, español, alemán, catalán, gallego, euskera y francés. Si ese idioma no está disponible, muestra los textos en inglés. Si cambias el idioma preferido del navegador, recarga la pestaña de Instagram.

## Credits / Créditos

ShareToStory is based on [InstaFox](https://github.com/RedLeZ/InstaFox), by RedLeZ. See the [MIT license](LICENSE).

ShareToStory se desarrolló a partir de [InstaFox](https://github.com/RedLeZ/InstaFox), de RedLeZ. Consulta la [licencia MIT](LICENSE).

Video processing uses [Mediabunny 1.61.0](https://github.com/Vanilagy/mediabunny/tree/v1.61.0), distributed under the [MPL 2.0 license](vendor/mediabunny.LICENSE).

La conversión de vídeo usa [Mediabunny 1.61.0](https://github.com/Vanilagy/mediabunny/tree/v1.61.0), distribuido con su [licencia MPL 2.0](vendor/mediabunny.LICENSE).
