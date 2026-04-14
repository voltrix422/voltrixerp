import GradualBlur from "./gradual-blur"

interface Props {
  children: React.ReactNode
  className?: string
  id?: string
}

export default function SectionBlur({ children, className = "", id }: Props) {
  return (
    <div id={id} className={`relative overflow-hidden ${className}`}>
      {children}
      <GradualBlur position="bottom" height="6rem" strength={1.5} divCount={6} curve="bezier" exponential opacity={1} zIndex={5} />
    </div>
  )
}
