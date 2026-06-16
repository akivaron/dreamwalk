import type { World } from "../types";

export function Atmosphere({ world }: { world: World }) {
  return (
    <>
      <fogExp2 attach="fog" args={[world.colors.fog, world.fogDensity]} />
      <hemisphereLight
        args={[world.colors.skyTop, world.colors.groundDeep, world.ambientIntensity]}
      />
      <ambientLight intensity={world.ambientIntensity * 0.4} color={world.colors.ambient} />
      <directionalLight
        position={world.sunPosition}
        intensity={world.lightIntensity}
        color={world.colors.light}
      />
    </>
  );
}
