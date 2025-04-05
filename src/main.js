import * as THREE from 'three';
import * as LocAR from 'locar';

const camera = new THREE.PerspectiveCamera(80, window.innerWidth / window.innerHeight, 0.001, 1000);

const renderer = new THREE.WebGLRenderer();
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

const scene = new THREE.Scene();

const locar = new LocAR.LocationBased(scene, camera);

window.addEventListener("resize", e => {
  renderer.setSize(window.innerWidth, window.innerHeight);
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
});

const cam = new LocAR.WebcamRenderer(renderer);

let firstLocation = true;

const deviceOrientationControls = new LocAR.DeviceOrientationControls(camera);

if (firstLocation) {
  locar.on("gpsupdate", (pos, distMoved) => {
    console.log("Updating")
    let originalPos = pos;

    const boxProps = [{
      latDis: 0.0005,
      lonDis: 0,
      colour: 0xff0000
    }, {
      latDis: -0.0005,
      lonDis: 0,
      colour: 0xffff00
    }, {
      latDis: 0,
      lonDis: -0.0005,
      colour: 0x00ffff
    }, {
      latDis: 0,
      lonDis: 0.0005,
      colour: 0x00ff00
    }];

    const geom = new THREE.BoxGeometry(10, 10, 10);

    for (const boxProp of boxProps) {
      const mesh = new THREE.Mesh(
        geom,
        new THREE.MeshBasicMaterial({ color: boxProp.colour })
      );

      locar.add(
        mesh,
        originalPos.coords.longitude + boxProp.lonDis,
        originalPos.coords.latitude + boxProp.latDis
      );
    }

    firstLocation = false;
  }
  )
};

locar.startGps();

renderer.setAnimationLoop(animate);

function animate() {
  cam.update();
  deviceOrientationControls.update();
  renderer.render(scene, camera);
}