# Forma — Estudio de diseño 3D con asistente de IA

Editor 3D que corre entero en el navegador (Three.js, sin backend) para crear
escenas a partir de primitivas — o describiéndolas en lenguaje natural a un
asistente integrado que interpreta el texto y construye la geometría.

![tecnología](https://img.shields.io/badge/three.js-0.161-8fa3ad)
![sin backend](https://img.shields.io/badge/backend-ninguno-5fd4c4)

## Qué incluye

- **Lienzo 3D** con Three.js: cámara orbital, luces, sombras y una cuadrícula de referencia.
- **Primitivas**: cubo, esfera, cilindro, cono, toroide y plano, con materiales estándar, metálico, cristal y mate.
- **Herramientas de transformación**: mover, rotar y escalar con gizmo interactivo (atajos `G`, `R`, `S`).
- **Inspector** de posición, rotación, escala, color y material del objeto seleccionado.
- **Jerarquía** de la escena, duplicar/eliminar objetos, deshacer/rehacer.
- **Asistente de diseño**: una consola de texto donde escribes comandos y la app los ejecuta. No usa ninguna API externa — interpreta el lenguaje con un conjunto de reglas (`js/ai-assistant.js`), incluyendo "prefabs" que componen varias primitivas a la vez a partir de una sola palabra.
- **Guardar / abrir** la escena como `.json`, y **exportar** a `.gltf` para usar en Blender, Unity, etc.

## Comandos de ejemplo para el asistente

```
añade un cubo rojo
crea una esfera de cristal
construye una casa
construye un árbol verde
haz un robot
construye una torre
mueve el cubo a 2 0 0
rota la esfera 45
escala el cono 1.5
pinta el cubo de azul
duplica la esfera
elimina el cilindro
limpia todo
```

## Cómo ejecutarlo en local

No hay proceso de build para desarrollo. Sirve la **raíz del repositorio**
(no la carpeta `src/`) como archivos estáticos — `index.html` usa una ruta
relativa (`../style.css`) que necesita partir de la raíz:

```bash
# con Python
python3 -m http.server 8000

# o con Node
npx serve .
```

Luego abre `http://localhost:8000/src/index.html`.

### Publicarlo con GitHub Pages

Ya está automatizado por `.github/workflows/deploy.yml` — solo necesitas
ir a *Settings → Pages → Source* y elegir **"GitHub Actions"** una vez.
Cada push a `main` vuelve a publicar automáticamente en
`https://tu-usuario.github.io/tu-repo/`.

## Estructura

```
├── .github/
│   ├── dependabot.yml        actualiza dependencias y Actions automáticamente
│   └── workflows/
│       ├── sec-sast.yml      análisis estático de código (Semgrep)
│       ├── sec-secrets.yml   detecta contraseñas/API keys filtradas (Gitleaks)
│       └── deploy.yml        despliega a GitHub Pages en cada push a main
├── src/
│   ├── index.html            interfaz de la app
│   └── js/
│       ├── app.js             escena 3D, herramientas, inspector, historial
│       └── ai-assistant.js    intérprete de comandos en lenguaje natural
├── style.css
├── .gitignore
├── LICENSE
├── README.md
└── GUIA-DE-USO.md
```

### Seguridad y despliegue automático (CI/CD)

El repositorio incluye tres workflows de GitHub Actions, en `.github/workflows/`:

- **`sec-sast.yml`** — analiza el código en cada push/PR buscando patrones
  inseguros (Semgrep). Los resultados aparecen en la pestaña *Security* del repo.
- **`sec-secrets.yml`** — revisa cada commit por si se coló alguna clave o
  contraseña (Gitleaks); si encuentra algo, el workflow falla.
- **`deploy.yml`** — arma una carpeta `dist/` con solo lo necesario para el
  sitio (`src/index.html` + `src/js/` + `style.css`) y la publica en GitHub
  Pages automáticamente al hacer push a `main`.

Y **`dependabot.yml`** revisa semanalmente si hay versiones nuevas de las
Actions usadas (y de dependencias npm, si en el futuro añades un
`package.json`), abriendo un Pull Request cuando corresponde.

**Único paso manual necesario:** en el repositorio, ve a
*Settings → Pages → Source* y elige **"GitHub Actions"** (no "Deploy from a
branch") para que `deploy.yml` pueda publicar.

## Ampliarlo con un modelo de lenguaje real

`js/ai-assistant.js` expone una única función, `interpret(texto, api)`, que
recibe la frase del usuario y un pequeño API para manipular la escena
(`addShape`, `removeObject`, `findByName`, etc.). Para conectar un LLM real
(por ejemplo la API de Anthropic) en vez de las reglas actuales, basta con
sustituir el cuerpo de esa función por una llamada al modelo pidiéndole que
devuelva una lista de acciones en JSON, y ejecutarlas contra `api`. El resto
de la aplicación no necesita cambios.

## Licencia

MIT — usa, modifica y redistribuye libremente. Ver `LICENSE.md`.
