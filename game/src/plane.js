// Sunset Cargo Run — plane: bush plane assembled from Three.js geometry.
// Nose points along local +Z so group.rotation.y = yaw faces the flight
// direction; rotation order YXZ, rotation.x = -pitch, rotation.z = -roll.
import * as THREE from 'three';

export function buildPlane() {
  const group = new THREE.Group();
  group.rotation.order = 'YXZ';

  const cream = new THREE.MeshLambertMaterial({ color: 0xf5e6c8, flatShading: true });
  const orange = new THREE.MeshLambertMaterial({ color: 0xe86a2a, flatShading: true });
  const dark = new THREE.MeshLambertMaterial({ color: 0x2c2f38, flatShading: true });
  const glass = new THREE.MeshPhongMaterial({ color: 0x182838, shininess: 120 });

  // Fuselage: tapered cylinder + rounded nose.
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.85, 0.5, 6.2, 10), cream);
  body.rotation.x = Math.PI / 2;
  group.add(body);
  const nose = new THREE.Mesh(new THREE.SphereGeometry(0.85, 10, 8), orange);
  nose.position.set(0, 0, 3.1);
  nose.scale.set(1, 1, 0.7);
  group.add(nose);

  // Cabin + windows.
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.5, 1.0, 2.2), cream);
  cabin.position.set(0, 0.75, 0.6);
  group.add(cabin);
  for (const side of [-1, 1]) {
    const win = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.6, 1.6), glass);
    win.position.set(side * 0.78, 0.85, 0.6);
    group.add(win);
  }
  const windshield = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.7, 0.1), glass);
  windshield.position.set(0, 0.85, 1.75);
  windshield.rotation.x = -0.3;
  group.add(windshield);

  // High wing + struts.
  const wing = new THREE.Mesh(new THREE.BoxGeometry(11, 0.22, 2.1), orange);
  wing.position.set(0, 1.35, 0.4);
  group.add(wing);
  for (const side of [-1, 1]) {
    const strut = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 2.4, 6), dark);
    strut.position.set(side * 1.6, 0.35, 0.5);
    strut.rotation.z = side * 0.5;
    group.add(strut);
  }

  // Tail: horizontal stabilizer + vertical fin.
  const stab = new THREE.Mesh(new THREE.BoxGeometry(3.6, 0.18, 1.1), orange);
  stab.position.set(0, 0.35, -2.9);
  group.add(stab);
  const fin = new THREE.Mesh(new THREE.BoxGeometry(0.18, 1.7, 1.5), orange);
  fin.position.set(0, 0.9, -2.9);
  group.add(fin);

  // Cargo pod under the belly (the point of the run).
  const pod = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.7, 2.4), dark);
  pod.position.set(0, -0.95, 0.2);
  group.add(pod);

  // Propeller: spinner + two blades, spins around local Z.
  const prop = new THREE.Group();
  prop.position.set(0, 0, 3.75);
  const spinner = new THREE.Mesh(new THREE.ConeGeometry(0.35, 0.9, 10), dark);
  spinner.rotation.x = Math.PI / 2;
  prop.add(spinner);
  const bladeMat = new THREE.MeshLambertMaterial({ color: 0x1c1c22, flatShading: true });
  for (const a of [0, Math.PI / 2]) {
    const blade = new THREE.Mesh(new THREE.BoxGeometry(0.28, 3.4, 0.12), bladeMat);
    blade.rotation.z = a;
    prop.add(blade);
  }
  group.add(prop);

  // Landing gear: three legs + wheels, shown only when gear is down.
  const gear = new THREE.Group();
  const legMat = new THREE.MeshLambertMaterial({ color: 0x444444 });
  const wheelMat = new THREE.MeshLambertMaterial({ color: 0x111111 });
  const wheelGeo = new THREE.CylinderGeometry(0.45, 0.45, 0.3, 12);
  wheelGeo.rotateZ(Math.PI / 2);
  for (const side of [-1, 1]) {
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 1.4, 6), legMat);
    leg.position.set(side * 0.9, -1.0, 1.2);
    leg.rotation.z = side * 0.35;
    gear.add(leg);
    const wheel = new THREE.Mesh(wheelGeo, wheelMat);
    wheel.position.set(side * 1.15, -1.65, 1.2);
    gear.add(wheel);
  }
  const tailLeg = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 1.0, 6), legMat);
  tailLeg.position.set(0, -0.8, -2.7);
  gear.add(tailLeg);
  const tailWheel = new THREE.Mesh(wheelGeo, wheelMat);
  tailWheel.scale.setScalar(0.55);
  tailWheel.position.set(0, -1.25, -2.7);
  gear.add(tailWheel);
  group.add(gear);

  // Nav lights: red left, green right, white tail.
  const nav = [
    [0xff2222, -5.5, 1.35, 0.4],
    [0x22ff66, 5.5, 1.35, 0.4],
    [0xffffff, 0, 0.4, -3.5],
  ];
  for (const [color, x, y, z] of nav) {
    const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.14, 8, 6), new THREE.MeshBasicMaterial({ color }));
    lamp.position.set(x, y, z);
    group.add(lamp);
  }

  function update(dt, state) {
    group.position.set(state.pos.x, state.pos.y, state.pos.z);
    group.rotation.set(-state.pitch, state.yaw, -state.roll);
    prop.rotation.z -= dt * (3 + state.throttle * 42 + state.speed * 0.6);
    gear.visible = state.gearDown;
  }

  return { group, update };
}
