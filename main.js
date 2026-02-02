import * as THREE from "https://unpkg.com/three@0.160.1/build/three.module.js";

const canvas = document.getElementById("scene");
const menu = document.getElementById("menu");
const hud = document.getElementById("hud");
const crashOverlay = document.getElementById("crash");
const statusText = document.getElementById("status-text");
const startButton = document.getElementById("start-button");
const resetButton = document.getElementById("reset-button");
const crashResetButton = document.getElementById("crash-reset");

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(window.devicePixelRatio);
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;

const scene = new THREE.Scene();
scene.fog = new THREE.Fog(0x06070c, 20, 120);

const camera = new THREE.PerspectiveCamera(
  70,
  window.innerWidth / window.innerHeight,
  0.1,
  500
);

const ambient = new THREE.AmbientLight(0x9bb1ff, 0.5);
scene.add(ambient);

const sun = new THREE.DirectionalLight(0xffffff, 1.1);
sun.position.set(10, 18, 6);
sun.castShadow = true;
sun.shadow.mapSize.set(1024, 1024);
scene.add(sun);

const groundGeometry = new THREE.PlaneGeometry(400, 400);
const groundMaterial = new THREE.MeshStandardMaterial({
  color: 0x11151f,
  roughness: 0.9,
  metalness: 0.1,
});
const ground = new THREE.Mesh(groundGeometry, groundMaterial);
ground.rotation.x = -Math.PI / 2;
ground.receiveShadow = true;
scene.add(ground);

const gridHelper = new THREE.GridHelper(400, 80, 0x1e2433, 0x131720);
scene.add(gridHelper);

const droneGroup = new THREE.Group();
const bodyGeometry = new THREE.BoxGeometry(1.2, 0.35, 2.2);
const bodyMaterial = new THREE.MeshStandardMaterial({
  color: 0x53f7d4,
  metalness: 0.2,
  roughness: 0.4,
});
const body = new THREE.Mesh(bodyGeometry, bodyMaterial);
body.castShadow = true;
droneGroup.add(body);

const cameraMount = new THREE.Mesh(
  new THREE.CylinderGeometry(0.2, 0.35, 0.5, 16),
  new THREE.MeshStandardMaterial({ color: 0x20263a })
);
cameraMount.position.set(0, 0.3, -0.7);
cameraMount.castShadow = true;
droneGroup.add(cameraMount);

scene.add(droneGroup);

const state = {
  started: false,
  crashed: false,
  velocity: new THREE.Vector3(),
  yaw: 0,
  throttle: 0,
};

const controls = {
  forward: false,
  backward: false,
  left: false,
  right: false,
  yawLeft: false,
  yawRight: false,
};

const resetFlight = () => {
  state.crashed = false;
  state.velocity.set(0, 0, 0);
  state.yaw = 0;
  state.throttle = 0;
  droneGroup.position.set(0, 3, 0);
  droneGroup.rotation.set(0, 0, 0);
  crashOverlay.classList.remove("visible");
  statusText.textContent = "Engines reset. Hold W to move forward.";
};

const setStarted = () => {
  state.started = true;
  menu.classList.remove("visible");
  hud.classList.add("visible");
  resetFlight();
};

startButton.addEventListener("click", setStarted);
resetButton.addEventListener("click", resetFlight);
crashResetButton.addEventListener("click", resetFlight);

window.addEventListener("keydown", (event) => {
  if (!state.started) {
    if (event.key.toLowerCase() === "enter") {
      setStarted();
    }
    return;
  }

  switch (event.key.toLowerCase()) {
    case "w":
      controls.forward = true;
      break;
    case "s":
      controls.backward = true;
      break;
    case "a":
      controls.left = true;
      break;
    case "d":
      controls.right = true;
      break;
    case "q":
      controls.yawLeft = true;
      break;
    case "e":
      controls.yawRight = true;
      break;
    case "r":
      resetFlight();
      break;
    default:
      break;
  }
});

window.addEventListener("keyup", (event) => {
  switch (event.key.toLowerCase()) {
    case "w":
      controls.forward = false;
      break;
    case "s":
      controls.backward = false;
      break;
    case "a":
      controls.left = false;
      break;
    case "d":
      controls.right = false;
      break;
    case "q":
      controls.yawLeft = false;
      break;
    case "e":
      controls.yawRight = false;
      break;
    default:
      break;
  }
});

const clock = new THREE.Clock();

const updateFlight = (delta) => {
  if (state.crashed) {
    return;
  }

  const acceleration = 6;
  const yawSpeed = 1.6;
  const damping = 0.92;

  if (controls.yawLeft) {
    state.yaw += yawSpeed * delta;
  }
  if (controls.yawRight) {
    state.yaw -= yawSpeed * delta;
  }

  const forwardVector = new THREE.Vector3(
    Math.sin(state.yaw),
    0,
    Math.cos(state.yaw)
  );
  const rightVector = new THREE.Vector3(
    Math.sin(state.yaw + Math.PI / 2),
    0,
    Math.cos(state.yaw + Math.PI / 2)
  );

  if (controls.forward) {
    state.velocity.addScaledVector(forwardVector, acceleration * delta);
  }
  if (controls.backward) {
    state.velocity.addScaledVector(forwardVector, -acceleration * delta);
  }
  if (controls.left) {
    state.velocity.addScaledVector(rightVector, -acceleration * delta);
  }
  if (controls.right) {
    state.velocity.addScaledVector(rightVector, acceleration * delta);
  }

  state.velocity.multiplyScalar(damping);
  droneGroup.position.addScaledVector(state.velocity, delta);
  droneGroup.rotation.y = state.yaw;

  const tilt = THREE.MathUtils.clamp(state.velocity.length() * 0.05, 0, 0.35);
  droneGroup.rotation.x = -tilt;

  if (droneGroup.position.y <= 0.3) {
    state.crashed = true;
    crashOverlay.classList.add("visible");
    statusText.textContent = "Crash! Reset to continue.";
  }

  if (
    Math.abs(droneGroup.position.x) > 180 ||
    Math.abs(droneGroup.position.z) > 180
  ) {
    state.crashed = true;
    crashOverlay.classList.add("visible");
    statusText.textContent = "Signal lost — reset to continue.";
  }
};

const updateCamera = () => {
  const offset = new THREE.Vector3(0, 2.2, 5.5);
  offset.applyAxisAngle(new THREE.Vector3(0, 1, 0), state.yaw);
  camera.position.copy(droneGroup.position).add(offset);
  camera.lookAt(droneGroup.position.clone().add(new THREE.Vector3(0, 0.6, 0)));
};

const animate = () => {
  requestAnimationFrame(animate);
  const delta = clock.getDelta();

  if (state.started) {
    updateFlight(delta);
    updateCamera();
  } else {
    camera.position.set(0, 6, 10);
    camera.lookAt(0, 0, 0);
  }

  renderer.render(scene, camera);
};

resetFlight();
animate();

window.addEventListener("resize", () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});
