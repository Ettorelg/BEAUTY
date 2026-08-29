"use client";

import type { MouseEvent, ReactNode } from "react";

export function ConfirmSubmitButton({ children, message, className = "danger-button" }: { children: ReactNode; message: string; className?: string }) {
  function confirmSubmit(event: MouseEvent<HTMLButtonElement>) {
    if (!window.confirm(message)) event.preventDefault();
  }

  return <button className={className} onClick={confirmSubmit} type="submit">{children}</button>;
}
