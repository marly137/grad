import * as THREE from "three";

const openingTime = 900;
const clamp = (value) => THREE.MathUtils.clamp(value, 0, 1);
const ease = (value) => 1 - (1 - value) ** 3;

function paper(color) {
  return new THREE.MeshStandardMaterial({ color, roughness: 0.88, side: THREE.DoubleSide });
}

function panel(points, material, thickness = 0) {
  const outline = new THREE.Shape(points.map(([x, y]) => new THREE.Vector2(x, y)));
  const geometry = thickness
    ? new THREE.ExtrudeGeometry(outline, { depth: thickness, bevelEnabled: false })
    : new THREE.ShapeGeometry(outline);
  return new THREE.Mesh(geometry, material);
}

function box(width, height, thickness, material) {
  return new THREE.Mesh(new THREE.BoxGeometry(width, height, thickness), material);
}

function mark(material) {
  return panel([[0, .17], [.055, .055], [.17, 0], [.055, -.055], [0, -.17], [-.055, -.055], [-.17, 0], [-.055, .055]], material);
}

function makeEnvelope() {
  const envelope = new THREE.Group();
  envelope.rotation.set(-.065, -.2, -.11);
  envelope.position.y = -.33;

  const back = box(4.18, 2.62, .14, paper("#b4cfe3"));
  back.position.z = -.1;
  envelope.add(back);

  const card = new THREE.Group();
  card.position.set(0, -.22, .022);
  card.add(box(3.74, 2.12, .055, paper("#f9fcff")));
  const cardInk = paper("#527e9e");
  const cardMark = mark(cardInk);
  cardMark.position.set(0, .56, .032);
  card.add(cardMark);
  for (const [width, y] of [[1.43, .21], [2.11, -.12], [1.77, -.32]]) {
    const line = box(width, .026, .014, cardInk);
    line.position.set(0, y, .035);
    card.add(line);
  }
  envelope.add(card);

  const left = panel([[-2.09, -1.31], [-2.09, 1.31], [.15, -.38]], paper("#a4c7e2"));
  const right = panel([[2.09, -1.31], [2.09, 1.31], [-.15, -.38]], paper("#b2d0e7"));
  left.position.z = right.position.z = .15;
  const pocketEdge = panel([[-2.09, -1.31], [2.09, -1.31], [2.09, -.95], [0, .43], [-2.09, -.95]], paper("#a2bfd5"));
  pocketEdge.position.z = .16;
  const pocket = panel([[-2.09, -1.31], [2.09, -1.31], [2.09, -.97], [0, .395], [-2.09, -.97]], paper("#c9dff2"));
  pocket.position.z = .17;
  envelope.add(left, right, pocketEdge, pocket);

  const flap = new THREE.Group();
  flap.position.set(0, 1.31, .18);
  flap.add(panel([[-2.09, 0], [2.09, 0], [.13, -1.62], [-.13, -1.62]], paper("#d4e8f8"), .034));

  const seal = new THREE.Group();
  seal.position.set(0, -1.44, .057);
  const wax = new THREE.Mesh(new THREE.CylinderGeometry(.33, .35, .075, 48), paper("#204660"));
  wax.rotation.x = Math.PI / 2;
  const ring = new THREE.Mesh(new THREE.TorusGeometry(.265, .011, 8, 40), paper("#9ebdd3"));
  ring.position.z = .043;
  const waxMark = mark(paper("#d9e8f4"));
  waxMark.position.z = .046;
  seal.add(wax, ring, waxMark);
  flap.add(seal);
  envelope.add(flap);

  return { envelope, card, flap };
}

export function mountEnvelope(stage) {
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("webgl2", { alpha: true, antialias: true });
  if (!context) return;

  const renderer = new THREE.WebGLRenderer({ canvas, context });
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  const scene = new THREE.Scene();
  const camera = new THREE.OrthographicCamera(-3, 3, 2.3, -2.3, .1, 30);
  camera.position.set(0, .33, 10);
  camera.lookAt(0, .33, 0);

  const { envelope, card, flap } = makeEnvelope();
  const fill = new THREE.HemisphereLight(0xf6faff, 0xa1b8cb, 1.55);
  const key = new THREE.DirectionalLight(0xf1f8ff, 1.8);
  key.position.set(-3.5, 5, 8);
  scene.add(envelope, fill, key);

  let frame;
  let opening;
  let finishOpening;
  let disposed = false;

  function render() {
    try {
      renderer.render(scene, camera);
      return true;
    } catch {
      dispose();
      return false;
    }
  }

  function resize() {
    const { clientWidth: width, clientHeight: height } = stage;
    if (disposed || !width || !height) return;
    const aspect = width / height;
    const halfHeight = Math.max(2.42, 2.75 / aspect);
    camera.top = halfHeight;
    camera.bottom = -halfHeight;
    camera.right = halfHeight * aspect;
    camera.left = -camera.right;
    camera.updateProjectionMatrix();
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
    renderer.setSize(width, height, false);
    if (render()) stage.setAttribute("data-rendered", "");
  }

  const observer = new ResizeObserver(resize);
  function dispose() {
    if (disposed) return;
    disposed = true;
    cancelAnimationFrame(frame);
    observer.disconnect();
    canvas.removeEventListener("webglcontextlost", dispose);
    scene.traverse((object) => {
      object.geometry?.dispose();
      object.material?.dispose();
    });
    renderer.dispose();
    canvas.remove();
    stage.removeAttribute("data-rendered");
    finishOpening?.();
  }

  function open() {
    if (disposed) return Promise.resolve();
    if (opening) return opening;

    opening = new Promise((resolve) => { finishOpening = resolve; });
    const startedAt = performance.now();
    function animate(now) {
      const progress = clamp((now - startedAt) / openingTime);
      const lift = ease(clamp((progress - .45) / .55));
      flap.rotation.x = -Math.PI * ease(clamp(progress / .56));
      flap.position.z = .18 - .24 * ease(clamp((progress - .27) / .29));
      card.position.y = -.22 + 1.48 * lift;
      card.position.z = .022 + .085 * lift;
      envelope.rotation.z = -.11 + .055 * lift;
      if (!render()) return;
      if (progress < 1) frame = requestAnimationFrame(animate);
      else finishOpening();
    }
    frame = requestAnimationFrame(animate);
    return opening;
  }

  canvas.addEventListener("webglcontextlost", dispose, { once: true });
  stage.append(canvas);
  observer.observe(stage);
  resize();
  return { open, dispose };
}
