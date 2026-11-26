// The bush plane: low-poly, built only from Three.js geometry — fuselage,
// high wing, tail, spinning propeller and retractable landing gear.

import * as THREE from 'three';

export function buildPlane() {
  const group = new THREE.Group();
  const yellow = new THREE.MeshLambertMaterial({ color: 0xffb020, flatShading: true });
  const orange = new THREE.MeshLambertMaterial({ color: 0xe85d1f, flatShading: true });
  const cream = new THREE.MeshLambertMaterial({ color: 0xfff1cf, flatShading: true });
  const dark = new THREE.MeshLambertMaterial({ color: 0x2e2a33, flatShading: true });
  const glass = new THREE.MeshLambertMaterial({ color: 0x9fd8e8, flatShading: true });
  const metal = new THREE.MeshLambertMaterial({ color: 0x8a8f96, flatShading: true });

  // Fuselage: nose toward local -Z.
  const body = new THREE.Mesh(new THREE.CylinderGeometry(1.05, 0.62, 6.4, 8), yellow);
  body.rotation.x = Math.PI / 2;
  body.position.set(0, 0, 0.4);
  group.add(body);
  const nose = new THREE.Mesh(new THREE.CylinderGeometry(0.62, 1.05, 1.4, 8), orange);
  nose.rotation.x = Math.PI / 2;
  nose.position.set(0, 0, -3.4);
  group.add(nose);
  // Cabin + windshield.
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.7, 1.15, 2.2), cream);
  cabin.position.set(0, 0.75, -0.4);
  group.add(cabin);
  const shield = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.85, 0.25), glass);
  shield.position.set(0, 0.85, -1.55);
  shield.rotation.x = -0.35;
  group.add(shield);
  // Cargo pod under the belly (the point of the run).
  const pod = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.8, 2.6), orange);
  pod.position.set(0, -1.05, 0.3);
  group.add(pod);

  // High wing + struts.
  const wing = new THREE.Mesh(new THREE.BoxGeometry(11.5, 0.28, 2.1), yellow);
  wing.position.set(0, 1.35, -0.3);
  group.add(wing);
  const tipL = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.3, 2.1), orange);
  tipL.position.set(-5.9, 1.35, -0.3);
  group.add(tipL);
  const tipR = tipL.clone();
  tipR.position.x = 5.9;
  group.add(tipR);
  for (const s of [-1, 1]) {
    const strut = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 2.1, 5), metal);
    strut.position.set(s * 1.9, 0.45, -0.3);
    strut.rotation.z = s * 0.5;
    group.add(strut);
  }

  // Tail: horizontal stabiliser + vertical fin.
  const stab = new THREE.Mesh(new THREE.BoxGeometry(4.2, 0.22, 1.3), yellow);
  stab.position.set(0, 0.35, 3.4);
  group.add(stab);
  const fin = new THREE.Mesh(new THREE.BoxGeometry(0.22, 2.0, 1.5), orange);
  fin.position.set(0, 1.0, 3.5);
  group.add(fin);
  // Tail stripe + registration for character.
  const stripe = new THREE.Mesh(new THREE.BoxGeometry(2.14, 0.3, 0.9), cream);
  stripe.position.set(0, 0.1, 2.6);
  group.add(stripe);

  // Propeller at the nose: hub + two blades, spins around Z.
  const prop = new THREE.Group();
  prop.position.set(0, 0, -4.25);
  const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.32, 0.5, 8), dark);
  hub.rotation.x = Math.PI / 2;
  prop.add(hub);
  for (const a of [0, Math.PI / 2]) {
    const blade = new THREE.Mesh(new THREE.BoxGeometry(0.42, 3.4, 0.12), dark);
    blade.rotation.z = a;
    prop.add(blade);
  }
  const spinner = new THREE.Mesh(new THREE.ConeGeometry(0.34, 0.7, 8), cream);
  spinner.rotation.x = -Math.PI / 2;
  spinner.position.z = -0.45;
  prop.add(spinner);
  group.add(prop);

  // Landing gear: two main wheels + tail wheel, on a rig that slides up/down.
  const gear = new THREE.Group();
  const wheelGeo = new THREE.CylinderGeometry(0.55, 0.55, 0.4, 10);
  wheelGeo.rotateZ(Math.PI / 2);
  for (const s of [-1, 1]) {
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 1.5, 5), metal);
    leg.position.set(s * 1.15, -1.15, -0.6);
    leg.rotation.z = s * 0.28;
    gear.add(leg);
    const wheel = new THREE.Mesh(wheelGeo, dark);
    wheel.position.set(s * 1.35, -1.85, -0.6);
    gear.add(wheel);
    const hubcap = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.44, 8), cream);
    hubcap.rotation.z = Math.PI / 2;
    hubcap.position.set(s * 1.35, -1.85, -0.6);
    gear.add(hubcap);
  }
  const tailWheel = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 0.25, 8), dark);
  tailWheel.rotation.z = Math.PI / 2;
  tailWheel.position.set(0, -1.15, 3.3);
  gear.add(tailWheel);
  group.add(gear);

  // Navigation lights: red left, green right, white tail.
  const navL = new THREE.Mesh(new THREE.SphereGeometry(0.16, 6, 6), new THREE.MeshBasicMaterial({ color: 0xff2222 }));
  navL.position.set(-5.9, 1.35, -0.3);
  group.add(navL);
  const navR = new THREE.Mesh(new THREE.SphereGeometry(0.16, 6, 6), new THREE.MeshBasicMaterial({ color: 0x22ff66 }));
  navR.position.set(5.9, 1.35, -0.3);
  group.add(navR);

  group.traverse((o) => {
    if (o.isMesh) o.castShadow = false;
  });

  let gearAnim = 1; // 1 = down, 0 = up
  return {
    group,
    /** dt step: spin the prop with speed, slide the gear toward its target. */
    update(dt, speed, gearDown) {
      prop.rotation.z -= (4 + speed * 1.1) * dt;
      const target = gearDown ? 1 : 0;
      gearAnim += Math.sign(target - gearAnim) * dt * 1.6;
      gearAnim = Math.max(0, Math.min(1, gearAnim));
      gear.position.y = (gearAnim - 1) * 1.5;
      gear.visible = gearAnim > 0.02;
    },
  };
}
