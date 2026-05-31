import React from 'react'

interface Props {
  title: string
  children: React.ReactNode
  right?: React.ReactNode
  /** Visually grey out the body (e.g. when the section is toggled off). */
  dim?: boolean
}

export function Section({ title, children, right, dim = false }: Props): JSX.Element {
  return (
    <section className="section">
      <header className="section__head">
        <h2 className="section__title">{title}</h2>
        {right}
      </header>
      <div className={`section__body${dim ? ' section__body--off' : ''}`}>{children}</div>
    </section>
  )
}
