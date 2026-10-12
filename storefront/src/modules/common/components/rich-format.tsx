import { Fragment, ReactNode } from "react"

/** Like format(), but {placeholders} can be links or other elements. */
export function richFormat(template: string, nodes: Record<string, ReactNode>): ReactNode[] {
  return template.split(/(\{\w+\})/).map((part, i) => {
    const key = part.match(/^\{(\w+)\}$/)?.[1]
    return <Fragment key={i}>{key && key in nodes ? nodes[key] : part}</Fragment>
  })
}
