import { createContext, useContext } from 'react'

/**
 * The stable id of the section a component is rendered within. `ResizablePane`
 * supplies it so the generic `Section` wrapper can read/write its own per-profile
 * layout state (collapsed / height) without every panel having to thread an id.
 */
export const SectionIdContext = createContext<string | null>(null)

export function useSectionId(): string | null {
  return useContext(SectionIdContext)
}
