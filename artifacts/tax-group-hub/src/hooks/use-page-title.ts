import { useEffect } from "react";

export function usePageTitle(title: string) {
  useEffect(() => {
    const prev = document.title;
    document.title = title ? `${title} | Tax Group AI Hub` : "Tax Group AI Hub";
    return () => {
      document.title = prev;
    };
  }, [title]);
}
