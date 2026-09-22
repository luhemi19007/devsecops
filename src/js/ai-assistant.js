/**
 * Asistente de diseño — intérprete de comandos en lenguaje natural.
 *
 * No depende de ningún servicio externo: analiza la frase con un
 * conjunto de reglas e intenciones (añadir, mover, rotar, escalar,
 * colorear, eliminar, duplicar, limpiar) y, para frases más abiertas,
 * compone "prefabs" — pequeñas escenas hechas de varias primitivas —
 * a partir de una sola palabra clave ("casa", "árbol", "muñeco de nieve"...).
 *
 * Si en el futuro quieres conectar un modelo de lenguaje real (por
 * ejemplo la API de Anthropic) para interpretar frases más complejas,
 * este archivo es el único que necesitas sustituir: `interpret()` es
 * el único punto de entrada que usa app.js.
 */

const COLOR_WORDS = {
  rojo: 0xe2604f, roja: 0xe2604f, red: 0xe2604f,
  azul: 0x4a7fd9, blue: 0x4a7fd9,
  verde: 0x5fbf6d, green: 0x5fbf6d,
  amarillo: 0xd9c24a, amarilla: 0xd9c24a, yellow: 0xd9c24a,
  naranja: 0xff8a3d, orange: 0xff8a3d,
  morado: 0x9b6fd9, violeta: 0x9b6fd9, purple: 0x9b6fd9,
  rosa: 0xe08ac0, pink: 0xe08ac0,
  blanco: 0xe9edee, blanca: 0xe9edee, white: 0xe9edee,
  negro: 0x24282b, negra: 0x24282b, black: 0x24282b,
  gris: 0x8fa3ad, grey: 0x8fa3ad, gray: 0x8fa3ad,
  cian: 0x5fd4c4, turquesa: 0x5fd4c4, cyan: 0x5fd4c4,
  marron: 0x8a5a3c, marrón: 0x8a5a3c, brown: 0x8a5a3c,
  dorado: 0xd9b24a, gold: 0xd9b24a,
  plateado: 0xc4cbce, silver: 0xc4cbce,
};

const SHAPE_WORDS = {
  cubo: 'box', caja: 'box', box: 'box', cube: 'box',
  esfera: 'sphere', bola: 'sphere', sphere: 'sphere', ball: 'sphere',
  cilindro: 'cylinder', cylinder: 'cylinder',
  cono: 'cone', cone: 'cone',
  toroide: 'torus', rosquilla: 'torus', dona: 'torus', torus: 'torus',
  plano: 'plane', suelo: 'plane', plane: 'plane',
};

const MATERIAL_WORDS = {
  metalico: 'metal', metálico: 'metal', metal: 'metal',
  cristal: 'glass', vidrio: 'glass', glass: 'glass',
  mate: 'matte', matte: 'matte',
};

function findColor(text) {
  for (const [word, hex] of Object.entries(COLOR_WORDS)) {
    if (text.includes(word)) return hex;
  }
  return null;
}
function findShape(text) {
  for (const [word, shape] of Object.entries(SHAPE_WORDS)) {
    if (text.includes(word)) return shape;
  }
  return null;
}
function findMaterial(text) {
  for (const [word, mat] of Object.entries(MATERIAL_WORDS)) {
    if (text.includes(word)) return mat;
  }
  return null;
}
function findNumbers(text) {
  const m = text.match(/-?\d+(\.\d+)?/g);
  return m ? m.map(Number) : [];
}

// Coincidencia por palabra completa (evita falsos positivos como "casa"
// dentro de "casaca", y es insensible a los signos ¿¡"'. de alrededor).
function hasWord(text, word) {
  const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`(?:^|[^a-zñáéíóúü])${escaped}(?:[^a-zñáéíóúü]|$)`, 'i').test(text);
}

/* -------------------------------------------------------------- */
/* Prefabs: composiciones de varias primitivas por palabra clave   */
/* -------------------------------------------------------------- */

