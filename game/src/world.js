// Sunset Cargo Run — world: sea, islands, sky, sun, clouds, airstrips.
// Terrain height is analytic (same function builds the meshes and drives the
// physics), so the ground you see is the ground you land on.
import * as THREE from 'three';
import { CONFIG, ISLANDS } from './config.js';

export function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function smoothstep(a, b, x) {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
}

export function islandHeightAt(isl, x, z) {
  const d = Math.hypot(x - isl.x, z - isl.z);
  return isl.H * (1 - smoothstep(isl.R * 0.3, isl.R, d));
}

export function heightAt(x, z) {
  let h = 0;
  for (const isl of ISLANDS) h = Math.max(h, islandHeightAt(isl, x, z));
  return h;
}

// Strip hit test. Returns {island, along, across} or null.
// along: distance along the strip from its centre; across: offset from centreline.
export function stripAt(x, z) {
  for (let i = 0; i < ISLANDS.length; i++) {
    const isl = ISLANDS[i];
    const hd = (isl.heading * Math.PI) / 180;
    const dx = x - isl.x;
    const dz = z - isl.z;
    const along = dx * Math.sin(hd) + dz * Math.cos(hd);
    const across = dx * Math.cos(hd) - dz * Math.sin(hd);
    if (Math.abs(along) < isl.stripLen / 2 && Math.abs(across) < isl.stripWid / 2) {
      return { island: i, along, across };
    }
  }
  return null;
}

export function stripCenter(i) {
  const isl = ISLANDS[i];
  return { x: isl.x, y: isl.H, z: isl.z, heading: isl.heading };
}

