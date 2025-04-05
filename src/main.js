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
// Store the initial position to calculate relative positions
let initialPosition = null;

// Create a local coordinate system instead of relying on GPS updates
locar.on("gpsupdate", async (pos) => {
  if (!initialPosition) {
    // Store the first GPS position as our reference point
    initialPosition = {
      latitude: pos.coords.latitude,
      longitude: pos.coords.longitude,
      accuracy: pos.coords.accuracy
    };
    
    console.log("Initial position set:", initialPosition);
    
    // Place the box 1 meter in front of the user in the local coordinate system
    // We'll use a local coordinate system relative to the user's initial position
    const boxMesh = new THREE.Mesh(boxGeometry, boxMaterial);
    
    // Add the box to the scene at a fixed position 1 meter in front of the initial position
    // This uses the local coordinate system of the scene
    boxMesh.position.set(0, 0, -1); // 1 meter in front (negative z is forward)
    scene.add(boxMesh);
    
    // Set up the initial position for the location-based system
    locar.setWorldPosition(boxMesh, initialPosition.longitude, initialPosition.latitude);
    
    boxPlaced = true;
    console.log("Box placed 1 meter in front of initial position");
  }
});

// Alternative approach: place the box relative to the camera on first position
// and then let it stay fixed in the world
document.getElementById("placeBox").addEventListener("click", () => {
  if (!boxPlaced) {
    // Create a box 1 meter in front of the camera
    const boxMesh = new THREE.Mesh(boxGeometry, boxMaterial);
    
    // Position the box 1 meter in front of the camera
    boxMesh.position.set(0, 0, -1);
    
    // Get the camera's current position and orientation
    const cameraWorldPosition = new THREE.Vector3();
    camera.getWorldPosition(cameraWorldPosition);
    
    // Apply the camera's rotation to the box position
    const cameraDirection = new THREE.Vector3(0, 0, -1);
    cameraDirection.applyQuaternion(camera.quaternion);
    cameraDirection.multiplyScalar(1); // 1 meter distance
    
    // Set the box position
    boxMesh.position.copy(cameraWorldPosition).add(cameraDirection);
    
    // Add the box to the scene
    scene.add(boxMesh);
    
    boxPlaced = true;
    console.log("Box placed 1 meter in front of camera");
  }
});

document.getElementById("setFakeLoc").addEventListener("click", (e) => {
  alert("Using fake input GPS, not real GPS location");
  locar.stopGps();
  locar.fakeGps(
    parseFloat(document.getElementById("fakeLon").value),
    parseFloat(document.getElementById("fakeLat").value)
  );
  // Reset initial position and box placement
  initialPosition = null;
  boxPlaced = false;
});

// Add a button to the UI for placing the box
const placeBoxButton = document.createElement("button");
placeBoxButton.id = "placeBox";
placeBoxButton.textContent = "Place Box Here";
placeBoxButton.style.position = "absolute";
placeBoxButton.style.bottom = "20px";
placeBoxButton.style.left = "50%";
placeBoxButton.style.transform = "translateX(-50%)";
placeBoxButton.style.padding = "10px 20px";
placeBoxButton.style.zIndex = "1000";
document.body.appendChild(placeBoxButton);

locar.startGps();

renderer.setAnimationLoop(animate);

function animate() {
  cam.update();
  deviceControls.update();
  
  const objects = clickHandler.raycast(camera, scene);
  if (objects.length) {
    alert(`This is ${objects[0].object.properties?.name || "AR Box"}`);
  }
  
  renderer.render(scene, camera);
}