const PREFABS = {
  casa: buildHouse, house: buildHouse,
  arbol: buildTree, 'árbol': buildTree, tree: buildTree,
  muñeco: buildSnowman, 'muñeco de nieve': buildSnowman, snowman: buildSnowman,
  mesa: buildTable, table: buildTable,
  robot: buildRobot,
  cohete: buildRocket, rocket: buildRocket,
  torre: buildTower, tower: buildTower,
};

function buildHouse(api, origin, color) {
  const base = color ?? 0xd9c26a;
  api.addShape({ shape: 'box', color: base, position: [origin[0], origin[1] + 0.75, origin[2]], scale: [2, 1.5, 2], name: 'Base de casa' });
  api.addShape({ shape: 'cone', color: 0xe2604f, position: [origin[0], origin[1] + 1.9, origin[2]], scale: [1.7, 1.2, 1.7], rotation: [0, 45, 0], name: 'Tejado' });
  api.addShape({ shape: 'box', color: 0x8a5a3c, position: [origin[0], origin[1] + 0.5, origin[2] + 1.01], scale: [0.45, 1, 0.08], name: 'Puerta' });
  return 'construida una casa con base, tejado y puerta';
}

function buildTree(api, origin, color) {
  api.addShape({ shape: 'cylinder', color: 0x8a5a3c, position: [origin[0], origin[1] + 0.6, origin[2]], scale: [0.35, 1.2, 0.35], name: 'Tronco' });
  api.addShape({ shape: 'cone', color: color ?? 0x5fbf6d, position: [origin[0], origin[1] + 1.7, origin[2]], scale: [1.4, 1.6, 1.4], name: 'Copa' });
  return 'construido un árbol con tronco y copa';
}

function buildSnowman(api, origin) {
  api.addShape({ shape: 'sphere', color: 0xe9edee, position: [origin[0], origin[1] + 0.5, origin[2]], scale: [1.3, 1.3, 1.3], name: 'Bola base' });
  api.addShape({ shape: 'sphere', color: 0xe9edee, position: [origin[0], origin[1] + 1.4, origin[2]], scale: [0.9, 0.9, 0.9], name: 'Bola media' });
  api.addShape({ shape: 'sphere', color: 0xe9edee, position: [origin[0], origin[1] + 2.05, origin[2]], scale: [0.6, 0.6, 0.6], name: 'Cabeza' });
  api.addShape({ shape: 'cone', color: 0xff8a3d, position: [origin[0], origin[1] + 2.05, origin[2] + 0.5], scale: [0.15, 0.5, 0.15], rotation: [90, 0, 0], name: 'Nariz' });
  return 'construido un muñeco de nieve de tres bolas';
}

function buildTable(api, origin, color) {
  const c = color ?? 0x8a5a3c;
  api.addShape({ shape: 'box', color: c, position: [origin[0], origin[1] + 1, origin[2]], scale: [2, 0.1, 1.2], name: 'Tablero' });
  const legOffsets = [[-0.9, -0.5], [0.9, -0.5], [-0.9, 0.5], [0.9, 0.5]];
  legOffsets.forEach(([dx, dz], i) => {
    api.addShape({ shape: 'cylinder', color: c, position: [origin[0] + dx, origin[1] + 0.5, origin[2] + dz], scale: [0.12, 1, 0.12], name: `Pata ${i + 1}` });
  });
  return 'construida una mesa con tablero y cuatro patas';
}

