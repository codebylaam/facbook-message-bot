import { Link } from "@tanstack/react-router";
import type { CSSProperties, ReactNode } from "react";

type RouterLinkProps = {
  href?: string;
  className?: string;
  style?: CSSProperties;
  children?: ReactNode;
};

export function RouterLink({ href, className, style, children }: RouterLinkProps) {
  return (
    <Link to={(href ?? "/") as never} className={className} style={style}>
      {children}
    </Link>
  );
}
