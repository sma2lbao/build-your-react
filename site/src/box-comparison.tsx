import { useLayoutEffect, useState, useRef } from "react";

function BoxComparison() {
  const [height, setHeight] = useState(0);
  const refLayoutEffect = useRef<HTMLDivElement | null>(null);

  useLayoutEffect(() => {
    if (refLayoutEffect.current) {
      setHeight(refLayoutEffect.current.offsetWidth);
    }
  }, []);

  return <div ref={refLayoutEffect}>测试{height}</div>;
}

export default BoxComparison;
