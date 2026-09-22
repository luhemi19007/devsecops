import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { TransformControls } from 'three/addons/controls/TransformControls.js';
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js';
import { STLExporter } from 'three/addons/exporters/STLExporter.js';

import { interpret } from './ai-assistant.js';

/* ------------------------------------------------------------------ */
/* Escena                                                              */
/* ------------------------------------------------------------------ */

const canvas = document.getElementById('viewport');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x12161a);
scene.fog = new THREE.Fog(0x12161a, 18, 42);

const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 200);
camera.position.set(6, 5, 8);

const hemi = new THREE.HemisphereLight(0xbfd9ff, 0x1a1410, 0.65);
scene.add(hemi);

const key = new THREE.DirectionalLight(0xffffff, 1.4);
key.position.set(6, 9, 4);
key.castShadow = true;
key.shadow.mapSize.set(2048, 2048);
key.shadow.camera.left = -10;
key.shadow.camera.right = 10;
key.shadow.camera.top = 10;
key.shadow.camera.bottom = -10;
scene.add(key);

const fill = new THREE.DirectionalLight(0xff8a3d, 0.25);
fill.position.set(-6, 3, -4);
scene.add(fill);

const grid = new THREE.GridHelper(30, 30, 0x2b333a, 0x1e2429);
grid.position.y = 0;
scene.add(grid);

const groundGeo = new THREE.PlaneGeometry(60, 60);
const groundMat = new THREE.ShadowMaterial({ opacity: 0.28 });
const ground = new THREE.Mesh(groundGeo, groundMat);
ground.rotation.x = -Math.PI / 2;
ground.receiveShadow = true;
scene.add(ground);

const isTouchDevice = ('ontouchstart' in window) || navigator.maxTouchPoints > 0;

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.08;
controls.target.set(0, 1, 0);
controls.maxDistance = 60;
controls.minDistance = 1.5;
controls.touches = { ONE: THREE.TOUCH.ROTATE, TWO: THREE.TOUCH.DOLLY_PAN };

const transform = new TransformControls(camera, renderer.domElement);
transform.addEventListener('dragging-changed', (e) => { controls.enabled = !e.value; });
transform.addEventListener('objectChange', () => { if (selected) syncInspectorFromObject(selected); updatePrintReadout(); });
scene.add(transform.getHelper ? transform.getHelper() : transform);
// en pantallas táctiles el gizmo por defecto es demasiado fino para
// acertar con el dedo, así que lo agrandamos.
if (isTouchDevice) transform.setSize(1.6);
// evita que el navegador capture los gestos (scroll/zoom de página) en
// vez de dejar que Three.js maneje el arrastre y el pellizco para zoom.
canvas.style.touchAction = 'none';
canvas.addEventListener('contextmenu', (e) => e.preventDefault());

const homeView = { position: camera.position.clone(), target: controls.target.clone() };
function resetView() {
  camera.position.copy(homeView.position);
  controls.target.copy(homeView.target);
  camera.updateProjectionMatrix();
}
document.getElementById('btn-reset-view').addEventListener('click', resetView);

function resize() {
  const wrap = canvas.parentElement;
  const w = wrap.clientWidth, h = wrap.clientHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}
new ResizeObserver(resize).observe(canvas.parentElement);
resize();

function tick() {
  controls.update();
  renderer.render(scene, camera);
  requestAnimationFrame(tick);
}
tick();

/* ------------------------------------------------------------------ */
/* Objetos de la escena (modelo de datos propio)                       */
/* ------------------------------------------------------------------ */

const MATERIALS = {
  standard: (c) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.55, metalness: 0.05 }),
  metal:    (c) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.25, metalness: 0.9 }),
  glass:    (c) => new THREE.MeshPhysicalMaterial({ color: c, roughness: 0.05, metalness: 0, transmission: 0.85, transparent: true, opacity: 0.55 }),
  matte:    (c) => new THREE.MeshStandardMaterial({ color: c, roughness: 1, metalness: 0 }),
};

