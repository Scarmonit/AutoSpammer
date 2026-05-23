import React from 'react'

interface Props {
  title: string
  children: React.ReactNode
  right?: React.ReactNode
}

export function Section({ title, children, right }: Props): JSX.Element {
  return (
    <section className="section">
      <header className="section__head">
        <h2 className="section__title">{title}</h2>
        {right}
      </header>
      <div className="section__body">{children}</div>
    </section>
  )
}
