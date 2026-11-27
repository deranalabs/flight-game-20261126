// Puts the world together for one sortie: renderer, the terrain (built once), sky, sea,
// clouds, island props, lights and fog for the mission's time and weather, the Tern
// model, mission markers and weather effects.

import * as THREE from 'three';
import { buildTerrainMesh, buildCraterGlow } from '../terrain/terrainMesh.js';
import { buildSky, buildClouds, buildWater } from './skyAndWater.js';
import { buildIslandProps } from './islandProps.js';
import { buildHarbourLife } from './harbourLife.js';
import { buildSeaplane } from '../aircraft/seaplaneModel.js';
import { makeMarkerLayer } from './missionMarkers.js';
import { makeWeatherEffects } from './weatherEffects.js';
import { timeOf } from './timeOfDay.js';
import { WEATHER } from '../flight/windField.js';

export function makeRenderer(canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  return renderer;
}

let terrain = null;
let crater = null;

/** A fresh scene for a time of day and weather; the terrain mesh is shared. */
export function buildWorld(timeId, weatherId, seed = 1) {
  const time = timeOf(timeId);
  const weather = WEATHER[weatherId] ?? WEATHER.calm;
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(time.fog);
  const fogFar = Math.min(weather.visibility, 16000);
  scene.fog = new THREE.Fog(time.fog, fogFar * 0.25, fogFar);
  if (!terrain) { terrain = buildTerrainMesh(); crater = buildCraterGlow(); }
  scene.add(terrain, crater);
  const sky = buildSky(time);
  scene.add(sky);
  const water = buildWater(time);
  scene.add(water);
  scene.add(buildClouds(time, weatherId, seed + 2));
  const props = buildIslandProps(time, seed);
  scene.add(props);
  const life = buildHarbourLife(time);
  scene.add(life);

  const hemi = new THREE.HemisphereLight(time.hemiSky, time.hemiGround, time.hemiIntensity);
  const sun = new THREE.DirectionalLight(time.sun, time.sunIntensity);
  sun.position.set(...time.sunDir).multiplyScalar(5000);
  scene.add(hemi, sun);
  if (time.rimFill) {
    // a warm fill from the side away from a low sun, so faces turned from it are not black
    const fill = new THREE.DirectionalLight(time.sun, time.rimFill);
    fill.position.set(-time.sunDir[0], 0.6, -time.sunDir[2]).multiplyScalar(5000);
    scene.add(fill);
  }
  crater.children[1].intensity = time.windows > 0.6 ? 9e5 : 2e5;

  const plane = buildSeaplane();
  scene.add(plane);
  if (time.windows > 0.6) {
    // after dark the cabin and nav lights wash the airframe so the Tern still reads
    const wash = new THREE.PointLight(0xffe2b0, 90, 30, 1.6);
    wash.position.set(0, 4, 2);
    plane.add(wash);
  }
  const markers = makeMarkerLayer(scene, time.windows > 0.6);
  const effects = makeWeatherEffects(scene, weather, time);
  return { scene, sky, water, props, life, plane, markers, effects, time, weather, sun };
}
