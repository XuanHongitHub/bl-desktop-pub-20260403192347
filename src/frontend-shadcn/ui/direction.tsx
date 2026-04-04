"use client"

import * as React from "react"
import { Direction } from "radix-ui"

type DirectionProviderProps = Omit<
  React.ComponentProps<typeof Direction.DirectionProvider>,
  "dir"
> & {
  dir?: React.ComponentProps<typeof Direction.DirectionProvider>["dir"]
  direction?: React.ComponentProps<typeof Direction.DirectionProvider>["dir"]
}

function DirectionProvider({
  dir,
  direction,
  children,
  ...props
}: DirectionProviderProps) {
  return (
    <Direction.DirectionProvider dir={direction ?? dir ?? "ltr"} {...props}>
      {children}
    </Direction.DirectionProvider>
  )
}

const useDirection = Direction.useDirection

export { DirectionProvider, useDirection }
