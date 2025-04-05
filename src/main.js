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

// Get a reference to the new coordinate display div
const coordDisplay = document.getElementById("coordinateDisplay");

locar.on("gpsupdate", (pos, distMoved) => {
  const userLat = pos.coords.latitude;
  const userLon = pos.coords.longitude;
  // Box properties are defined with latDis: 0 and lonDis: 0.00005.
  const boxLat = userLat + 0;
  const boxLon = userLon + 0.00005;

  // Update the coordinate display div with current user and box coordinates.
  coordDisplay.innerHTML = `
    <strong>User Coordinates:</strong> Latitude: ${userLat.toFixed(6)}, Longitude: ${userLon.toFixed(6)}<br>
    <strong>Box Coordinates:</strong> Latitude: ${boxLat.toFixed(6)}, Longitude: ${boxLon.toFixed(6)}
  `;

  if (firstLocation) {
    const boxProps = [{
      latDis: 0,
      lonDis: 0.00005,
      colour: 0x00ff00
    }];

    const geom = new THREE.BoxGeometry(1, 1, 1);

    for (const boxProp of boxProps) {
      const mesh = new THREE.Mesh(
        geom,
        new THREE.MeshBasicMaterial({ color: boxProp.colour })
      );

      locar.add(
        mesh,
        pos.coords.longitude + boxProp.lonDis,
        pos.coords.latitude + boxProp.latDis
      );
    }

    firstLocation = false;
  }
});

locar.startGps();

renderer.setAnimationLoop(animate);

function animate() {
  cam.update();
  deviceOrientationControls.update();
  renderer.render(scene, camera);
}
