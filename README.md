# sharetostory

Extensión de Chrome para compartir posts, reels e historias de Instagram en tus propias historias.

## Instalación

1. Abre `chrome://extensions/` en Chrome 120 o posterior.
2. Activa **Modo de desarrollador**, pulsa **Cargar descomprimida** y selecciona la carpeta que contiene `manifest.json`.
3. Inicia sesión en Instagram y recarga la pestaña.

## Uso

Desde el feed o la página individual de un post o reel, pulsa el icono naranja **Compartir en mis stories**, justo antes del botón de compartir de Instagram. Comprueba el enlace a la publicación original y pulsa **Publicar historia**.

En el visor de historias, el mismo icono aparece junto a los controles de la historia activa. Si la historia es un vídeo, **Preparar vídeo** genera un MP4 descargable para publicar manualmente. Instagram puede cerrar la sesión al intentar publicar automáticamente vídeos desde el visor.

Las fotos se comparten como imagen. Los reels y vídeos se suben como vídeo con el audio del archivo original y admiten archivos MP4 de hasta 40 MiB. La historia conserva una referencia al post original.

Chrome ajusta los vídeos fotograma a fotograma a un marco vertical de 9:16 con márgenes. El vídeo resultante tiene una cadencia constante próxima a la del archivo original. El enlace **Ver MP4 preparado** abre el archivo que la extensión prepara para subir.

La publicación depende de que Instagram acepte el adjunto y de la configuración para compartir del post original.

## Créditos

sharetostory se desarrolló a partir de [InstaFox](https://github.com/RedLeZ/InstaFox), de RedLeZ. Consulta la [licencia MIT](LICENSE).

La conversión usa [Mediabunny 1.61.0](https://github.com/Vanilagy/mediabunny/tree/v1.61.0), distribuido con su [licencia MPL 2.0](vendor/mediabunny.LICENSE).
