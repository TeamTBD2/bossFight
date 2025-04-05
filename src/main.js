import * as THREE from 'three';
import * as LocAR from 'locar';

// Set up Three.js scene, camera, and renderer
const camera = new THREE.PerspectiveCamera(80, window.innerWidth / window.innerHeight, 0.001, 1000);
const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

const scene = new THREE.Scene();

// Create LocationBased object
const locar = new LocAR.LocationBased(scene, camera);

// Create webcam renderer
const cam = new LocAR.WebcamRenderer(renderer);

// Add device orientation controls
const deviceOrientationControls = new LocAR.DeviceOrientationControls(camera);

// Create a world origin container that will stay fixed in the physical world
const worldContainer = new THREE.Group();
scene.add(worldContainer);

// Track initial location processing
let originSet = false;
let originGpsPosition = null;

// Track current GPS position
let currentGpsPosition = null;

// Resize handler
window.addEventListener("resize", () => {
  renderer.setSize(window.innerWidth, window.innerHeight);
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
});

// Function to add objects in world space relative to the user
function addWorldSpaceObjects() {
  // Create boxes at fixed physical distances from the user
  const boxPositions = [
    { position: new THREE.Vector3(0, 0, -10), color: 0xff0000, label: "10m North" },     // 10m North (forward)
    { position: new THREE.Vector3(0, 0, 10), color: 0xffff00, label: "10m South" },      // 10m South (behind)
    { position: new THREE.Vector3(-10, 0, 0), color: 0x00ffff, label: "10m West" },      // 10m West (left)
    { position: new THREE.Vector3(10, 0, 0), color: 0x00ff00, label: "10m East" }        // 10m East (right)
  ];

  // Create geometry for all boxes
  const geometry = new THREE.BoxGeometry(2, 2, 2);

  // Create boxes at specified positions
  boxPositions.forEach(box => {
    // Create mesh with the specified color
    const material = new THREE.MeshBasicMaterial({ color: box.color });
    const mesh = new THREE.Mesh(geometry, material);

    // Set position
    mesh.position.copy(box.position);

    // Add label text
    const textGeometry = createTextLabel(box.label);
    mesh.add(textGeometry);

    // Add to world container
    worldContainer.add(mesh);

    console.log(`Added box at world position: ${box.position.x}, ${box.position.y}, ${box.position.z}`);
  });
}

// Function to create a text label
function createTextLabel(text) {
  // Create a canvas texture for the text
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d');
  canvas.width = 256;
  canvas.height = 128;

  // Draw background
  context.fillStyle = 'rgba(0, 0, 0, 0.5)';
  context.fillRect(0, 0, canvas.width, canvas.height);

  // Draw text
  context.font = '24px Arial';
  context.fillStyle = 'white';
  context.textAlign = 'center';
  context.fillText(text, canvas.width / 2, canvas.height / 2);

  // Create texture from canvas
  const texture = new THREE.CanvasTexture(canvas);
  const material = new THREE.MeshBasicMaterial({
    map: texture,
    transparent: true,
    side: THREE.DoubleSide
  });

  // Create plane for text
  const geometry = new THREE.PlaneGeometry(4, 2);
  const textMesh = new THREE.Mesh(geometry, material);

  // Position above the box
  textMesh.position.set(0, 3, 0);

  // Make text billboard always face camera
  const billboardGroup = new THREE.Group();
  billboardGroup.add(textMesh);

  // Update billboard rotation in animation loop
  billboardGroups.push(billboardGroup);

  return billboardGroup;
}

// Keep track of billboards to update
const billboardGroups = [];