const GEOMETRIES = {
  box:      () => new THREE.BoxGeometry(1, 1, 1),
  sphere:   () => new THREE.SphereGeometry(0.65, 32, 24),
  cylinder: () => new THREE.CylinderGeometry(0.6, 0.6, 1.2, 32),
  cone:     () => new THREE.ConeGeometry(0.65, 1.3, 32),
  torus:    () => new THREE.TorusGeometry(0.6, 0.22, 20, 40),
  plane:    () => new THREE.PlaneGeometry(1.5, 1.5),
};

const SHAPE_NAMES = { box: 'Cubo', sphere: 'Esfera', cylinder: 'Cilindro', cone: 'Cono', torus: 'Toroide', plane: 'Plano' };

let objects = [];     // { id, mesh, name, shape }
let selected = null;
let idCounter = 1;

function addShape({ shape, color = 0x8fa3ad, position = [0, 0.65, 0], rotation = [0, 0, 0], scale = [1, 1, 1], material = 'standard', name }) {
  const geo = (GEOMETRIES[shape] || GEOMETRIES.box)();
  const mat = MATERIALS[material](color);
  const mesh = new THREE.Mesh(geo, mat);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.position.set(...position);
  mesh.rotation.set(...rotation.map(deg => THREE.MathUtils.degToRad(deg)));
  mesh.scale.set(...scale);
  scene.add(mesh);

  const record = {
    id: idCounter++,
    mesh,
    shape,
    material,
    name: name || `${SHAPE_NAMES[shape] || 'Forma'} ${objects.length + 1}`,
  };
  objects.push(record);
  selectObject(record);
  refreshHierarchy();
  toggleEmptyHint();
  updatePrintReadout();
  pushHistory();
  return record;
}

function removeObject(record) {
  scene.remove(record.mesh);
  record.mesh.geometry.dispose();
  record.mesh.material.dispose();
  objects = objects.filter(o => o !== record);
  if (selected === record) selectObject(null);
  refreshHierarchy();
  toggleEmptyHint();
  updatePrintReadout();
  pushHistory();
}

function duplicateObject(record) {
  const clone = record.mesh.clone();
  clone.material = record.mesh.material.clone();
  scene.add(clone);
  const copy = {
    id: idCounter++,
    mesh: clone,
    shape: record.shape,
    material: record.material,
    name: record.name + ' copia',
  };
  clone.position.x += 1;
  objects.push(copy);
  selectObject(copy);
  refreshHierarchy();
  updatePrintReadout();
  pushHistory();
  return copy;
}

function findByName(query) {
  if (!query) return null;
  const q = query.trim().toLowerCase();
  return objects.find(o => o.name.toLowerCase() === q) ||
         objects.find(o => o.name.toLowerCase().includes(q)) ||
         objects.find(o => (SHAPE_NAMES[o.shape] || '').toLowerCase() === q) ||
         null;
}

function clearScene() {
  [...objects].forEach(removeObject);
}

/* ------------------------------------------------------------------ */
/* Selección + gizmo                                                   */
/* ------------------------------------------------------------------ */

function selectObject(record) {
  selected = record;
  if (record) {
    transform.attach(record.mesh);
  } else {
    transform.detach();
  }
  syncInspectorFromObject(record);
  refreshHierarchy();
}

let currentMode = 'translate';
function setMode(mode) {
  currentMode = mode;
  transform.setMode(mode);
  document.querySelectorAll('.tool-btn').forEach(b => b.classList.toggle('active', b.dataset.mode === mode));
  document.getElementById('mode-label').textContent = { translate: 'mover', rotate: 'rotar', scale: 'escalar' }[mode];
}

document.querySelectorAll('.tool-btn').forEach(btn => {
  btn.addEventListener('click', () => setMode(btn.dataset.mode));
});
setMode('translate');

let pointerDownAt = null;
renderer.domElement.addEventListener('pointerdown', (e) => {
  if (e.button !== 0) return;
  pointerDownAt = { x: e.clientX, y: e.clientY };
});

