import { useEffect } from "react";

export function useHotkeys(bindings) {
  useEffect(() => {
    const handler = (event) => {
      if (event.repeat) return;
      const binding = bindings.find((candidate) => candidate.match(event));
      if (!binding) return;
      if (binding.preventDefault) {
        event.preventDefault();
      }
      binding.run();
    };

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [bindings]);
}
