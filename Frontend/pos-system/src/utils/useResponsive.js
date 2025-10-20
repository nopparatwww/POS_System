import { useEffect, useState } from 'react'

export default function useResponsive(breakpoint = 900){
  const [width, setWidth] = useState(typeof window !== 'undefined' ? window.innerWidth : 1200)
  const [height, setHeight] = useState(typeof window !== 'undefined' ? window.innerHeight : 800)
  const isBelow = (bp) => width < (bp ?? breakpoint)
  useEffect(() => {
    function onResize(){
      setWidth(window.innerWidth)
      setHeight(window.innerHeight)
    }
    onResize()
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])
  return { width, height, isBelow, isNarrow: isBelow(breakpoint) }
}
