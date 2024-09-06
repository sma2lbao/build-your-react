import { unstable_Activity as Activity, useState } from "react";

const ActivityApp = () => {
  const [open, setOpen] = useState(false);

  const handleToggle = () => {
    setOpen(!open);
  };

  return (
    <div>
      <Activity mode={open ? "visible" : "hidden"}>
        <div>测试</div>
      </Activity>
      <div onClick={handleToggle}>底部</div>
    </div>
  );
};

export default ActivityApp;
