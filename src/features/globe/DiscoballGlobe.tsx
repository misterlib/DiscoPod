import { Html, OrbitControls } from "@react-three/drei";
import { Canvas, useFrame } from "@react-three/fiber";
import { memo, useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";

import type { GlobeShowNode } from "../types";

const DISC_RADIUS = 1.1;

// In-memory texture cache to prevent duplicate fetches & flash of untextured planes
const textureCache = new Map<string, THREE.Texture>();
const textureLoader = new THREE.TextureLoader();
textureLoader.setCrossOrigin("anonymous");

const convexSiteUrl = (import.meta.env.VITE_CONVEX_SITE_URL as string) || "";

/**
 * Returns a CORS-friendly and performant image URL for WebGL textures.
 * Uses wsrv.nl to resize to 300x300, convert to jpg, and add Access-Control-Allow-Origin: *
 * which prevents CORS errors and GPU memory exhaustion on 3D discoball tiles.
 */
function getCorsImageUrl(rawUrl: string): string {
  if (!rawUrl) return "";
  const trimmed = rawUrl.trim();
  if (
    trimmed.startsWith("data:") ||
    trimmed.startsWith("blob:") ||
    trimmed.startsWith("/") ||
    trimmed.includes("wsrv.nl") ||
    trimmed.includes("/image-proxy")
  ) {
    return trimmed;
  }
  return `https://wsrv.nl/?url=${encodeURIComponent(trimmed)}&w=300&h=300&fit=cover&output=jpg`;
}

function loadCoverTexture(rawUrl: string, onLoaded: (tex: THREE.Texture) => void) {
  if (!rawUrl) return;
  const cached = textureCache.get(rawUrl);
  if (cached) {
    onLoaded(cached);
    return;
  }

  const primaryProxyUrl = getCorsImageUrl(rawUrl);
  const backendProxyUrl = convexSiteUrl
    ? `${convexSiteUrl}/image-proxy?url=${encodeURIComponent(rawUrl)}`
    : "";

  const candidateUrls: string[] = Array.from(
    new Set([primaryProxyUrl, backendProxyUrl, rawUrl].filter((u): u is string => Boolean(u))),
  );

  if (candidateUrls.length === 0) return;

  const tryLoad = (targetUrl: string, candidateIndex: number) => {
    textureLoader.load(
      targetUrl,
      (tex) => {
        tex.colorSpace = THREE.SRGBColorSpace;
        tex.minFilter = THREE.LinearMipmapLinearFilter;
        tex.generateMipmaps = true;
        tex.needsUpdate = true;
        textureCache.set(rawUrl, tex);
        onLoaded(tex);
      },
      undefined,
      (err) => {
        console.warn(`[DiscoballGlobe] Texture load warning for "${targetUrl}":`, err);
        const nextIndex = candidateIndex + 1;
        const nextUrl = candidateUrls[nextIndex];
        if (nextUrl) {
          tryLoad(nextUrl, nextIndex);
        }
      },
    );
  };

  const firstUrl = candidateUrls[0];
  if (firstUrl) {
    tryLoad(firstUrl, 0);
  }
}

// Generate fallback initial/monogram canvas texture for podcasts without or failed cover art
function createFallbackTexture(title: string): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext("2d");
  if (ctx) {
    // Metallic discoball facet gradient
    const grad = ctx.createLinearGradient(0, 0, 256, 256);
    grad.addColorStop(0, "#f43f5e");
    grad.addColorStop(0.5, "#1e293b");
    grad.addColorStop(1, "#be123c");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 256, 256);

    // Subtle grid lines for mirror facet
    ctx.strokeStyle = "rgba(255, 255, 255, 0.25)";
    ctx.lineWidth = 4;
    ctx.strokeRect(4, 4, 248, 248);

    // Podcast monogram text
    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 96px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    const initials = (title || "DP")
      .split(/\s+/)
      .slice(0, 2)
      .map((w) => w[0]?.toUpperCase() ?? "")
      .join("");
    ctx.fillText(initials || "DP", 128, 128);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

interface TileProps {
  show: GlobeShowNode;
  normal: THREE.Vector3;
  baseWidth: number;
  isSelected: boolean;
  onSelect: (showId: string) => void;
  onHoverChange: (hovered: boolean) => void;
}

const CoverArtTile = memo(function CoverArtTile({
  show,
  normal,
  baseWidth,
  isSelected,
  onSelect,
  onHoverChange,
}: TileProps) {
  const groupRef = useRef<THREE.Group>(null);
  const matRef = useRef<THREE.MeshStandardMaterial>(null);
  const [hovered, setHovered] = useState(false);
  const [texture, setTexture] = useState<THREE.Texture | null>(null);

  // Load texture on mount or url change
  useEffect(() => {
    let mounted = true;
    loadCoverTexture(show.coverArtUrl, (tex) => {
      if (mounted) setTexture(tex);
    });
    return () => {
      mounted = false;
    };
  }, [show.coverArtUrl]);

  const fallbackTex = useMemo(
    () => createFallbackTexture(show.title),
    [show.title],
  );

  // Plane normal in geometry is +Z. Rotate mesh so +Z points outward along surface normal
  const quaternion = useMemo(() => {
    const q = new THREE.Quaternion();
    q.setFromUnitVectors(new THREE.Vector3(0, 0, 1), normal);
    return q;
  }, [normal]);

  // Animated radial lift and scale
  const currentDist = useRef(DISC_RADIUS);
  const currentScale = useRef(1);

  useFrame((_, delta) => {
    if (!groupRef.current) return;
    const dt = Math.min(delta, 0.05);

    // Target radial lift: subtle tactile bump out instead of huge pop
    const targetDist = hovered || isSelected ? DISC_RADIUS + 0.028 : DISC_RADIUS;
    // Target scale: refined 6% bump instead of aggressive 32% expansion
    const targetScale = hovered || isSelected ? 1.06 : 1.0;

    const lerpRate = Math.min(dt * 16, 1);
    currentDist.current += (targetDist - currentDist.current) * lerpRate;
    currentScale.current += (targetScale - currentScale.current) * lerpRate;

    // Position along radial normal
    groupRef.current.position.copy(normal).multiplyScalar(currentDist.current);
    groupRef.current.scale.setScalar(currentScale.current);
  });

  const activeTex = texture || fallbackTex;

  // Memoized edge outline geometry for sharp border highlight
  const edgeGeometry = useMemo(() => {
    const plane = new THREE.PlaneGeometry(baseWidth * 1.08, baseWidth * 1.08);
    return new THREE.EdgesGeometry(plane);
  }, [baseWidth]);

  // Ensure material updates when active texture changes
  useEffect(() => {
    if (matRef.current) {
      matRef.current.needsUpdate = true;
    }
  }, [activeTex]);

  return (
    <group
      ref={groupRef}
      quaternion={quaternion}
      position={[normal.x * DISC_RADIUS, normal.y * DISC_RADIUS, normal.z * DISC_RADIUS]}
    >
      {/* Edge Highlight Bezel / Backing Plate */}
      <mesh
        position={[0, 0, -0.003]}
        onPointerOver={(e) => {
          e.stopPropagation();
          setHovered(true);
          onHoverChange(true);
          document.body.style.cursor = "pointer";
        }}
        onPointerOut={() => {
          setHovered(false);
          onHoverChange(false);
          document.body.style.cursor = "auto";
        }}
        onClick={(e) => {
          e.stopPropagation();
          onSelect(show.showId);
        }}
      >
        <planeGeometry args={[baseWidth * 1.08, baseWidth * 1.08]} />
        <meshStandardMaterial
          color={
            isSelected
              ? (show.isClaimed ? "#34d399" : "#fb7185")
              : hovered
                ? (show.isClaimed ? "#6ee7b7" : "#f43f5e")
                : "#232834"
          }
          roughness={0.25}
          metalness={0.85}
          emissive={
            isSelected
              ? (show.isClaimed ? "#059669" : "#e11d48")
              : hovered
                ? (show.isClaimed ? "#047857" : "#be123c")
                : "#0a0e14"
          }
          emissiveIntensity={isSelected ? 1.2 : hovered ? 0.9 : 0.05}
        />
      </mesh>

      {/* Crisp Glowing Edge Highlight Outline */}
      <lineSegments geometry={edgeGeometry} position={[0, 0, -0.001]}>
        <lineBasicMaterial
          color={
            isSelected
              ? (show.isClaimed ? "#34d399" : "#fda4af")
              : hovered
                ? (show.isClaimed ? "#a7f3d0" : "#fecdd3")
                : "#475569"
          }
          transparent
          opacity={isSelected ? 1.0 : hovered ? 0.95 : 0.3}
        />
      </lineSegments>

      {/* Main Cover Art Tile */}
      <mesh
        onPointerOver={(e) => {
          e.stopPropagation();
          setHovered(true);
          onHoverChange(true);
          document.body.style.cursor = "pointer";
        }}
        onPointerOut={() => {
          setHovered(false);
          onHoverChange(false);
          document.body.style.cursor = "auto";
        }}
        onClick={(e) => {
          e.stopPropagation();
          onSelect(show.showId);
        }}
      >
        <planeGeometry args={[baseWidth, baseWidth]} />
        <meshStandardMaterial
          ref={matRef}
          key={activeTex.uuid}
          map={activeTex}
          roughness={0.35}
          metalness={0.15}
          emissive={show.isClaimed ? "#34d399" : "#ffffff"}
          emissiveIntensity={isSelected ? 0.2 : hovered ? 0.12 : 0.02}
        />
      </mesh>

      {/* Hover Floating Title Pill */}
      {hovered && (
        <Html
          position={[0, baseWidth * 0.72, 0.04]}
          center
          style={{ pointerEvents: "none", zIndex: 50 }}
        >
          <div className="pointer-events-none select-none">
            <div className="flex items-center gap-1.5 rounded-full bg-disco-dark/95 px-2.5 py-0.5 text-[11px] leading-tight font-bold text-disco-cream shadow-xl border border-white/20 backdrop-blur-md max-w-[190px]">
              <span className="truncate">{show.title}</span>
              {show.isClaimed && (
                <span className="shrink-0 rounded bg-emerald-500/20 px-1 py-0.5 text-[8px] font-black text-emerald-400 border border-emerald-400/40">
                  VERIFIED
                </span>
              )}
            </div>
          </div>
        </Html>
      )}
    </group>
  );
});

interface DiscoballGlobeInnerProps {
  shows: GlobeShowNode[];
  selectedShowId: string | null;
  onSelectShow: (showId: string) => void;
}

function DiscoballGlobeInner({
  shows,
  selectedShowId,
  onSelectShow,
}: DiscoballGlobeInnerProps) {
  const discGroupRef = useRef<THREE.Group>(null);
  const isHoveringTile = useRef(false);

  // Mouse coordinate tracker for organic starting inertia
  const mouseRef = useRef({ x: 0.25, y: 0.1 });
  const velRef = useRef({ x: 0.015, y: 0.045 });

  useEffect(() => {
    function handlePointerMove(e: PointerEvent) {
      const nx = (e.clientX / window.innerWidth) * 2 - 1;
      const ny = -((e.clientY / window.innerHeight) * 2 - 1);
      mouseRef.current.x = nx;
      mouseRef.current.y = ny;
    }
    window.addEventListener("pointermove", handlePointerMove, { passive: true });
    return () => window.removeEventListener("pointermove", handlePointerMove);
  }, []);

  // Compute dynamic tile size based on show count N and available sphere area:
  // Evaluates available surface area on sphere of DISC_RADIUS and total show count N.
  // As N grows, tiles scale smoothly to fill out the globe with tighter, cleaner spacing.
  const tileBaseWidth = useMemo(() => {
    const count = shows.length;
    if (count === 0) return 0.20;

    // Approximate neighbor arc distance on Fibonacci sphere: 2 * R * sqrt(PI / N)
    const neighborDist = (2 * DISC_RADIUS * Math.sqrt(Math.PI)) / Math.sqrt(count);

    // Target fill ratio: ~72% leaves a tight, clean facet seam between tiles for the mirror ball to shimmer
    const calculatedWidth = neighborDist * 0.72;

    // Cap maximum tile width at 0.28 at lower counts, and minimum tile width at 0.05 at high counts
    return Math.max(0.05, Math.min(0.28, calculatedWidth));
  }, [shows.length]);

  // Compute Fibonacci sphere lattice positions for all shows across the full globe
  const showTiles = useMemo(() => {
    const N = Math.max(shows.length, 1);
    const phi = (1 + Math.sqrt(5)) / 2;
    const goldenAngle = 2 * Math.PI * (1 - 1 / phi);

    return shows.map((show, i) => {
      // Uniform equal-area spherical Fibonacci distribution spanning the entire sphere from pole to pole
      const y = 1 - (i * 2 + 1) / N;
      const radiusAtY = Math.sqrt(Math.max(0, 1 - y * y));
      const theta = goldenAngle * i;

      const x = Math.cos(theta) * radiusAtY;
      const z = Math.sin(theta) * radiusAtY;
      const normal = new THREE.Vector3(x, y, z).normalize();

      return {
        show,
        normal,
      };
    });
  }, [shows]);

  useFrame((_, delta) => {
    if (!discGroupRef.current) return;
    const dt = Math.min(delta, 0.05);

    // If user is hovering an image tile, slow down the auto-drift so it is easy to click
    const speedDamping = isHoveringTile.current ? 0.15 : 1.0;

    const targetVelY = mouseRef.current.x * 0.12 * speedDamping;
    const targetVelX = -mouseRef.current.y * 0.07 * speedDamping;

    const lerpFactor = Math.min(dt * 2.0, 1);
    velRef.current.y += (targetVelY - velRef.current.y) * lerpFactor;
    velRef.current.x += (targetVelX - velRef.current.x) * lerpFactor;

    discGroupRef.current.rotation.y += velRef.current.y * dt;
    discGroupRef.current.rotation.x += velRef.current.x * dt;
  });

  return (
    <group ref={discGroupRef}>
      {/* Dark core sphere so lines don't get cluttered by opposite side */}
      <mesh>
        <sphereGeometry args={[DISC_RADIUS * 0.985, 32, 32]} />
        <meshBasicMaterial color="#141113" />
      </mesh>
      {/* Faceted Mirror Discoball Surface */}
      <mesh>
        <sphereGeometry args={[DISC_RADIUS * 0.996, 32, 24]} />
        <meshStandardMaterial
          color="#d5d0c5"
          roughness={0.18}
          metalness={0.88}
          flatShading={true}
          emissive="#1b2028"
          emissiveIntensity={0.2}
        />
      </mesh>

      {/* Main wireframe discoball sphere (mirror facets) */}
      <mesh>
        <sphereGeometry args={[DISC_RADIUS, 32, 24]} />
        <meshStandardMaterial
          color="#dad1bd"
          wireframe
          roughness={0.3}
          metalness={0.7}
          emissive="#2b3445"
          emissiveIntensity={0.3}
        />
      </mesh>

      {/* Secondary facet grid rings for authentic discoball sparkle */}
      <mesh rotation={[0, 0, Math.PI / 4]}>
        <sphereGeometry args={[DISC_RADIUS * 1.002, 18, 18]} />
        <meshStandardMaterial
          color="#ba805a"
          wireframe
          transparent
          opacity={0.25}
        />
      </mesh>

      {/* Podcast Cover Art Tiles on Sphere Surface */}
      {showTiles.map(({ show, normal }) => (
        <CoverArtTile
          key={show.showId}
          show={show}
          normal={normal}
          baseWidth={tileBaseWidth}
          isSelected={selectedShowId === show.showId}
          onSelect={onSelectShow}
          onHoverChange={(hov) => {
            isHoveringTile.current = hov;
          }}
        />
      ))}
    </group>
  );
}

export interface DiscoballGlobeProps {
  shows: GlobeShowNode[];
  selectedShowId: string | null;
  onSelectShow: (showId: string) => void;
  className?: string;
  enableControls?: boolean;
}

export function DiscoballGlobe({
  shows,
  selectedShowId,
  onSelectShow,
  className = "",
  enableControls = true,
}: DiscoballGlobeProps) {
  return (
    <div className={`relative select-none ${className}`}>
      <Canvas
        camera={{ position: [0, 0, 2.7], fov: 48 }}
        gl={{ alpha: true, antialias: true }}
      >
        <ambientLight intensity={1.6} />
        <directionalLight position={[4, 5, 5]} intensity={2.4} color="#dad1bd" />
        <pointLight position={[-4, -3, 3]} intensity={1.8} color="#b97179" />
        <pointLight position={[0, 4, -2]} intensity={1.2} color="#38bdf8" />

        <DiscoballGlobeInner
          shows={shows}
          selectedShowId={selectedShowId}
          onSelectShow={onSelectShow}
        />

        {enableControls && (
          <OrbitControls
            enablePan={false}
            enableZoom={false}
            rotateSpeed={0.8}
            dampingFactor={0.08}
          />
        )}
      </Canvas>
    </div>
  );
}
