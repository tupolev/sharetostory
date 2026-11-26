# ShareToStory

[English](#english) · [Español](#español)

## English

ShareToStory is a Chrome extension for sharing Instagram photos, videos and reels to your own Stories. It adds an orange **Share to my story** icon immediately before Instagram’s share button in the home feed and on individual post and reel pages.

### Install from GitHub

1. [Download the source ZIP](https://github.com/tupolev/sharetostory/archive/refs/heads/main.zip) and extract it, or run `git clone https://github.com/tupolev/sharetostory.git`.
2. In Chrome 120 or later, open `chrome://extensions/`, turn on **Developer mode**, and click **Load unpacked**.
3. Select the folder containing `manifest.json`. Sign in to [Instagram](https://www.instagram.com/) and reload the tab.
4. After updating the files, reload ShareToStory on the extensions page and then reload Instagram.

### Share a photo, video or reel

1. Click the orange icon and check the original post from the dialog. The dialog follows Instagram’s light or dark theme.
2. Click **Publish story**. Clicking outside the dialog before starting publication dismisses it.
3. Once Instagram confirms publication, **Close window (5 s)** counts down and closes the dialog on the same page. Click it to close sooner.

Photos are prepared as images. Videos and reels are fitted into a vertical 9:16 frame with margins to keep the full picture visible. The extension preserves the audio track and accepts source MP4 files up to 40 MiB. **View prepared MP4** opens the video used for the upload. If publication fails after preparation, **Download MP4** saves the file.

Publication uses your existing Instagram session and depends on Instagram accepting the request and the reference to the original post. If publication fails, the dialog reports the stage. If Instagram asks you to sign in or verify your account, check your account and whether the story was published before trying again.

### Languages and permissions

The in-page interface follows your browser’s preferred language and supports English, Spanish, German, Catalan, Galician, Basque and French. English is the fallback. Reload the Instagram tab after changing the language.

ShareToStory runs on `www.instagram.com`. It downloads media from Instagram’s CDN domains, prepares the file in your browser and sends it to Instagram when you confirm publication.

## Español

ShareToStory es una extensión de Chrome para compartir fotos, vídeos y reels de Instagram en tus propias historias. Añade el icono naranja **Compartir en mi historia** justo antes del botón de compartir de Instagram en el feed principal y en las páginas individuales de publicaciones y reels.

### Instalar desde GitHub

1. [Descarga el ZIP del código](https://github.com/tupolev/sharetostory/archive/refs/heads/main.zip) y descomprímelo, o ejecuta `git clone https://github.com/tupolev/sharetostory.git`.
2. En Chrome 120 o posterior, abre `chrome://extensions/`, activa **Modo de desarrollador** y pulsa **Cargar descomprimida**.
3. Selecciona la carpeta que contiene `manifest.json`. Inicia sesión en [Instagram](https://www.instagram.com/) y recarga la pestaña.
4. Después de actualizar los archivos, recarga ShareToStory en la página de extensiones y luego recarga Instagram.

### Compartir una foto, un vídeo o un reel

1. Pulsa el icono naranja y comprueba la publicación original desde el diálogo. La ventana sigue el tema claro u oscuro de Instagram.
2. Pulsa **Publicar historia**. Hacer clic fuera del diálogo antes de iniciar la publicación lo cierra.
3. Cuando Instagram confirma la publicación, **Cerrar ventana (5 s)** muestra la cuenta atrás y cierra el diálogo en la misma página. Pulsa el botón para cerrarlo antes.

Las fotos se preparan como imágenes. Los vídeos y reels se ajustan a un marco vertical de 9:16 con márgenes para mostrar el fotograma completo. La extensión conserva la pista de audio y admite archivos MP4 de origen de hasta 40 MiB. **Ver MP4 preparado** abre el vídeo que se envía. Si la publicación falla después de prepararlo, **Descargar MP4** permite guardar el archivo.

La publicación usa tu sesión de Instagram y depende de que Instagram acepte la solicitud y la referencia al post original. Si falla, el diálogo indica en qué paso ocurrió. Si Instagram te pide iniciar sesión o verificar la cuenta, comprueba tu cuenta y si la historia llegó a publicarse antes de reintentar.

### Idiomas y permisos

La interfaz usa el idioma preferido del navegador. Admite inglés, español, alemán, catalán, gallego, euskera y francés, con inglés como idioma de reserva. Recarga la pestaña de Instagram después de cambiar el idioma.

ShareToStory funciona en `www.instagram.com`. Descarga el contenido de los dominios CDN de Instagram, prepara el archivo en el navegador y lo envía a Instagram cuando confirmas la publicación.

## Credits / Créditos

Based on [InstaFox](https://github.com/RedLeZ/InstaFox) by RedLeZ. See the [MIT license](LICENSE).

Basado en [InstaFox](https://github.com/RedLeZ/InstaFox), de RedLeZ. Consulta la [licencia MIT](LICENSE).

Video processing uses [Mediabunny 1.61.0](https://github.com/Vanilagy/mediabunny/tree/v1.61.0) under the [MPL 2.0 license](vendor/mediabunny.LICENSE).

La conversión de vídeo usa [Mediabunny 1.61.0](https://github.com/Vanilagy/mediabunny/tree/v1.61.0) bajo la [licencia MPL 2.0](vendor/mediabunny.LICENSE).