renderer.domElement.addEventListener('pointerup', (e) => {
  if (!pointerDownAt) return;
  const moved = Math.hypot(e.clientX - pointerDownAt.x, e.clientY - pointerDownAt.y);
  pointerDownAt = null;
  // si el puntero se desplazó, fue un gesto de orbitar/arrastrar la
  // cámara (o el propio gizmo), no un toque de selección.
  if (moved > 6) return;

  const rect = renderer.domElement.getBoundingClientRect();
  const ndc = new THREE.Vector2(
    ((e.clientX - rect.left) / rect.width) * 2 - 1,
    -((e.clientY - rect.top) / rect.height) * 2 + 1
  );
  const ray = new THREE.Raycaster();
  ray.setFromCamera(ndc, camera);
  const hits = ray.intersectObjects(objects.map(o => o.mesh));
  if (hits.length) {
    const rec = objects.find(o => o.mesh === hits[0].object);
    selectObject(rec);
  }
});

window.addEventListener('keydown', (e) => {
  if (document.activeElement && ['INPUT', 'SELECT', 'TEXTAREA'].includes(document.activeElement.tagName)) return;
  if (e.key === 'g') setMode('translate');
  if (e.key === 'r') setMode('rotate');
  if (e.key === 's') setMode('scale');
  if ((e.key === 'Delete' || e.key === 'Backspace') && selected) removeObject(selected);
  if (e.ctrlKey && e.key === 'z') undo();
  if (e.ctrlKey && e.key === 'y') redo();
});

/* ------------------------------------------------------------------ */
/* Panel: añadir forma                                                  */
/* ------------------------------------------------------------------ */

document.querySelectorAll('.shape-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    addShape({ shape: btn.dataset.shape, color: randomPalette() });
    logAI(`añadida forma «${SHAPE_NAMES[btn.dataset.shape]}»`);
  });
});

function randomPalette() {
  const palette = [0xff8a3d, 0x5fd4c4, 0x8fa3ad, 0xe2604f, 0xd9c26a, 0x7aa7d9];
  return palette[Math.floor(Math.random() * palette.length)];
}

/* ------------------------------------------------------------------ */
/* Jerarquía                                                            */
/* ------------------------------------------------------------------ */

const hierarchyEl = document.getElementById('hierarchy-list');
const countEl = document.getElementById('obj-count');

function refreshHierarchy() {
  hierarchyEl.innerHTML = '';
  countEl.textContent = objects.length ? `(${objects.length})` : '';
  objects.forEach(rec => {
    const li = document.createElement('li');
    li.className = 'hierarchy-item' + (rec === selected ? ' selected' : '');
    const sw = document.createElement('span');
    sw.className = 'hierarchy-swatch';
    sw.style.background = '#' + rec.mesh.material.color.getHexString();
    const label = document.createElement('span');
    label.textContent = rec.name;
    li.append(sw, label);
    li.addEventListener('click', () => selectObject(rec));
    hierarchyEl.appendChild(li);
  });
}

function toggleEmptyHint() {
  document.getElementById('empty-hint').style.display = objects.length ? 'none' : 'block';
}

/* ------------------------------------------------------------------ */
/* Inspector                                                            */
/* ------------------------------------------------------------------ */

const insEmpty = document.getElementById('inspector-empty');
const insBody = document.getElementById('inspector-body');
const f = {
  name: document.getElementById('prop-name'),
  px: document.getElementById('prop-px'), py: document.getElementById('prop-py'), pz: document.getElementById('prop-pz'),
  rx: document.getElementById('prop-rx'), ry: document.getElementById('prop-ry'), rz: document.getElementById('prop-rz'),
  sx: document.getElementById('prop-sx'), sy: document.getElementById('prop-sy'), sz: document.getElementById('prop-sz'),
  color: document.getElementById('prop-color'),
  material: document.getElementById('prop-material'),
};

function syncInspectorFromObject(rec) {
  if (!rec) { insEmpty.classList.remove('hidden'); insBody.classList.add('hidden'); return; }
  insEmpty.classList.add('hidden');
  insBody.classList.remove('hidden');
  const m = rec.mesh;
  f.name.value = rec.name;
  f.px.value = m.position.x.toFixed(2); f.py.value = m.position.y.toFixed(2); f.pz.value = m.position.z.toFixed(2);
  f.rx.value = THREE.MathUtils.radToDeg(m.rotation.x).toFixed(0);
  f.ry.value = THREE.MathUtils.radToDeg(m.rotation.y).toFixed(0);
  f.rz.value = THREE.MathUtils.radToDeg(m.rotation.z).toFixed(0);
  f.sx.value = m.scale.x.toFixed(2); f.sy.value = m.scale.y.toFixed(2); f.sz.value = m.scale.z.toFixed(2);
  f.color.value = '#' + m.material.color.getHexString();
  f.material.value = rec.material;
}

