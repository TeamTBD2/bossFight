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

// Flag to track if the box has been placed
let boxPlaced = false;

locar.on("gpsupdate", async (pos) => {
  // Only place the box once when we first get a GPS position
  if (!boxPlaced) {
    // Calculate a position 1 meter north of the user's position
    // We use the haversine formula to calculate the latitude change for 1 meter
    const earthRadius = 6371000; // Earth radius in meters
    const latChange = (1 / earthRadius) * (180 / Math.PI);
    
    // Place the box 1 meter north of the user
    const boxLat = pos.coords.latitude + latChange;
    const boxLon = pos.coords.longitude;
    
    // Add the box to the scene at the calculated position
    locar.add(box, boxLon, boxLat, 0, { name: "AR Box" });
    
    boxPlaced = true;
    console.log("Box placed 1 meter away at:", boxLon, boxLat);
  }
});

document.getElementById("setFakeLoc").addEventListener("click", (e) => {
  alert("Using fake input GPS, not real GPS location");
  locar.stopGps();
  locar.fakeGps(
    parseFloat(document.getElementById("fakeLon").value),
    parseFloat(document.getElementById("fakeLat").value)
  );
  // Reset box placement so it will be placed again with the new location
  boxPlaced = false;
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
