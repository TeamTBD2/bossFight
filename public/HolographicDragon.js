import * as THREE from "https://cdn.skypack.dev/three@0.136.0";
import { GLTFLoader } from "https://cdn.skypack.dev/three@0.136.0/examples/jsm/loaders/GLTFLoader.js";

export class HolographicDragon {
  constructor() {
    this.model = null;
    this.mixer = null;
    this.clock = new THREE.Clock();
  }

  async load() {
    const loader = new GLTFLoader();
    return new Promise((resolve, reject) => {
      loader.load(
        "./animation.glb",
        (gltf) => {
          console.log("GLTF Loaded:", gltf);
          this._processModel(gltf);
          resolve(this);
        },
        undefined,
        (error) => {
          console.error("Error loading GLTF:", error);
          reject(error);
        }
      );
    });
  }

  _processModel(gltf) {
    this.model = gltf.scene;
    this.model.position.set(0, -1, 0);
    this.model.scale.set(0.1, 0.1, 0.1);

    // Apply holographic material
    this.model.traverse((child) => {
      if (child.isMesh) {
        child.material = new THREE.MeshPhongMaterial({
          color: 0x88ffff, // Softer cyan color
          //   color: 0x00ffff,
          emissive: 0x00ffff,
          emissiveIntensity: 0.1, // Reduced intensity
          transparent: true,
          opacity: 0.9, // Better visibility while maintaining transparency
          blending: THREE.NormalBlending, // More natural blending
          depthWrite: true, // Better depth sorting
          specular: 0x333333, // Softer specular highlights
          shininess: 15, // Less shiny surface
          wireframe: true, // Remove full wireframe
          wireframeLinewidth: 0.3,
        });
      }
    });

    // Set up animations
    if (gltf.animations?.length) {
      console.log("Animations found:", gltf.animations);
      this.mixer = new THREE.AnimationMixer(this.model);
      const idleClip = THREE.AnimationClip.findByName(
        gltf.animations,
        "idle Pose"
      );
      if (idleClip) {
        this.mixer.clipAction(idleClip).play();
      }
    }
  }

  update() {
    const delta = this.clock.getDelta();
    if (this.mixer) this.mixer.update(delta);
  }
}
