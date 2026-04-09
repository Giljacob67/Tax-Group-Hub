import React, { createContext, useContext, useEffect, useState } from "react";

interface BrandingData {
  companyName: string;
  logoStorageKey: string | null;
  primaryColor: string;
}

interface BrandingContextType {
  branding: BrandingData;
  isLoading: boolean;
}

const BrandingContext = createContext<BrandingContextType | undefined>(undefined);

export const BrandingProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [branding, setBranding] = useState<BrandingData>({
    companyName: "Tax Group Hub",
    logoStorageKey: null,
    primaryColor: "#3b82f6",
  });
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function resolveBranding() {
      try {
        const hostname = window.location.hostname;
        const res = await fetch(`${import.meta.env.VITE_API_URL || ""}/api/branding/resolve?domain=${hostname}`);
        if (res.ok) {
          const data = await res.json();
          setBranding({
            companyName: data.companyName,
            logoStorageKey: data.logoStorageKey,
            primaryColor: data.primaryColor || "#3b82f6",
          });

          // Inject CSS Variable for Tailwind (Phase 10)
          if (data.primaryColor) {
            document.documentElement.style.setProperty("--primary-color", data.primaryColor);
            // Optionally set absolute primary for older tailwind plugins if needed
            document.documentElement.style.setProperty("--primary", data.primaryColor);
          }
        }
      } catch (err) {
        console.error("Failed to resolve branding", err);
      } finally {
        setIsLoading(false);
      }
    }

    resolveBranding();
  }, []);

  return (
    <BrandingContext.Provider value={{ branding, isLoading }}>
      {children}
    </BrandingContext.Provider>
  );
};

export const useBranding = () => {
  const context = useContext(BrandingContext);
  if (!context) throw new Error("useBranding must be used within BrandingProvider");
  return context;
};
