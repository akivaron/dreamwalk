import { useThree } from "@react-three/fiber";
import { useEffect } from "react";

export function ScreenshotHelper({ onReady }: { onReady: (fn: () => string) => void }) {
  const { gl } = useThree();
  useEffect(() => {
    onReady(() => gl.domElement.toDataURL("image/png"));
  }, [gl, onReady]);
  return null;
}
