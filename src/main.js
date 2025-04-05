import * as THREE from 'three';

// Mock 8th Wall API
const XR8 = {
  // Store camera pipeline modules
  _pipelineModules: [],
  
  // Mock run function to start the AR session
  run: function(config) {
    console.log('Mock 8th Wall session started');
    this.canvas = config.canvas;
    
    // Initialize mock camera tracking
    this._initMockTracking();
    
    // Call all pipeline module onStart callbacks
    this._pipelineModules.forEach(module => {
      if (module.onStart) module.onStart();
    });
    
    // Start render loop
    this._startRenderLoop();
  },
  
  // Add a camera pipeline module
  addCameraPipelineModule: function(module) {
    this._pipelineModules.push(module);
    return this;
  },
  
  // Initialize mock camera tracking
  _initMockTracking: function() {
    this._cameraPose = {
      position: new THREE.Vector3(0, 0, 0),
      rotation: new THREE.Quaternion(),
      scale: new THREE.Vector3(1, 1, 1)
    };
    
    // Simulate slight camera movement
    this._movementSpeed = 0.01;
    this._rotationSpeed = 0.002;
  },
  
  // Start the render loop
  _startRenderLoop: function() {
    const animate = () => {
      // Update mock camera tracking
      this._updateMockTracking();
      
      // Call all pipeline module onUpdate callbacks
      const frameData = {
        processCpuTime: 10 + Math.random() * 5,
        processGpuTime: 8 + Math.random() * 3,
        processTotalTime: 18 + Math.random() * 8
      };
      
      this._pipelineModules.forEach(module => {
        if (module.onUpdate) module.onUpdate(frameData);
      });
      
      requestAnimationFrame(animate);
    };
    
    animate();
  },
  
  // Update mock camera tracking
  _updateMockTracking: function() {
    // Simulate slight movement and rotation
    this._cameraPose.position.x += (Math.random() - 0.5) * this._movementSpeed;
    this._cameraPose.position.y += (Math.random() - 0.5) * this._movementSpeed;
    this._cameraPose.position.z += (Math.random() - 0.5) * this._movementSpeed;
    
    const angle = (Math.random() - 0.5) * this._rotationSpeed;
    const quat = new THREE.Quaternion().setFromAxisAngle(
      new THREE.Vector3(0, 1, 0), angle
    );
    this._cameraPose.rotation.multiply(quat);
  },
  
  // Get the current camera pose
  getCameraPose: function() {
    return this._cameraPose;
  }
};

// Main application code
const camera = new THREE.PerspectiveCamera(
  80,
  window.innerWidth / window.innerHeight,
  0.001,
  1000
);

const renderer = new THREE.WebGLRenderer({ 
  alpha: true, 
  preserveDrawingBuffer: true 
});
renderer.setSize(window.innerWidth, window.innerHeight);

const scene = new THREE.Scene();
document.body.appendChild(renderer.domElement);

window.addEventListener("resize", () => {
  renderer.setSize(window.innerWidth, window.innerHeight);
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
});

// Add a custom pipeline module for debugging
XR8.addCameraPipelineModule({
  name: 'customModule',
  onStart: () => { console.log("Mock 8th Wall session started"); },
  onUpdate: ({ processCpuTime }) => {
    // Optional: Add custom per-frame logic here
  },
});

// Start the mock 8th Wall session
XR8.run({
  canvas: renderer.domElement
});

// 3D object setup
const boxGeometry = new THREE.BoxGeometry(1, 1, 1);
const boxMaterial = new THREE.MeshBasicMaterial({ color: 0x00ff00 });
const box = new THREE.Mesh(boxGeometry, boxMaterial);
box.position.set(0, 0, -2); // Place box 2 meters in front of camera
scene.add(box);

// GPS functionality (same as original)
let initialPosition = null;

navigator.geolocation.getCurrentPosition((pos) => {
  if (!initialPosition) {
    initialPosition = {
      latitude: pos.coords.latitude,
      longitude: pos.coords.longitude
    };
    
    const earthRadius = 6371000;
    const latChange = (1 / earthRadius) * (180 / Math.PI);
    const boxLat = initialPosition.latitude + latChange;
    const boxLon = initialPosition.longitude;
    
    const worldPos = gpsToWorld(boxLon, boxLat, 0);
    box.position.copy(worldPos);
    console.log("Box placed 1 meter north of initial position:", worldPos);
  }
});

function gpsToWorld(lon, lat, alt) {
  const scale = 100;
  const x = (lon - initialPosition.longitude) * scale;
  const z = (lat - initialPosition.latitude) * scale;
  return new THREE.Vector3(x, alt, z);
}

// Fake GPS handler
document.getElementById("setFakeLoc")?.addEventListener("click", () => {
  alert("Using fake input GPS, not real GPS location");
  initialPosition = null;
  const fakeLon = parseFloat(document.getElementById("fakeLon").value);
  const fakeLat = parseFloat(document.getElementById("fakeLat").value);
  const fakePos = { coords: { latitude: fakeLat, longitude: fakeLon } };
  navigator.geolocation.getCurrentPosition = (cb) => cb(fakePos);
});

// Render loop
function animate() {
  // Update camera from mock tracking
  const pose = XR8.getCameraPose();
  camera.position.copy(pose.position);
  camera.quaternion.copy(pose.rotation);
  camera.scale.copy(pose.scale);
  
  renderer.render(scene, camera);
}

renderer.setAnimationLoop(animate);