function applyInspectorToObject() {
  if (!selected) return;
  const m = selected.mesh;
  selected.name = f.name.value || selected.name;
  m.position.set(+f.px.value, +f.py.value, +f.pz.value);
  m.rotation.set(THREE.MathUtils.degToRad(+f.rx.value), THREE.MathUtils.degToRad(+f.ry.value), THREE.MathUtils.degToRad(+f.rz.value));
  m.scale.set(+f.sx.value || 0.01, +f.sy.value || 0.01, +f.sz.value || 0.01);
  m.material.color.set(f.color.value);
  refreshHierarchy();
  updatePrintReadout();
}

Object.values(f).forEach(el => el.addEventListener('input', applyInspectorToObject));
f.material.addEventListener('change', () => {
  if (!selected) return;
  const oldColor = selected.mesh.material.color.getHex();
  selected.mesh.material.dispose();
  selected.mesh.material = MATERIALS[f.material.value](oldColor);
  selected.material = f.material.value;
  selected.mesh.material.transparent = f.material.value === 'glass';
});

document.getElementById('btn-duplicate').addEventListener('click', () => selected && duplicateObject(selected));
document.getElementById('btn-delete').addEventListener('click', () => selected && removeObject(selected));

/* ------------------------------------------------------------------ */
/* Guardar / cargar / exportar                                          */
/* ------------------------------------------------------------------ */

function serializeScene() {
  return objects.map(o => ({
    shape: o.shape,
    name: o.name,
    material: o.material,
    color: o.mesh.material.color.getHex(),
    position: o.mesh.position.toArray(),
    rotation: o.mesh.rotation.toArray().slice(0, 3).map(r => THREE.MathUtils.radToDeg(r)),
    scale: o.mesh.scale.toArray(),
  }));
}

document.getElementById('btn-save').addEventListener('click', () => {
  const data = JSON.stringify(serializeScene(), null, 2);
  const blob = new Blob([data], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'escena-forma.json';
  a.click();
  logAI('escena guardada como escena-forma.json');
});

document.getElementById('btn-load').addEventListener('click', () => document.getElementById('file-input').click());
document.getElementById('file-input').addEventListener('change', async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  const text = await file.text();
  try {
    const items = JSON.parse(text);
    clearScene();
    items.forEach(it => addShape(it));
    logAI(`escena cargada (${items.length} objetos)`);
  } catch (err) {
    logAI('no se pudo leer el archivo: formato inválido', true);
  }
  e.target.value = '';
});

