import * as THREE from 'three';
import * as LocAR from 'locar';

// === Shared origin: must be consistent for all clients ===
const SHARED_ORIGIN = {
  latitude: 53.4697234,
  longitude: -2.2340321
};

// === Scene setup ===
const camera = new THREE.PerspectiveCamera(80, window.innerWidth / window.innerHeight, 0.001, 1000);
const renderer = new THREE.WebGLRenderer();
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

const scene = new THREE.Scene();
const locar = new LocAR.LocationBased(scene, camera);
const cam = new LocAR.WebcamRenderer(renderer);
let deviceOrientationControls = new LocAR.DeviceOrientationControls(camera);

// === Resize handler ===
window.addEventListener("resize", () => {
  renderer.setSize(window.innerWidth, window.innerHeight);
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
});

// === Convert GPS to offset in meters from origin ===
function gpsOffsetInMeters(origin, target) {
  const toRad = deg => deg * Math.PI / 180;
  const R = 6378137; // Earth radius in meters

  const dLat = toRad(target.latitude - origin.latitude);
  const dLon = toRad(target.longitude - origin.longitude);

  const x = dLon * R * Math.cos(toRad((origin.latitude + target.latitude) / 2));
  const z = dLat * R;

  return { x, z: -z }; // flip Z to make north = forward
}

// === Distance helper for movement detection ===
function getDistanceMoved(pos1, pos2) {
  const R = 6371000;
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

// === Start tracking GPS ===
locar.startGps();

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

// === GPS update logic ===
let firstLocation = true;

locar.on("gpsupdate", (pos, distMoved) => {
  if (firstLocation) {
    alert(`Got location: lon ${pos.coords.longitude}, lat ${pos.coords.latitude}`);

    const boxProps = [
      {
        lat: SHARED_ORIGIN.latitude + 0.000005,
        lon: SHARED_ORIGIN.longitude,
        colour: 0xff0000
      }
    ];

    const geom = new THREE.BoxGeometry(0.5, 0.5, 0.5);

    for (const box of boxProps) {
      const mesh = new THREE.Mesh(
        geom,
        new THREE.MeshBasicMaterial({ color: box.colour })
      );

      // Compute offset from shared origin
      const offset = gpsOffsetInMeters(SHARED_ORIGIN, {
        latitude: box.lat,
        longitude: box.lon
      });

      mesh.position.set(offset.x, 0, offset.z);
      scene.add(mesh);

      console.log(`Placing box at offset x: ${offset.x.toFixed(2)} m, z: ${offset.z.toFixed(2)} m`);
    }

    firstLocation = false;
  }
});

// === Fake GPS support ===
document.getElementById("setFakeLoc").addEventListener("click", () => {
  alert("Using fake GPS input.");
  const fakeLon = parseFloat(document.getElementById("fakeLon").value);
  const fakeLat = parseFloat(document.getElementById("fakeLat").value);

  const fakePosition = {
    coords: {
      longitude: fakeLon,
      latitude: fakeLat
    }
  };

  locar.emit("gpsupdate", fakePosition, 0);
});

// === Render loop ===
renderer.setAnimationLoop(animate);
function animate() {
  cam.update();
  deviceOrientationControls?.update();
  renderer.render(scene, camera);
}
