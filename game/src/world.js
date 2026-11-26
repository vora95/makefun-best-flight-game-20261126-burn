// The sunset archipelago: sky dome, low sun, sea with waves, four low-poly
// islands with runways, palms and drifting clouds. All placement is seeded.

import * as THREE from 'three';
import { SEED, mulberry32, ISLANDS, headingVec, clamp } from './config.js';

export function buildWorld(scene) {
  const rng = mulberry32(SEED);

  scene.fog = new THREE.Fog(0x8a4a6b, 900, 4200);

  // --- lights: warm low sun + purple ambient fill ---
  const sunLight = new THREE.DirectionalLight(0xffb36b, 2.4);
  sunLight.position.set(-2600, 320, -900);
  scene.add(sunLight);
  scene.add(new THREE.HemisphereLight(0x9a6ab8, 0x2a4a5a, 1.25));
  const fill = new THREE.DirectionalLight(0x9a6bff, 0.35);
  fill.position.set(1200, 800, 1500);
  scene.add(fill);

  // --- sky dome: vertex-coloured gradient, orange low to purple high ---
  const skyGeo = new THREE.SphereGeometry(4200, 24, 14);
  const pos = skyGeo.attributes.position;
  const colors = new Float32Array(pos.count * 3);
  const cTop = new THREE.Color(0x2e1250);
  const cMid = new THREE.Color(0xc65a7a);
  const cLow = new THREE.Color(0xff9a3d);
  const tmp = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    const y = pos.getY(i) / 4200; // -1..1
    if (y > 0.25) tmp.copy(cMid).lerp(cTop, clamp((y - 0.25) / 0.75, 0, 1));
    else tmp.copy(cLow).lerp(cMid, clamp((y + 0.08) / 0.33, 0, 1));
    colors[i * 3] = tmp.r;
    colors[i * 3 + 1] = tmp.g;
    colors[i * 3 + 2] = tmp.b;
  }
  skyGeo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  const sky = new THREE.Mesh(skyGeo, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide, fog: false }));
  scene.add(sky);

  // --- the low sun: glowing disc + halo sprite (canvas texture, generated locally) ---
  const sunGroup = new THREE.Group();
  const sunDisc = new THREE.Mesh(
    new THREE.CircleGeometry(150, 32),
    new THREE.MeshBasicMaterial({ color: 0xffe9a8, fog: false }),
  );
  sunGroup.add(sunDisc);
  const haloCanvas = document.createElement('canvas');
  haloCanvas.width = haloCanvas.height = 256;
  const hctx = haloCanvas.getContext('2d');
  const grad = hctx.createRadialGradient(128, 128, 8, 128, 128, 128);
  grad.addColorStop(0, 'rgba(255, 190, 90, 0.85)');
  grad.addColorStop(0.45, 'rgba(255, 120, 60, 0.35)');
  grad.addColorStop(1, 'rgba(255, 120, 60, 0)');
  hctx.fillStyle = grad;
  hctx.fillRect(0, 0, 256, 256);
  const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(haloCanvas), fog: false, depthWrite: false }));
  halo.scale.set(1100, 1100, 1);
  sunGroup.add(halo);
  sunGroup.position.set(-3300, 330, -1100);
  sunGroup.lookAt(0, 120, 0);
  scene.add(sunGroup);

  // --- sea: big low-poly plane, vertices wave in update() ---
  const seaGeo = new THREE.PlaneGeometry(7000, 7000, 48, 48);
  seaGeo.rotateX(-Math.PI / 2);
  const seaBase = seaGeo.attributes.position.array.slice();
  const sea = new THREE.Mesh(
    seaGeo,
    new THREE.MeshLambertMaterial({ color: 0x2a6a8a, flatShading: true }),
  );
  sea.position.y = 0.1;
  scene.add(sea);
  // A second, darker deep-water disc far out keeps the horizon from going flat.
  const deep = new THREE.Mesh(
    new THREE.CircleGeometry(6800, 40),
    new THREE.MeshBasicMaterial({ color: 0x14324a, fog: false }),
  );
  deep.rotation.x = -Math.PI / 2;
  deep.position.y = -0.6;
  scene.add(deep);

  // --- islands ---
  const islands = [];
  for (const isl of ISLANDS) {
    const g = new THREE.Group();
    g.position.set(isl.x, 0, isl.z);

    // Rock base: squat low-poly cone, sand rim, green top.
    const rock = new THREE.Mesh(
      new THREE.CylinderGeometry(isl.r * 0.62, isl.r * 1.02, isl.h, 9, 1),
      new THREE.MeshLambertMaterial({ color: 0x8a6a4a, flatShading: true }),
    );
    rock.position.y = isl.h / 2 - 0.5;
    g.add(rock);
    const sand = new THREE.Mesh(
      new THREE.CylinderGeometry(isl.r * 0.66, isl.r * 0.8, 1.6, 9),
      new THREE.MeshLambertMaterial({ color: 0xd9b380, flatShading: true }),
    );
    sand.position.y = isl.h - 0.4;
    g.add(sand);
    const top = new THREE.Mesh(
      new THREE.CylinderGeometry(isl.r * 0.62, isl.r * 0.66, 1.2, 9),
      new THREE.MeshLambertMaterial({ color: isl.color, flatShading: true }),
    );
    top.position.y = isl.h + 0.2;
    g.add(top);

    // Runway: dark strip + white dashes + threshold bars, flat on the plateau.
    const f = headingVec(isl.runwayHeading);
    const runway = new THREE.Group();
    runway.rotation.y = -Math.atan2(f.x, -f.z);
    const strip = new THREE.Mesh(
      new THREE.BoxGeometry(isl.runwayWid, 0.5, isl.runwayLen),
      new THREE.MeshLambertMaterial({ color: 0x2e2a33 }),
    );
    strip.position.y = isl.h + 0.6;
    runway.add(strip);
    const dashMat = new THREE.MeshBasicMaterial({ color: 0xfff2c8 });
    for (let d = -isl.runwayLen / 2 + 18; d < isl.runwayLen / 2 - 10; d += 26) {
      const dash = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.2, 12), dashMat);
      dash.position.set(0, isl.h + 0.95, d);
      runway.add(dash);
    }
    for (const s of [-1, 1]) {
      const bar = new THREE.Mesh(new THREE.BoxGeometry(isl.runwayWid - 4, 0.2, 4), dashMat);
      bar.position.set(0, isl.h + 0.95, s * (isl.runwayLen / 2 - 8));
      runway.add(bar);
    }
    // Edge lights: tiny warm dots so the strip reads at dusk.
    const lightMat = new THREE.MeshBasicMaterial({ color: 0xffc46b });
    for (let d = -isl.runwayLen / 2 + 6; d <= isl.runwayLen / 2 - 6; d += 30) {
      for (const s of [-1, 1]) {
        const dot = new THREE.Mesh(new THREE.SphereGeometry(0.9, 6, 6), lightMat);
        dot.position.set(s * (isl.runwayWid / 2 + 1.5), isl.h + 1.2, d);
        runway.add(dot);
      }
    }
    g.add(runway);

    // Windsock near the threshold.
    const sock = new THREE.Group();
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.25, 9, 6), new THREE.MeshLambertMaterial({ color: 0xcccccc }));
    pole.position.y = 4.5;
    sock.add(pole);
    const cone = new THREE.Mesh(
      new THREE.ConeGeometry(1.1, 4.5, 8),
      new THREE.MeshLambertMaterial({ color: 0xff6b35 }),
    );
    cone.rotation.z = Math.PI / 2 - 0.35;
    cone.position.set(2.4, 8.6, 0);
    sock.add(cone);
    sock.position.set(-f.x * (isl.runwayLen / 2 - 10) + -f.z * (isl.runwayWid / 2 + 12), isl.h + 0.8, -f.z * (isl.runwayLen / 2 - 10) + f.x * (isl.runwayWid / 2 + 12));
    g.add(sock);

    // Palms: seeded spots, kept clear of the runway strip.
    const trunkMat = new THREE.MeshLambertMaterial({ color: 0x7a5230, flatShading: true });
    const leafMat = new THREE.MeshLambertMaterial({ color: 0x2e7a3a, flatShading: true });
    let placed = 0;
    let guard = 0;
    while (placed < isl.palms && guard < isl.palms * 12) {
      guard++;
      const a = rng() * Math.PI * 2;
      const rr = isl.r * (0.3 + rng() * 0.55);
      const px = Math.cos(a) * rr;
      const pz = Math.sin(a) * rr;
      const along = px * f.x + pz * f.z;
      const across = px * -f.z + pz * f.x;
      if (Math.abs(along) < isl.runwayLen / 2 + 14 && Math.abs(across) < isl.runwayWid / 2 + 12) continue;
      const palm = new THREE.Group();
      const lean = (rng() - 0.5) * 0.22;
      const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.55, 9, 5), trunkMat);
      trunk.position.y = 4.5;
      trunk.rotation.z = lean;
      palm.add(trunk);
      for (let k = 0; k < 5; k++) {
        const frond = new THREE.Mesh(new THREE.ConeGeometry(1.5, 6.5, 4), leafMat);
        const fa = (k / 5) * Math.PI * 2;
        frond.position.set(Math.cos(fa) * 2.2, 9.6, Math.sin(fa) * 2.2);
        frond.rotation.z = Math.cos(fa) * 1.1;
        frond.rotation.x = -Math.sin(fa) * 1.1;
        palm.add(frond);
      }
      const nut = new THREE.Mesh(new THREE.SphereGeometry(0.8, 6, 6), new THREE.MeshLambertMaterial({ color: 0x6b4a2a }));
      nut.position.y = 8.6;
      palm.add(nut);
      palm.position.set(px, isl.h + 0.4, pz);
      palm.rotation.y = rng() * Math.PI * 2;
      const s = 0.8 + rng() * 0.6;
      palm.scale.set(s, s, s);
      g.add(palm);
      placed++;
    }

    // A couple of low hills for silhouette.
    for (let k = 0; k < 2; k++) {
      const hill = new THREE.Mesh(
        new THREE.ConeGeometry(isl.r * 0.22, isl.h * 0.9 + 4, 7),
        new THREE.MeshLambertMaterial({ color: isl.color, flatShading: true }),
      );
      const ha = rng() * Math.PI * 2;
      hill.position.set(Math.cos(ha) * isl.r * 0.35, isl.h + 2, Math.sin(ha) * isl.r * 0.35);
      g.add(hill);
    }

    scene.add(g);
    islands.push(g);
  }

  // --- clouds: flattened puffs, pink-lit, drifting slowly ---
  const clouds = [];
  const cloudMat = new THREE.MeshLambertMaterial({ color: 0xffc9a8, flatShading: true, transparent: true, opacity: 0.92 });
  const cloudMat2 = new THREE.MeshLambertMaterial({ color: 0xe8a8c8, flatShading: true, transparent: true, opacity: 0.85 });
  for (let i = 0; i < 16; i++) {
    const c = new THREE.Group();
    const puffs = 3 + Math.floor(rng() * 3);
    for (let k = 0; k < puffs; k++) {
      const p = new THREE.Mesh(new THREE.SphereGeometry(14 + rng() * 22, 7, 6), k % 2 ? cloudMat2 : cloudMat);
      p.position.set((rng() - 0.5) * 70, (rng() - 0.5) * 8, (rng() - 0.5) * 26);
      p.scale.y = 0.45;
      c.add(p);
    }
    const a = rng() * Math.PI * 2;
    const rr = 500 + rng() * 2600;
    c.position.set(Math.cos(a) * rr, 190 + rng() * 160, Math.sin(a) * rr);
    c.userData.drift = 1.5 + rng() * 2.5;
    scene.add(c);
    clouds.push(c);
  }

  let waveTime = 0;
  return {
    update(t, dt) {
      waveTime = t;
      const p = seaGeo.attributes.position;
      for (let i = 0; i < p.count; i++) {
        const bx = seaBase[i * 3];
        const bz = seaBase[i * 3 + 2];
        p.array[i * 3 + 1] = Math.sin(bx * 0.012 + waveTime * 0.9) * 0.35 + Math.cos(bz * 0.014 + waveTime * 0.7) * 0.35;
      }
      p.needsUpdate = true;
      // No computeVertexNormals: the sea material is flatShading, which shades
      // from screen-space derivatives, so recomputing normals every frame was
      // pure CPU cost (it was the slowest part of the frame in software GL).
      for (const c of clouds) {
        c.position.x += c.userData.drift * dt;
        if (c.position.x > 3200) c.position.x = -3200;
      }
    },
  };
}
