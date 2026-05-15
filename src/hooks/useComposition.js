import { useContext } from 'react'
import { CompositionContext } from '../context/CompositionContext'

export function useComposition() {
  const ctx = useContext(CompositionContext)
  if (!ctx) throw new Error('useComposition must be used inside CompositionProvider')
  return ctx
}
