import { invoke } from "@tauri-apps/api/core";
import { useCallback, useEffect, useState } from "react";

interface UseWayfernTermsReturn {
  termsAccepted: boolean | null;
  isLoading: boolean;
  checkTerms: () => Promise<void>;
}

interface UseWayfernTermsOptions {
  enabled?: boolean;
}

export function useWayfernTerms(
  options: UseWayfernTermsOptions = {},
): UseWayfernTermsReturn {
  const { enabled = true } = options;
  const [termsAccepted, setTermsAccepted] = useState<boolean | null>(null);
  const [isLoading, setIsLoading] = useState(enabled);

  const checkTerms = useCallback(async () => {
    try {
      const [accepted, downloaded] = await Promise.all([
        invoke<boolean>("check_wayfern_terms_accepted"),
        invoke<boolean>("check_wayfern_downloaded"),
      ]);
      // Only require terms when Wayfern is downloaded and terms not accepted
      if (!downloaded) {
        setTermsAccepted(true);
      } else {
        setTermsAccepted(accepted);
      }
    } catch (error) {
      console.error("Failed to check terms acceptance:", error);
      setTermsAccepted(false);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!enabled) {
      setIsLoading(false);
      return;
    }
    void checkTerms();
  }, [checkTerms, enabled]);

  return {
    termsAccepted,
    isLoading,
    checkTerms,
  };
}
