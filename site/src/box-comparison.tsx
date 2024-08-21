import { useLayoutEffect, useState, useRef } from "react";

function BoxComparison() {
  const [height, setHeight] = useState(0);
  const refLayoutEffect = useRef<HTMLDivElement | null>(null);

  useLayoutEffect(() => {
    if (refLayoutEffect.current) {
      setHeight(refLayoutEffect.current.offsetWidth);
    }
  }, []);

  return (
    <div>
      <div ref={refLayoutEffect}>测试</div>
      <div>{height}</div>
    </div>
  );
}

export default BoxComparison;
