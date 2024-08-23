import { useState } from "react";

function BoxComparison() {
  const [show, setShow] = useState(false);

  const handleClick = () => {
    console.log("join", show);
    // bug: 事件触发的优先级有bug。暂时用 setTimeout 代替
    setShow(!show);
  };

  return (
    <div onClick={handleClick}>{show ? <div>是</div> : <div>否</div>}</div>
  );
}

export default BoxComparison;