function skyTexture() {
  const c = document.createElement('canvas');
  c.width = 4;
  c.height = 256;
  const g = c.getContext('2d');
  const grad = g.createLinearGradient(0, 0, 0, 256);
  grad.addColorStop(0.0, '#1c1445'); // deep violet zenith
  grad.addColorStop(0.45, '#5b2a6e'); // purple
  grad.addColorStop(0.72, '#c94f5e'); // rose
  grad.addColorStop(0.88, '#ff8c42'); // orange horizon
  grad.addColorStop(1.0, '#ffb35c'); // sunset glow
  g.fillStyle = grad;
  g.fillRect(0, 0, 4, 256);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function buildWorld(scene) {
  const rng = mulberry32(CONFIG.seed);

  // Sky dome (gradient) + sunset fog.
  const sky = new THREE.Mesh(
    new THREE.SphereGeometry(5200, 24, 16),
    new THREE.MeshBasicMaterial({ map: skyTexture(), side: THREE.BackSide, fog: false })
  );
  scene.add(sky);
  scene.fog = new THREE.Fog(0x8a4a5e, 1200, 4600);

  // Low sun over the northern sea + warm directional light.
  const sun = new THREE.Mesh(
    new THREE.SphereGeometry(150, 24, 16),
    new THREE.MeshBasicMaterial({ color: 0xffd27a, fog: false })
  );
  sun.position.set(-900, 260, -4200);
  scene.add(sun);
  const sunLight = new THREE.DirectionalLight(0xffb070, 2.6);
  sunLight.position.set(-900, 500, -3000);
  scene.add(sunLight);
  // Warm fill from the south so the plane's chase side and the terrain
  // facing the camera are never pitch black.
  const fillLight = new THREE.DirectionalLight(0xff9a6a, 0.7);
  fillLight.position.set(600, 400, 2500);
  scene.add(fillLight);
  scene.add(new THREE.HemisphereLight(0x8a5aa8, 0x2a1a3a, 1.4));
  scene.add(new THREE.AmbientLight(0x604060, 0.8));

  // Sea: large plane with gentle travelling waves (vertex animation).
  const seaGeo = new THREE.PlaneGeometry(7000, 7000, 48, 48);
  seaGeo.rotateX(-Math.PI / 2);
  const seaBase = seaGeo.attributes.position.array.slice();
  const sea = new THREE.Mesh(
    seaGeo,
    new THREE.MeshPhongMaterial({ color: 0x274b7a, shininess: 90, specular: 0xff9a5a, flatShading: true })
  );
  sea.position.y = 0;
  scene.add(sea);

  // Islands: displaced grids, vertex colours sand -> grass -> rock.
  const sand = new THREE.Color(0xd9b380);
  const grass = new THREE.Color(0x4e8f4a);
  const grass2 = new THREE.Color(0x6aa84f);
  const rock = new THREE.Color(0x8a7a66);
  for (const isl of ISLANDS) {
    const geo = new THREE.PlaneGeometry(isl.R * 2.4, isl.R * 2.4, 22, 22);
    geo.rotateX(-Math.PI / 2);
    const pos = geo.attributes.position;
    const colors = new Float32Array(pos.count * 3);
    const tmp = new THREE.Color();
    for (let i = 0; i < pos.count; i++) {
      const wx = pos.getX(i) + isl.x;
      const wz = pos.getZ(i) + isl.z;
      const h = heightAt(wx, wz);
      pos.setY(i, h);
      const t = h / isl.H;
      if (h < 2.5) tmp.copy(sand);
      else if (t < 0.55) tmp.copy(grass).lerp(grass2, rng() * 0.6);
      else tmp.copy(grass2).lerp(rock, (t - 0.55) / 0.45);
      colors[i * 3] = tmp.r;
      colors[i * 3 + 1] = tmp.g;
      colors[i * 3 + 2] = tmp.b;
    }
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geo.computeVertexNormals();
    const mesh = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true }));
    mesh.position.set(isl.x, 0, isl.z);
    scene.add(mesh);

    // Airstrip: dark asphalt slab + centreline dashes + edge lights + windsock.
    const strip = new THREE.Group();
    const slab = new THREE.Mesh(
      new THREE.BoxGeometry(isl.stripWid, 0.6, isl.stripLen),
      new THREE.MeshLambertMaterial({ color: 0x33363e })
    );
    slab.position.y = 0.3;
    strip.add(slab);
    const dashMat = new THREE.MeshBasicMaterial({ color: 0xfff2cc });
    for (let d = -isl.stripLen / 2 + 25; d < isl.stripLen / 2 - 10; d += 40) {
      const dash = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.2, 18), dashMat);
      dash.position.set(0, 0.7, d);
      strip.add(dash);
    }
    const lightMat = new THREE.MeshBasicMaterial({ color: 0xffb347 });
    for (let d = -isl.stripLen / 2 + 10; d <= isl.stripLen / 2 - 10; d += 40) {
      for (const side of [-1, 1]) {
        const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.9, 8, 6), lightMat);
        lamp.position.set((side * isl.stripWid) / 2, 1.0, d);
        strip.add(lamp);
      }
    }
    // Windsock: pole + orange cone.
    const pole = new THREE.Mesh(
      new THREE.CylinderGeometry(0.25, 0.25, 9, 6),
      new THREE.MeshLambertMaterial({ color: 0xdddddd })
    );
    pole.position.set(isl.stripWid / 2 + 8, 4.5, isl.stripLen / 2 - 20);
    strip.add(pole);
    const sock = new THREE.Mesh(
      new THREE.ConeGeometry(1.4, 5, 8),
      new THREE.MeshLambertMaterial({ color: 0xff6a2a })
    );
    sock.rotation.z = Math.PI / 2;
    sock.position.set(isl.stripWid / 2 + 8, 8.6, isl.stripLen / 2 - 20);
    strip.add(sock);

    strip.position.set(isl.x, isl.H + 0.1, isl.z);
    strip.rotation.y = (isl.heading * Math.PI) / 180;
    scene.add(strip);
  }

  // Clouds: pink-lit low-poly puffs drifting with the wind.
  const clouds = [];
  const cloudMat = new THREE.MeshLambertMaterial({ color: 0xffd9c2, flatShading: true, transparent: true, opacity: 0.92 });
  const cloudMat2 = new THREE.MeshLambertMaterial({ color: 0xc9a0d8, flatShading: true, transparent: true, opacity: 0.9 });
  for (let i = 0; i < 16; i++) {
    const group = new THREE.Group();
    const puffs = 3 + Math.floor(rng() * 3);
    for (let p = 0; p < puffs; p++) {
      const r = 14 + rng() * 22;
      const m = new THREE.Mesh(new THREE.IcosahedronGeometry(r, 0), rng() > 0.5 ? cloudMat : cloudMat2);
      m.position.set((rng() - 0.5) * 70, (rng() - 0.5) * 8, (rng() - 0.5) * 30);
      m.scale.y = 0.45;
      group.add(m);
    }
    group.position.set((rng() - 0.5) * 5200, 190 + rng() * 160, (rng() - 0.5) * 5200);
    scene.add(group);
    clouds.push(group);
  }

  let waveTime = 0;
  function update(dt) {
    waveTime += dt;
    const p = seaGeo.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const bx = seaBase[i * 3];
      const bz = seaBase[i * 3 + 2];
      p.setY(i, Math.sin(bx * 0.012 + waveTime * 0.9) * 0.7 + Math.cos(bz * 0.009 + waveTime * 0.7) * 0.7);
    }
    p.needsUpdate = true;
    seaGeo.computeVertexNormals();
    for (const c of clouds) {
      c.position.x += dt * 2.2;
      if (c.position.x > 2800) c.position.x = -2800;
    }
  }

  return { update, sun };
}
