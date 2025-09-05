import { useState, useEffect } from "react"

const MOBILE_BREAKPOINT = 768

export function useIsMobile() {
  const [isMobile, setIsMobile] = useState<boolean>(false)

  useEffect(() => {
    const checkIsMobile = () => {
      setIsMobile(window.innerWidth < MOBILE_BREAKPOINT)
    }
    checkIsMobile(); // Check on mount
    
    window.addEventListener("resize", checkIsMobile);
    return () => window.removeEventListener("resize", checkIsMobile);
  }, [])

  return isMobile
}
