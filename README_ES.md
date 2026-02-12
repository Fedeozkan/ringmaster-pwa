# Ring Master PWA (sin Mac, 100% Windows)

Esta es una **PWA** (web‑app instalable) basada en tu hoja "Ring Master.xlsx".
- Funciona en iPhone como una app (icono, pantalla completa).
- Puedes **elegir tus días de entreno** (L–D).
- Modo **Entreno** paso a paso (temporizador / reps).
- Vídeos **incrustados** (YouTube embed) dentro de la app.
- Guardado de progreso en el dispositivo (localStorage).

> Nota: los vídeos no estarán disponibles offline si son de YouTube.
> La UI y tus datos (programa y ejercicios) sí se pueden cachear offline con Service Worker,
> pero iOS exige que el sitio esté en **HTTPS** para que el offline funcione bien.

## Opción A (recomendada): Publicarla gratis con GitHub Pages (HTTPS)

1) Crea una cuenta en GitHub.
2) Crea un repositorio nuevo, por ejemplo: `ringmaster-pwa`
3) Sube **todo el contenido de esta carpeta** (index.html, app.js, etc.)
4) En GitHub:
   - Settings → Pages
   - Source: "Deploy from a branch"
   - Branch: `main` / folder: `/root`
5) Te dará una URL tipo: `https://TUUSUARIO.github.io/ringmaster-pwa/`

## Instalar en iPhone
1) Abre esa URL en **Safari** (no Chrome).
2) Botón Compartir → **Añadir a pantalla de inicio**
3) Abre la app desde el icono.

## Opción B: Netlify/Cloudflare Pages (también HTTPS)
- Subes la carpeta y te dan una URL HTTPS.

## Local en tu PC (sirve para probar, no ideal para instalar)
Puedes levantar un servidor local:
- Python: `python -m http.server 8080`
Luego abre `http://IP-DE-TU-PC:8080/` en el iPhone.
(Instalar funciona, pero offline/Service Worker puede fallar sin HTTPS.)