document.getElementById('btn-export').addEventListener('click', () => {
  const exporter = new GLTFExporter();
  const exportGroup = new THREE.Group();
  objects.forEach(o => exportGroup.add(o.mesh.clone()));
  exporter.parse(exportGroup, (gltf) => {
    const blob = new Blob([JSON.stringify(gltf)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'escena-forma.gltf';
    a.click();
    logAI('escena exportada a GLTF');
  }, () => logAI('error al exportar', true), { binary: false });
});

/* ------------------------------------------------------------------ */
/* Historial (deshacer / rehacer)                                       */
/* ------------------------------------------------------------------ */

let history = [];
let historyIndex = -1;
let restoring = false;

function pushHistory() {
  if (restoring) return;
  history = history.slice(0, historyIndex + 1);
  history.push(serializeScene());
  historyIndex = history.length - 1;
  if (history.length > 60) { history.shift(); historyIndex--; }
}

function restoreFromHistory() {
  restoring = true;
  clearScene();
  (history[historyIndex] || []).forEach(it => addShape(it));
  restoring = false;
}

function undo() {
  if (historyIndex <= 0) return;
  historyIndex--;
  restoreFromHistory();
}
function redo() {
  if (historyIndex >= history.length - 1) return;
  historyIndex++;
  restoreFromHistory();
}
document.getElementById('btn-undo').addEventListener('click', undo);
document.getElementById('btn-redo').addEventListener('click', redo);
pushHistory();

/* ------------------------------------------------------------------ */
/* Preparación para impresión 3D                                        */
/* ------------------------------------------------------------------ */

let printScale = 10; // mm por unidad de escena (1 unidad = 1 cm por defecto)
const printSizeEl = document.getElementById('print-size');
const printScaleInput = document.getElementById('print-scale');
const printScaleLabel = document.getElementById('print-scale-label');

function sceneBoundingBox() {
  const box = new THREE.Box3();
  objects.forEach(o => box.expandByObject(o.mesh));
  return box;
}

function updatePrintReadout() {
  if (!objects.length) { printSizeEl.textContent = '—'; return; }
  const size = new THREE.Vector3();
  sceneBoundingBox().getSize(size);
  const mm = (n) => (n * printScale).toFixed(1);
  printSizeEl.textContent = `${mm(size.x)} × ${mm(size.y)} × ${mm(size.z)}`;
}

printScaleInput.addEventListener('input', () => {
  printScale = +printScaleInput.value;
  printScaleLabel.textContent = printScale;
  updatePrintReadout();
});

// Las impresoras 3D construyen capa a capa desde la base: nada puede
// quedar flotando sobre el aire sin soportes. Este botón baja cada
// objeto hasta que su punto más bajo toca el plato (Y=0).
document.getElementById('btn-ground').addEventListener('click', () => {
  if (!objects.length) { logAI('no hay nada que apoyar en la escena', true); return; }
  objects.forEach(o => {
    const box = new THREE.Box3().setFromObject(o.mesh);
    o.mesh.position.y -= box.min.y;
  });
  refreshHierarchy();
  if (selected) syncInspectorFromObject(selected);
  updatePrintReadout();
  pushHistory();
  logAI('objetos apoyados sobre el plato de impresión (Y=0)');
});

document.getElementById('btn-export-stl').addEventListener('click', () => {
  if (!objects.length) { logAI('no hay objetos en la escena para exportar', true); return; }
  const exporter = new STLExporter();
  const group = new THREE.Group();
  objects.forEach(o => group.add(o.mesh.clone()));
  // STL no lleva unidades propias; los laminadores (slicers) asumen
  // milímetros, así que escalamos la exportación según "1 unidad = N mm".
  group.scale.setScalar(printScale);
  group.updateMatrixWorld(true);
  const result = exporter.parse(group, { binary: true });
  const blob = new Blob([result], { type: 'application/sla' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'escena-forma.stl';
  a.click();
  logAI(`STL exportado (1 unidad = ${printScale} mm) — cada forma es un sólido independiente`);
});

updatePrintReadout();

/* ------------------------------------------------------------------ */
/* Consola / asistente de IA                                            */
/* ------------------------------------------------------------------ */

const aiLog = document.getElementById('ai-log');
function logAI(text, isError = false) {
  const line = document.createElement('div');
  line.className = 'ai-log-line';
  line.innerHTML = `<span class="tag">${isError ? '!' : '»'}</span>${text}`;
  aiLog.appendChild(line);
  aiLog.scrollTop = aiLog.scrollHeight;
  while (aiLog.children.length > 12) aiLog.removeChild(aiLog.firstChild);
}

document.getElementById('ai-form').addEventListener('submit', (e) => {
  e.preventDefault();
  const input = document.getElementById('ai-input');
  const text = input.value.trim();
  if (!text) return;
  logAI(text);
  input.value = '';

  const api = {
    addShape, removeObject, duplicateObject, findByName, clearScene,
    objects: () => objects, selected: () => selected, selectObject,
    randomPalette, logAI,
  };

  try {
    const result = interpret(text, api);
    if (result) logAI(result);
  } catch (err) {
    logAI('no entendí ese comando — prueba con algo como "añade un cubo azul"', true);
  }
});

toggleEmptyHint();
logAI('estudio listo. escribe un comando o elige una forma del panel.');
