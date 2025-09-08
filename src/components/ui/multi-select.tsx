
"use client"

import * as React from "react"
import { X, Check } from "lucide-react"

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
}

export function MultiSelect({ options, selected, onChange, className, ...props }: MultiSelectProps) {
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

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <div className={cn("relative", className)}>
            <Button
                variant="outline"
                role="combobox"
                aria-expanded={open}
                className="w-full justify-between h-10"
                onClick={() => setOpen(!open)}
            >
                <div className="flex gap-1 flex-wrap">
                    {selected.length > 0 ? (
                        selected.map((value) => (
                        <Badge
                            variant="secondary"
                            key={value}
                            className="mr-1"
                            onClick={(e) => {
                                e.stopPropagation();
                                handleUnselect(value);
                            }}
                        >
                            {options.find(o => o.value === value)?.label}
                            <X className="h-3 w-3 ml-1" />
                        </Badge>
                        ))
                    ) : (
                        <span className="text-muted-foreground">{props.placeholder ?? "Select..."}</span>
                    )}
                </div>
            </Button>
        </div>
      </PopoverTrigger>
      <PopoverContent className="w-full p-0" align="start">
        <Command>
          <CommandInput placeholder="Search..." />
          <CommandList>
            <CommandEmpty>No results found.</CommandEmpty>
            <CommandGroup>
              {options.map((option) => (
                <CommandItem
                  key={option.value}
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

    