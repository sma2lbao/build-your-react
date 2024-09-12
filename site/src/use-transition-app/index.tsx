import * as React from "react";
import TabButton from "./tab-button";
import AboutTab from "./about-tab";
import PostsTab from "./posts-tab";
import ContactTab from "./contact-tab";

export default function TabContainer() {
  const [tab, setTab] = React.useState("about");

  const handleClick = (tab: string) => {
    setTab(tab);
  };

  return (
    <div>
      <TabButton
        isActive={tab === "about"}
        onClick={() => handleClick("about")}
      >
        About
      </TabButton>
      <TabButton
        isActive={tab === "posts"}
        onClick={() => handleClick("posts")}
      >
        Posts (slow)
      </TabButton>
      <TabButton
        isActive={tab === "contact"}
        onClick={() => handleClick("contact")}
      >
        Contact
      </TabButton>
      <hr />
      {tab === "about" && <AboutTab />}
      {tab === "posts" && <PostsTab />}
      {tab === "contact" && <ContactTab />}
    </div>
  );
}