function buildRobot(api, origin, color) {
  const c = color ?? 0x8fa3ad;
  api.addShape({ shape: 'box', color: c, position: [origin[0], origin[1] + 1, origin[2]], scale: [0.9, 1.1, 0.6], material: 'metal', name: 'Torso' });
  api.addShape({ shape: 'sphere', color: c, position: [origin[0], origin[1] + 1.9, origin[2]], scale: [0.5, 0.5, 0.5], material: 'metal', name: 'Cabeza' });
  api.addShape({ shape: 'cylinder', color: 0x5fd4c4, position: [origin[0] - 0.65, origin[1] + 1, origin[2]], scale: [0.15, 1, 0.15], material: 'metal', name: 'Brazo izq' });
  api.addShape({ shape: 'cylinder', color: 0x5fd4c4, position: [origin[0] + 0.65, origin[1] + 1, origin[2]], scale: [0.15, 1, 0.15], material: 'metal', name: 'Brazo der' });
  api.addShape({ shape: 'cylinder', color: 0x24282b, position: [origin[0] - 0.3, origin[1] + 0.2, origin[2]], scale: [0.2, 0.4, 0.2], material: 'metal', name: 'Pierna izq' });
  api.addShape({ shape: 'cylinder', color: 0x24282b, position: [origin[0] + 0.3, origin[1] + 0.2, origin[2]], scale: [0.2, 0.4, 0.2], material: 'metal', name: 'Pierna der' });
  return 'construido un robot con torso, cabeza, brazos y piernas';
}

function buildRocket(api, origin, color) {
  api.addShape({ shape: 'cylinder', color: color ?? 0xe9edee, position: [origin[0], origin[1] + 1, origin[2]], scale: [0.4, 1.6, 0.4], material: 'metal', name: 'Cuerpo' });
  api.addShape({ shape: 'cone', color: 0xe2604f, position: [origin[0], origin[1] + 2.2, origin[2]], scale: [0.4, 0.7, 0.4], name: 'Punta' });
  [[-0.4, 0], [0.4, 0], [0, -0.4], [0, 0.4]].forEach(([dx, dz], i) => {
    api.addShape({ shape: 'cone', color: 0xff8a3d, position: [origin[0] + dx, origin[1] + 0.25, origin[2] + dz], scale: [0.15, 0.4, 0.15], rotation: [180, 0, 0], name: `Aleta ${i + 1}` });
  });
  return 'construido un cohete con aletas';
}

function buildTower(api, origin, color) {
  const c = color ?? 0x8fa3ad;
  for (let i = 0; i < 5; i++) {
    api.addShape({ shape: 'box', color: c, position: [origin[0], origin[1] + 0.4 + i * 0.8, origin[2]], scale: [1 - i * 0.12, 0.8, 1 - i * 0.12], name: `Nivel ${i + 1}` });
  }
  return 'construida una torre escalonada de 5 niveles';
}

/* -------------------------------------------------------------- */
/* Intérprete principal                                            */
/* -------------------------------------------------------------- */

