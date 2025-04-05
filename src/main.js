import * as THREE from 'three';
import * as LocAR from 'locar';

const camera = new THREE.PerspectiveCamera(
  80,
  window.innerWidth / window.innerHeight,
  0.001,
  1000
);
const renderer = new THREE.WebGLRenderer();
renderer.setSize(window.innerWidth, window.innerHeight);
const scene = new THREE.Scene();

document.body.appendChild(renderer.domElement);

window.addEventListener("resize", (e) => {
  renderer.setSize(window.innerWidth, window.innerHeight);
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
});

const locar = new LocAR.LocationBased(scene, camera);
const deviceControls = new LocAR.DeviceOrientationControls(camera);
const cam = new LocAR.WebcamRenderer(renderer);
const clickHandler = new LocAR.ClickHandler(renderer);

// Create a box geometry
const boxGeometry = new THREE.BoxGeometry(1, 1, 1);
const boxMaterial = new THREE.MeshBasicMaterial({ color: 0x00ff00 });
const box = new THREE.Mesh(boxGeometry, boxMaterial);

// Store the initial GPS position
let initialPosition = null;

locar.on("gpsupdate", async (pos) => {
  // Only set the initial position once
  if (!initialPosition) {
    initialPosition = {
      latitude: pos.coords.latitude,
      longitude: pos.coords.longitude
    };

    // Calculate a position 1 meter north of the initial position
    const earthRadius = 6371000; // Earth radius in meters
    const latChange = (1 / earthRadius) * (180 / Math.PI);
    
    const boxLat = initialPosition.latitude + latChange;
    const boxLon = initialPosition.longitude;
    
    // Add the box to the scene at the calculated position
    locar.add(box, boxLon, boxLat, 0, { name: "AR Box" });
    
    console.log("Box placed 1 meter north of initial position:", boxLon, boxLat);
  }
});

document.getElementById("setFakeLoc").addEventListener("click", (e) => {
  alert("Using fake input GPS, not real GPS location");
  locar.stopGps();
  locar.fakeGps(
    parseFloat(document.getElementById("fakeLon").value),
    parseFloat(document.getElementById("fakeLat").value)
  );
  // Reset initial position so the box will be placed again
  initialPosition = null;
});

locar.startGps();

renderer.setAnimationLoop(animate);

function animate() {
  cam.update();
  deviceControls.update();
  
  const objects = clickHandler.raycast(camera, scene);
  if (objects.length) {
    alert(`This is ${objects[0].object.properties.name}`);
  }
  
  renderer.render(scene, camera);
}
