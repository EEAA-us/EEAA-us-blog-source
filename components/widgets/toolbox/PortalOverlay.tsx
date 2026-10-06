"use client";

import { createPortal } from "react-dom";

export default function PortalOverlay({ children }: { children: React.ReactNode }) {
  return createPortal(
    <div data-toolbox-portal onPointerDown={(event) => event.stopPropagation()}>
      {children}
    </div>,
    document.body
  );
}
