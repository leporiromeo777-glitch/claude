# Technical feasibility: browser first-person open world (verified 2026-10-14)

## Recommended stack
- Engine: three.js r186 (0.186.1) with WebGPURenderer + TSL, automatic WebGL2 fallback. TypeScript + Vite (same toolchain as the previous game). Pin versions.
- Built into three r186: CSM shadows; post: GTAO, SSAO, Bloom, SSR, SSGI, TRAA, SMAA/FXAA, LUT, Godrays; SkyMesh, WaterMesh; LightProbeGrid; KTX2 + meshopt.
- Add-ons: @takram/three-atmosphere (physical sky), @three.ez/instanced-mesh (instancing + culling + LOD), three-mesh-bvh, recast-navigation + yuka (navmesh, NPC AI), @dgreenheck/ez-tree (procedural trees, MIT).
- Physics: Rapier (rapier3d-compat) KinematicCharacterController; runs in plain Node so gameplay can be unit-tested without a browser.
- Asset pipeline: Blender 5.2.2 via pip (bpy), Cycles on CPU (procedural rock + glTF + 512px render ≈ 4 s), gltf-transform meshopt, KTX2 textures. Poly Haven (997 HDRIs, 869 textures, 521 models, CC0) and ambientCG (2015 CC0 materials) APIs reachable from the container. Quaternius/Kenney CC0 reachable.
- Audio: Web Audio with HRTF positional audio, per-zone ambience layers, convolution reverb. Voices pre-rendered with Kokoro-82M TTS (Apache-2.0, 54 voices, runs on CPU at 0.44 real-time factor). Masked/robotic/radio-filtered voices turn TTS artifacts into style.
- Animation: Quaternius Universal Animation Library (CC0, 250+ humanoid clips, retargetable); procedural animation (IK legs, hovering, look-at, breathing). NO faces, NO lip-sync.
- Packaging: Electron (+ steamworks.js) for desktop/Steam; browser build for a free prologue. Mobile only as a heavily reduced stretch goal.
- Runner-up engine: Babylon.js 9 (more built-in, stable API). Godot web export rejected (WebGL2 compatibility renderer only, no volumetric fog). Bevy rejected.

## Techniques that work in the browser
- Terrain: chunked 16-bit heightmaps, LOD with skirts, splat map over 4–8 CC0 materials, triplanar on slopes; heightmaps/erosion generated offline.
- Vegetation: instancing with culling/LOD + billboard impostors; WebGPU compute grass.
- Water: planar-reflection lakes; SSR on high preset only. Underwater = fog colour + caustics, cheap.
- Sky & fog: physical atmosphere, height fog; volumetric light on high preset.
- Shadows: CSM 3 cascades + baked AO. GI: Cycles-baked lightmaps for interiors/ruins, light probes, HDRI outdoors.
- Streaming: one glTF per zone (meshopt + KTX2), worker decoding, precompiled shaders behind loading screens.

## Container facts
- Node 22, Python 3.13, 4 cores, 15 GB RAM, NO GPU.
- Headless Chromium renders WebGL2 via SwiftShader (~200–400 ms/frame for a 0.7M-triangle forest scene): screenshot/visual-regression tests are feasible; real-time FPS testing is NOT (needs a real laptop).
- WebGPU in headless works only with Chromium 156 (Playwright 1.64.1) + swiftshader flags.

## Budgets (integrated-GPU laptop, 60 fps target, dynamic resolution)
- 300–500 draw calls on WebGL2, 1–2M visible triangles incl. shadows, 0.5–1 GB GPU textures (KTX2), initial download <100 MB then stream per zone.

## What "semi-realistic" realistically means for us
- ACHIEVABLE: nature landscapes (scanned CC0 materials, physical sky, fog, day/night, weather), instanced forests and grass, lakes and rivers, ruins/rocks/buildings built procedurally in Blender, baked-GI interiors, robotic / masked / silhouette NPCs, animals, cinematic post-processing, underwater scenes, caves with flashlight lighting.
- HIGH PRESET ONLY: SSR, SSGI, volumetric light, Gaussian-splat backdrops.
- NOT ACHIEVABLE: realistic human faces, lip-sync, mocap-quality motion, crowds, realistic cloth and hair, Nanite/Lumen density, dynamic GI on integrated GPUs.
- Design consequence: few visible humans, seen at distance or masked/veiled/hooded, or presented through radio, letters, recordings, frozen tableaux, silhouettes, ghosts; creatures/robots/animals animate well with procedural animation. One coherent art direction ("stylised realism") chosen early; avoid mixing photoscans with stylised assets.

## Main risks
API drift of three WebGPU/TSL; no GPU in container (perf needs real hardware); content volume for 10–25 h without artists (lean on procedural generation + one art direction); memory/download size (zone streaming mandatory); shader compile hitches; mobile.
