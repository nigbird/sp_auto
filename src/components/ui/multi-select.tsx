"use client"

import * as React from "react"
import { X, Check, ChevronsUpDown } from "lucide-react"

import { cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"

export type MultiSelectOption = {
  value: string
  label: string
}

interface MultiSelectProps {
  options: MultiSelectOption[]
  selected: string[]
  onChange: (selected: string[]) => void
  className?: string
  placeholder?: string
  /**
   * Show at most this many chips and fold the rest into a "+N more" chip, so a
   * long selection keeps the field one line tall. All of them stay listed in
   * the dropdown and in the field's tooltip.
   */
  maxVisible?: number
}

export function MultiSelect({ options, selected, onChange, className, maxVisible, ...props }: MultiSelectProps) {
  const [open, setOpen] = React.useState(false)

  const handleSelect = (value: string) => {
    const newSelected = selected.includes(value)
      ? selected.filter((item) => item !== value)
      : [...selected, value]
    onChange(newSelected)
  }

  const handleUnselect = (value: string) => {
    onChange(selected.filter((s) => s !== value))
  }

  const labelOf = (value: string) => options.find(o => o.value === value)?.label ?? value
  const visible = maxVisible != null ? selected.slice(0, maxVisible) : selected
  const hidden = selected.length - visible.length

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
            <Button
                type="button"
                variant="outline"
                role="combobox"
                aria-expanded={open}
                title={selected.length > 0 ? selected.map(labelOf).join(", ") : undefined}
                className={cn("h-auto min-h-10 w-full justify-between gap-2 py-1.5 font-normal", className)}
            >
                <div className="flex min-w-0 flex-1 flex-wrap gap-1">
                    {selected.length > 0 ? (
                        <>
                        {visible.map((value) => (
                        <Badge
                            variant="secondary"
                            key={value}
                            className="max-w-full"
                            onClick={(e) => {
                                e.stopPropagation();
                                handleUnselect(value);
                            }}
                        >
                            <span className="truncate">{labelOf(value)}</span>
                            <X className="ml-1 h-3 w-3 shrink-0" />
                        </Badge>
                        ))}
                        {hidden > 0 && <Badge variant="outline" className="font-medium text-muted-foreground">+{hidden} more</Badge>}
                        </>
                    ) : (
                        <span className="truncate text-muted-foreground">{props.placeholder ?? "Select..."}</span>
                    )}
                </div>
                <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50" />
            </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] min-w-[16rem] p-0" align="start">
        <Command>
          <CommandInput placeholder="Search..." />
          <CommandList>
            <CommandEmpty>No results found.</CommandEmpty>
            <CommandGroup>
              {options.map((option) => (
                <CommandItem
                  key={option.value}
                  value={option.label}
                  className="cursor-pointer"
                  onSelect={() => {
                    handleSelect(option.value)
                  }}
                >
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4",
                      selected.includes(option.value) ? "opacity-100" : "opacity-0"
                    )}
                  />
                  {option.label}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
