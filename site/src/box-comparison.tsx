import { useState } from "react";

function BoxComparison() {
  const [show, setShow] = useState(false);

  window.setShow = setShow;

  return <div>{show ? <div>是</div> : <div>否</div>}</div>;
}

export default BoxComparison;
