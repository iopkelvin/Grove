import { useState } from "react";
import MenuPanel from "./MenuPanel";

export default function MenuIcon() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <button
        className="menu-icon"
        aria-label="Open menu"
        onClick={() => setIsOpen(true)}
      >
        <span></span>
        <span></span>
        <span></span>
      </button>
      <MenuPanel isOpen={isOpen} onClose={() => setIsOpen(false)} />
    </>
  );
}