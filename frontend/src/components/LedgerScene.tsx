import { useEffect, useRef, useState } from "react";
import * as THREE from "three";

/*
  The hero visual: a network of nodes on a sphere, a few of them larger —
  hospitals, with the records and identities between them. It drifts on its own
  and leans towards the pointer.

  Built on raw three.js rather than a React renderer so the whole scene is set
  up once and torn down cleanly, and so the only dependency is three itself.
*/

const NODE_COUNT = 90;
const HUB_COUNT = 4;
// High enough that the mesh reads as a dense, woven network rather than a
// sparse wireframe — the links are what carry the idea of a shared ledger.
const LINK_DISTANCE = 0.62;
const RADIUS = 1.45;

const ACCENT = new THREE.Color("#1f47c4");
const HUB = new THREE.Color("#15307f");

// Evenly spread points over a sphere — avoids the clustering at the poles that
// naive random spherical coordinates produce.
function fibonacciSphere(count: number): THREE.Vector3[] {
  const points: THREE.Vector3[] = [];
  const golden = Math.PI * (3 - Math.sqrt(5));

  for (let i = 0; i < count; i++) {
    const y = 1 - (i / (count - 1)) * 2;
    const r = Math.sqrt(Math.max(0, 1 - y * y));
    const theta = golden * i;
    points.push(new THREE.Vector3(Math.cos(theta) * r, y, Math.sin(theta) * r).multiplyScalar(RADIUS));
  }
  return points;
}

export function LedgerScene({ className = "" }: { className?: string }) {
  const hostRef = useRef<HTMLDivElement>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    } catch {
      // No WebGL (old browser, blocked, software rendering off): show nothing
      setFailed(true);
      return;
    }

    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(host.clientWidth, host.clientHeight, false);
    renderer.domElement.style.width = "100%";
    renderer.domElement.style.height = "100%";
    renderer.domElement.style.display = "block";
    host.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(42, host.clientWidth / host.clientHeight, 0.1, 100);
    camera.position.set(0, 0, 4.6);

    const group = new THREE.Group();
    scene.add(group);

    const points = fibonacciSphere(NODE_COUNT);
    // The hubs are spread through the list rather than adjacent to each other
    const hubIndices = new Set(
      Array.from({ length: HUB_COUNT }, (_, i) => Math.floor((i + 0.5) * (NODE_COUNT / HUB_COUNT)))
    );

    /* Nodes ------------------------------------------------------------- */
    const nodeGeometry = new THREE.BufferGeometry().setFromPoints(points);
    const colors = new Float32Array(NODE_COUNT * 3);
    const sizes = new Float32Array(NODE_COUNT);

    points.forEach((_, i) => {
      const hub = hubIndices.has(i);
      const color = hub ? HUB : ACCENT;
      colors.set([color.r, color.g, color.b], i * 3);
      sizes[i] = hub ? 13 : 5;
    });

    nodeGeometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    nodeGeometry.setAttribute("size", new THREE.BufferAttribute(sizes, 1));

    // Round points with per-vertex size, so hubs read as hospitals
    const nodeMaterial = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      uniforms: { uScale: { value: host.clientHeight * 0.5 } },
      vertexShader: `
        attribute float size;
        varying vec3 vColor;
        uniform float uScale;
        void main() {
          vColor = color;
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          gl_PointSize = size * (uScale / -mv.z) * 0.012;
          gl_Position = projectionMatrix * mv;
        }
      `,
      fragmentShader: `
        varying vec3 vColor;
        void main() {
          float d = length(gl_PointCoord - vec2(0.5));
          if (d > 0.5) discard;
          gl_FragColor = vec4(vColor, smoothstep(0.5, 0.42, d) * 0.95);
        }
      `,
      vertexColors: true,
    });

    const nodes = new THREE.Points(nodeGeometry, nodeMaterial);
    group.add(nodes);

    /* Links -------------------------------------------------------------- */
    const linkPositions: number[] = [];
    const threshold = LINK_DISTANCE * RADIUS * 2;

    for (let i = 0; i < points.length; i++) {
      for (let j = i + 1; j < points.length; j++) {
        if (points[i].distanceTo(points[j]) < threshold) {
          linkPositions.push(...points[i].toArray(), ...points[j].toArray());
        }
      }
    }

    const linkGeometry = new THREE.BufferGeometry();
    linkGeometry.setAttribute("position", new THREE.Float32BufferAttribute(linkPositions, 3));
    const linkMaterial = new THREE.LineBasicMaterial({
      color: ACCENT,
      transparent: true,
      opacity: 0.17,
    });
    const links = new THREE.LineSegments(linkGeometry, linkMaterial);
    group.add(links);

    /* Pointer parallax ---------------------------------------------------- */
    const pointer = { x: 0, y: 0 };
    const target = { x: 0, y: 0 };

    const onPointerMove = (e: PointerEvent) => {
      const rect = host.getBoundingClientRect();
      target.x = ((e.clientX - rect.left) / rect.width - 0.5) * 2;
      target.y = ((e.clientY - rect.top) / rect.height - 0.5) * 2;
    };
    const onPointerLeave = () => {
      target.x = 0;
      target.y = 0;
    };

    if (!reduceMotion) {
      window.addEventListener("pointermove", onPointerMove, { passive: true });
      host.addEventListener("pointerleave", onPointerLeave);
    }

    /* Loop ---------------------------------------------------------------- */
    let frame = 0;
    const clock = new THREE.Clock();

    const render = () => {
      const dt = clock.getDelta();

      if (!reduceMotion) {
        group.rotation.y += dt * 0.12;
        pointer.x += (target.x - pointer.x) * 0.045;
        pointer.y += (target.y - pointer.y) * 0.045;
        group.rotation.x = pointer.y * 0.26;
        camera.position.x = pointer.x * 0.5;
        camera.lookAt(0, 0, 0);
      }

      renderer.render(scene, camera);
      frame = requestAnimationFrame(render);
    };
    render();

    /* Resize --------------------------------------------------------------- */
    const resize = () => {
      const { clientWidth: w, clientHeight: h } = host;
      if (!w || !h) return;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h, false);
      nodeMaterial.uniforms.uScale.value = h * 0.5;
    };
    const observer = new ResizeObserver(resize);
    observer.observe(host);

    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      window.removeEventListener("pointermove", onPointerMove);
      host.removeEventListener("pointerleave", onPointerLeave);

      nodeGeometry.dispose();
      nodeMaterial.dispose();
      linkGeometry.dispose();
      linkMaterial.dispose();
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, []);

  if (failed) return null;

  return <div ref={hostRef} className={className} aria-hidden />;
}