// Handle GPS updates
locar.on("gpsupdate", (pos) => {
  // Store current GPS position
  currentGpsPosition = pos;

  // If this is the first location update, set up the scene
  if (!originSet) {
    console.log(`Initial GPS location: longitude ${pos.coords.longitude}, latitude ${pos.coords.latitude}`);

    // Store origin GPS position
    originGpsPosition = {
      longitude: pos.coords.longitude,
      latitude: pos.coords.latitude
    };

    // Add objects in world space
    addWorldSpaceObjects();

    // Update status
    document.getElementById("gpsStatus").textContent =
      `Origin: ${pos.coords.latitude.toFixed(6)}, ${pos.coords.longitude.toFixed(6)}`;

    // Mark origin as set
    originSet = true;
  } else {
    // Update position status
    document.getElementById("gpsStatus").textContent =
      `Current: ${pos.coords.latitude.toFixed(6)}, ${pos.coords.longitude.toFixed(6)}`;
  }
});

// Add manual position button handler
document.getElementById("placeObjectButton")?.addEventListener("click", () => {
  if (!originSet) {
    alert("Wait for GPS position to be established first");
    return;
  }

  // Create a new object 5 meters in front of the camera
  const direction = new THREE.Vector3(0, 0, -1);
  direction.applyQuaternion(camera.quaternion);
  direction.multiplyScalar(5);

  // Create box
  const geometry = new THREE.BoxGeometry(1, 1, 1);
  const material = new THREE.MeshBasicMaterial({ color: 0xff00ff });
  const mesh = new THREE.Mesh(geometry, material);

  // Position based on camera direction
  mesh.position.copy(direction);

  // Add to world container
  worldContainer.add(mesh);

  // Add timestamp label
  const timestamp = new Date().toLocaleTimeString();
  const textGeometry = createTextLabel(`Object at ${timestamp}`);
  mesh.add(textGeometry);

  console.log(`Placed new object at ${direction.x.toFixed(2)}, ${direction.y.toFixed(2)}, ${direction.z.toFixed(2)}`);
});

// Fake GPS location button
document.getElementById("setFakeLoc")?.addEventListener("click", () => {
  const fakeLon = parseFloat(document.getElementById("fakeLon").value);
  const fakeLat = parseFloat(document.getElementById("fakeLat").value);

  if (isNaN(fakeLon) || isNaN(fakeLat)) {
    alert("Please enter valid coordinates");
    return;
  }

  alert(`Using fake GPS location: ${fakeLat}, ${fakeLon}`);
  locar.stopGps();
  locar.fakeGps(fakeLon, fakeLat);
});

// Start GPS tracking
locar.startGps();

// Animation loop
function animate() {
  // Update webcam
  cam.update();

  // Update device orientation controls
  deviceOrientationControls?.update();

  // Update all billboards to face the camera
  billboardGroups.forEach(group => {
    group.quaternion.copy(camera.quaternion);
  });

  // Render scene
  renderer.render(scene, camera);
}

// Start animation loop
renderer.setAnimationLoop(animate);

// Add status display element to the DOM if it doesn't exist
if (!document.getElementById("gpsStatus")) {
  const statusElement = document.createElement("div");
  statusElement.id = "gpsStatus";
  statusElement.style.position = "fixed";
  statusElement.style.bottom = "20px";
  statusElement.style.left = "20px";
  statusElement.style.backgroundColor = "rgba(0,0,0,0.7)";
  statusElement.style.color = "white";
  statusElement.style.padding = "10px";
  statusElement.style.borderRadius = "5px";
  statusElement.style.fontFamily = "Arial, sans-serif";
  statusElement.style.zIndex = "999";
  statusElement.textContent = "Waiting for GPS...";
  document.body.appendChild(statusElement);
}

// Add place object button if it doesn't exist
if (!document.getElementById("placeObjectButton")) {
  const button = document.createElement("button");
  button.id = "placeObjectButton";
  button.textContent = "Place Object Here";
  button.style.position = "fixed";
  button.style.bottom = "20px";
  button.style.right = "20px";
  button.style.backgroundColor = "#4CAF50";
  button.style.color = "white";
  button.style.padding = "10px 20px";
  button.style.border = "none";
  button.style.borderRadius = "5px";
  button.style.cursor = "pointer";
  button.style.fontSize = "16px";
  button.style.zIndex = "999";
  document.body.appendChild(button);
}