export function interpret(rawText, api) {
  // quita comillas y signos de apertura/cierre que el usuario pueda copiar
  // de los propios ejemplos del placeholder ("añade...", ¿...?, etc.)
  const text = rawText
    .toLowerCase()
    .trim()
    .replace(/^["'“”¿¡]+|["'“”.!?]+$/g, '')
    .trim();

  if (!text) return null;

  // limpiar / reiniciar escena
  if (/^(limpia|borra todo|clear|vac[ií]a)/.test(text)) {
    api.clearScene();
    return 'lienzo limpiado';
  }

  // prefabs: "construye/haz/crea una casa", o directamente "casa"
  for (const [word, fn] of Object.entries(PREFABS)) {
    if (hasWord(text, word)) {
      const color = findColor(text);
      const nums = findNumbers(text);
      const origin = nums.length >= 3 ? [nums[0], nums[1], nums[2]] : [0, 0, 0];
      return fn(api, origin, color);
    }
  }

  // eliminar
  if (/^(elimina|borra|quita|delete)/.test(text)) {
    const target = resolveTarget(text, api, /^(elimina|borra|quita|delete)/);
    if (target) { api.removeObject(target); return `eliminado «${target.name}»`; }
    return 'no encontré ese objeto para eliminar';
  }

  // duplicar
  if (/^(duplica|clona|copia|duplicate)/.test(text)) {
    const target = resolveTarget(text, api, /^(duplica|clona|copia|duplicate)/);
    if (target) { api.duplicateObject(target); return `duplicado «${target.name}»`; }
    return 'no encontré ese objeto para duplicar';
  }

  // mover
  if (/^(mueve|desplaza|move)/.test(text)) {
    const target = resolveTarget(text, api, /^(mueve|desplaza|move)/, / a .*/);
    const nums = findNumbers(text);
    if (target && nums.length >= 3) {
      target.mesh.position.set(nums[0], nums[1], nums[2]);
      return `movido «${target.name}» a (${nums[0]}, ${nums[1]}, ${nums[2]})`;
    }
    return 'para mover indica el objeto y tres coordenadas, ej: "mueve el cubo a 2 0 0"';
  }

  // rotar
  if (/^(rota|gira|rotate)/.test(text)) {
    const target = resolveTarget(text, api, /^(rota|gira|rotate)/);
    const nums = findNumbers(text);
    if (target && nums.length >= 1) {
      const deg = nums[0];
      target.mesh.rotation.y += (deg * Math.PI) / 180;
      return `rotado «${target.name}» ${deg}°`;
    }
    return 'para rotar indica el objeto y un ángulo, ej: "rota el cubo 45"';
  }

  // escalar
  if (/^(escala|agranda|encoge|agrand|scale)/.test(text)) {
    const target = resolveTarget(text, api, /^(escala|agranda|encoge|scale)/);
    const nums = findNumbers(text);
    let factor = nums.length ? nums[0] : (/agrand/.test(text) ? 1.3 : /encoge/.test(text) ? 0.75 : 1);
    if (factor > 4) factor = factor / 100; // p.ej. "escala 150" -> 1.5
    if (target) {
      target.mesh.scale.multiplyScalar(factor);
      return `escalado «${target.name}» x${factor.toFixed(2)}`;
    }
    return 'no encontré ese objeto para escalar';
  }

  // color
  if (/color|pinta|colorea/.test(text)) {
    const target = resolveTarget(text, api, /(cambia el color de|pinta de|pinta|colorea|color)/);
    const color = findColor(text);
    if (target && color !== null) {
      target.mesh.material.color.set(color);
      return `«${target.name}» ahora es de otro color`;
    }
    if (color !== null && api.selected()) {
      api.selected().mesh.material.color.set(color);
      return `color aplicado a «${api.selected().name}»`;
    }
    return 'indica un objeto y un color, ej: "pinta el cubo de azul"';
  }

  // añadir forma simple
  if (/^(añade|agrega|crea|pon|add|create)/.test(text) || findShape(text)) {
    const shape = findShape(text);
    if (shape) {
      const color = findColor(text);
      const material = findMaterial(text);
      const nums = findNumbers(text);
      const position = nums.length >= 3 ? [nums[0], nums[1], nums[2]] : undefined;
      const rec = api.addShape({
        shape,
        color: color ?? api.randomPalette(),
        material: material ?? 'standard',
        ...(position ? { position } : {}),
      });
      return `añadida ${rec.name.toLowerCase()}${color !== null ? '' : ''}`;
    }
  }

  // selección por nombre
  if (/^(selecciona|elige|select)/.test(text)) {
    const target = resolveTarget(text, api, /^(selecciona|elige|select)/);
    if (target) { api.selectObject(target); return `seleccionado «${target.name}»`; }
    return 'no encontré ese objeto';
  }

  return 'no reconocí ese comando. prueba "añade un cubo rojo", "construye una casa", "mueve la esfera a 1 1 1" o "pinta el cubo de azul"';
}

function resolveTarget(text, api, ...stripPatterns) {
  let t = text;
  stripPatterns.forEach(p => { t = t.replace(p, ''); });
  t = t.replace(/-?\d+(\.\d+)?/g, '').trim();
  const found = api.findByName(t) || api.selected();
  return found || null;
}
