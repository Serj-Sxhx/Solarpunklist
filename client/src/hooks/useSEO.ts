import { useEffect } from "react";

interface SEOProps {
  title: string;
  description?: string;
  ogTitle?: string;
  ogDescription?: string;
  ogImage?: string;
  canonicalPath?: string;
}

export function useSEO({ title, description, ogTitle, ogDescription, ogImage, canonicalPath }: SEOProps) {
  useEffect(() => {
    document.title = title;

    const setMeta = (selector: string, content: string) => {
      let el = document.querySelector(selector) as HTMLMetaElement | null;
      if (el) {
        el.setAttribute("content", content);
      }
    };

    if (description) {
      setMeta('meta[name="description"]', description);
    }
    if (ogTitle) {
      setMeta('meta[property="og:title"]', ogTitle);
    }
    if (ogDescription) {
      setMeta('meta[property="og:description"]', ogDescription);
    }
    if (ogImage) {
      let ogImgEl = document.querySelector('meta[property="og:image"]') as HTMLMetaElement | null;
      if (!ogImgEl) {
        ogImgEl = document.createElement("meta");
        ogImgEl.setAttribute("property", "og:image");
        document.head.appendChild(ogImgEl);
      }
      ogImgEl.setAttribute("content", ogImage);
    }

    return () => {
      document.title = "SolarpunkList - Directory of Regenerative Communities & Ecovillages";
    };
  }, [title, description, ogTitle, ogDescription, ogImage, canonicalPath]);
}
