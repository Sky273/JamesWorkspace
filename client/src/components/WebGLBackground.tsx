/**
 * WebGLBackground - Animated 3D background with wireframe icosahedron and floating particles
 * Creates a subtle tech ambiance without affecting content readability
 */

import { useEffect, useRef } from 'react';
import * as THREE from 'three';

interface WebGLBackgroundProps {
  className?: string;
}

export default function WebGLBackground({ className = '' }: WebGLBackgroundProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const icosahedronRef = useRef<THREE.LineSegments | null>(null);
  const particlesRef = useRef<THREE.Points | null>(null);
  const frameIdRef = useRef<number>(0);

  useEffect(() => {
    if (!containerRef.current) return;

    const container = containerRef.current;
    const width = container.clientWidth;
    const height = container.clientHeight;

    // Scene setup
    const scene = new THREE.Scene();
    sceneRef.current = scene;

    // Camera setup
    const camera = new THREE.PerspectiveCamera(60, width / height, 0.1, 1000);
    camera.position.z = 5;
    cameraRef.current = camera;

    // Renderer setup
    const renderer = new THREE.WebGLRenderer({ 
      antialias: true, 
      alpha: true,
      powerPreference: 'low-power'
    });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setClearColor(0x000000, 0);
    container.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // Get primary color from CSS variables or use default indigo
    const primaryColor = getComputedStyle(document.documentElement)
      .getPropertyValue('--color-primary-500')?.trim() || '#4f46e5';

    // Create wireframe icosahedron - larger size
    const icosahedronGeometry = new THREE.IcosahedronGeometry(3.5, 1);
    const wireframeGeometry = new THREE.WireframeGeometry(icosahedronGeometry);
    const icosahedronMaterial = new THREE.LineBasicMaterial({ 
      color: primaryColor,
      transparent: true,
      opacity: 0.18
    });
    const icosahedron = new THREE.LineSegments(wireframeGeometry, icosahedronMaterial);
    scene.add(icosahedron);
    icosahedronRef.current = icosahedron;

    // Create floating particles - more particles, larger spread
    const particleCount = 250;
    const particleGeometry = new THREE.BufferGeometry();
    const positions = new Float32Array(particleCount * 3);
    const velocities = new Float32Array(particleCount * 3);

    for (let i = 0; i < particleCount; i++) {
      const i3 = i * 3;
      // Random positions in a larger sphere around the icosahedron
      const radius = 4 + Math.random() * 6;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      
      positions[i3] = radius * Math.sin(phi) * Math.cos(theta);
      positions[i3 + 1] = radius * Math.sin(phi) * Math.sin(theta);
      positions[i3 + 2] = radius * Math.cos(phi);

      // Random velocities for floating effect - increased speed for visible movement
      velocities[i3] = (Math.random() - 0.5) * 0.015;
      velocities[i3 + 1] = (Math.random() - 0.5) * 0.015;
      velocities[i3 + 2] = (Math.random() - 0.5) * 0.015;
    }

    particleGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    
    const particleMaterial = new THREE.PointsMaterial({
      color: primaryColor,
      size: 0.05,
      transparent: true,
      opacity: 0.5,
      sizeAttenuation: true
    });

    const particles = new THREE.Points(particleGeometry, particleMaterial);
    scene.add(particles);
    particlesRef.current = particles;

    // Store velocities for animation
    (particles as any).velocities = velocities;

    // Animation loop
    let time = 0;
    const animate = () => {
      time += 0.005;
      frameIdRef.current = requestAnimationFrame(animate);

      // Rotate icosahedron slowly
      if (icosahedronRef.current) {
        icosahedronRef.current.rotation.x += 0.001;
        icosahedronRef.current.rotation.y += 0.002;
      }

      // Animate particles floating with more visible movement
      if (particlesRef.current) {
        const positions = particlesRef.current.geometry.attributes.position.array as Float32Array;
        const vels = (particlesRef.current as any).velocities as Float32Array;

        for (let i = 0; i < particleCount; i++) {
          const i3 = i * 3;
          
          // Add floating motion with stronger wave effect
          positions[i3] += vels[i3] + Math.sin(time * 2 + i * 0.1) * 0.003;
          positions[i3 + 1] += vels[i3 + 1] + Math.cos(time * 1.5 + i * 0.15) * 0.003;
          positions[i3 + 2] += vels[i3 + 2] + Math.sin(time + i * 0.2) * 0.002;

          // Keep particles within bounds
          const distance = Math.sqrt(
            positions[i3] ** 2 + 
            positions[i3 + 1] ** 2 + 
            positions[i3 + 2] ** 2
          );

          if (distance > 12 || distance < 3) {
            // Reverse velocity when out of bounds
            vels[i3] *= -1;
            vels[i3 + 1] *= -1;
            vels[i3 + 2] *= -1;
          }
        }

        particlesRef.current.geometry.attributes.position.needsUpdate = true;
      }

      renderer.render(scene, camera);
    };

    animate();

    // Handle resize
    const handleResize = () => {
      if (!containerRef.current || !cameraRef.current || !rendererRef.current) return;
      
      const newWidth = containerRef.current.clientWidth;
      const newHeight = containerRef.current.clientHeight;

      cameraRef.current.aspect = newWidth / newHeight;
      cameraRef.current.updateProjectionMatrix();
      rendererRef.current.setSize(newWidth, newHeight);
    };

    window.addEventListener('resize', handleResize);

    // Cleanup
    return () => {
      window.removeEventListener('resize', handleResize);
      cancelAnimationFrame(frameIdRef.current);
      
      if (rendererRef.current && containerRef.current) {
        containerRef.current.removeChild(rendererRef.current.domElement);
        rendererRef.current.dispose();
      }

      if (icosahedronRef.current) {
        icosahedronRef.current.geometry.dispose();
        (icosahedronRef.current.material as THREE.Material).dispose();
      }

      if (particlesRef.current) {
        particlesRef.current.geometry.dispose();
        (particlesRef.current.material as THREE.Material).dispose();
      }
    };
  }, []);

  return (
    <div 
      ref={containerRef}
      className={`absolute inset-0 -z-10 overflow-hidden pointer-events-none ${className}`}
      aria-hidden="true"
    />
  );
}
