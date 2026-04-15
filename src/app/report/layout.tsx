import type { ReactNode } from "react";

type ReportLayoutProps = {
  children: ReactNode;
};

export default function ReportLayout({ children }: ReportLayoutProps) {
  return <>{children}</>;
}
