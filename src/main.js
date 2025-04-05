import * as THREE from 'three';
import * as LocAR from 'locar';

// Scene, camera, renderer setup
const camera = new THREE.PerspectiveCamera(80, window.innerWidth / window.innerHeight, 0.001, 1000);
const renderer = new THREE.WebGLRenderer();
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

const scene = new THREE.Scene();
const locar = new LocAR.LocationBased(scene, camera);
const cam = new LocAR.WebcamRenderer(renderer);
let deviceOrientationControls = new LocAR.DeviceOrientationControls(camera);

// Handle resizing
window.addEventListener("resize", () => {
  renderer.setSize(window.innerWidth, window.innerHeight);
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
});

// Track initial location
let firstLocation = true;

// Distance helper
function getDistanceMoved(pos1, pos2) {
  const R = 6371000; // Earth radius in meters
  const toRad = deg => deg * Math.PI / 180;
  const dLat = toRad(pos2.latitude - pos1.latitude);
  const dLon = toRad(pos2.longitude - pos1.longitude);
  const lat1 = toRad(pos1.latitude);
  const lat2 = toRad(pos2.latitude);

  const a = Math.sin(dLat / 2) ** 2 +
    Math.sin(dLon / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

locar.startGps();
// Manual GPS using Geolocation API
let lastPosition = null;

navigator.geolocation.watchPosition(
  position => {
    const distMoved = lastPosition
      ? getDistanceMoved(lastPosition.coords, position.coords)
      : 0;

    lastPosition = position;

    locar.emit("gpsupdate", position, distMoved);
  },
  error => {
    console.error("Geolocation error:", error);
    alert("Failed to access GPS. Please enable location services.");
  },
  {
    enableHighAccuracy: true,
    maximumAge: 0,
    timeout: 5000
  }
);

// GPS update event handler
locar.on("gpsupdate", (pos, distMoved) => {
  if (firstLocation) {
    alert(`Got the initial location: longitude ${pos.coords.longitude}, latitude ${pos.coords.latitude}`);

    const boxProps = [
      { latDis: 0.000005, lonDis: 0, colour: 0xff0000 },
      { latDis: -0.000005, lonDis: 0, colour: 0xffff00 },
      { latDis: 0, lonDis: -0.000005, colour: 0x00ffff },
      { latDis: 0, lonDis: 0.000005, colour: 0x00ff00 }
    ];

    const geom = new THREE.BoxGeometry(0.5, 0.5, 0.5);

    for (const box of boxProps) {
      const mesh = new THREE.Mesh(
        geom,
        new THREE.MeshBasicMaterial({ color: box.colour })
      );

      console.log(`Adding box at ${pos.coords.longitude + box.lonDis}, ${pos.coords.latitude + box.latDis}`);
      locar.add(mesh, pos.coords.longitude + box.lonDis, pos.coords.latitude + box.latDis);
    }

    firstLocation = false;
  }
});

// Handle fake GPS location
document.getElementById("setFakeLoc").addEventListener("click", () => {
  alert("Using fake GPS input, not real GPS location.");
  const fakeLon = parseFloat(document.getElementById("fakeLon").value);
  const fakeLat = parseFloat(document.getElementById("fakeLat").value);

  // Manually emit fake position
  const fakePosition = {
    coords: {
      longitude: fakeLon,
      latitude: fakeLat
    }
  };

  locar.emit("gpsupdate", fakePosition, 0);
});

// Render loop
renderer.setAnimationLoop(animate);
function animate() {
  cam.update();
  deviceOrientationControls?.update();
  renderer.render(scene, camera);
}
