import { useState } from "react"
import { Check, ChevronsUpDown, Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Command,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { parentPickerRows } from "@/lib/media"
import { TITLE_MAX_LENGTH, type MediaEntry } from "@/types/media"

type Props = {
  id?: string
  value: string | null
  /**
   * A series named in this field that does not exist yet. The dialog creates it
   * when the entry is saved, so until then it is only a title.
   */
  pending: string | null
  options: MediaEntry[]
  onChange: (value: string | null) => void
  onCreate: (title: string) => void
}

const NONE = "__none__"
const CREATE = "__create__"

export function ParentCombobox({ id, value, pending, options, onChange, onCreate }: Props) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState("")
  const selected = options.find((option) => option.id === value)
  const label = pending ?? selected?.title ?? "Not a season"

  const rows = parentPickerRows(options, pending, search)
  // Held in a local so it stays narrowed inside onSelect below.
  const creating = rows.create

  function close() {
    setOpen(false)
    setSearch("")
  }

  function choose(next: string) {
    onChange(next === NONE ? null : next)
    close()
  }

  return (
    // Modal so that it holds the scroll lock: the dialog it opens from blocks
    // wheel and touch scrolling everywhere outside itself, and this list is
    // portaled outside it.
    <Popover modal open={open} onOpenChange={(next) => next ? setOpen(true) : close()}>
      <PopoverTrigger asChild>
        <Button
          id={id}
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="parent-combobox-trigger"
        >
          <span className={selected || pending ? "parent-combobox-value" : "parent-combobox-value is-placeholder"}>
            <span className="parent-combobox-title">{label}</span>
            {pending && <span className="parent-combobox-new">New</span>}
          </span>
          <ChevronsUpDown size={15} className="parent-combobox-caret" aria-hidden="true" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="parent-combobox-content" align="start">
        {/* The rows come from parentPickerRows rather than cmdk's own filter so
            that the list keeps the order written there: cmdk re-appends matching
            groups below the rest of the list, which would leave "create" as the
            row Enter lands on. */}
        <Command shouldFilter={false}>
          <CommandInput
            placeholder="Search or name a series..."
            value={search}
            onValueChange={setSearch}
            maxLength={TITLE_MAX_LENGTH}
          />
          <CommandList>
            <CommandGroup>
              {rows.pending && (
                <CommandItem value={rows.pending} onSelect={close}>
                  <Check size={15} aria-hidden="true" />
                  {rows.pending}
                  <span className="parent-combobox-new">New</span>
                </CommandItem>
              )}
              {rows.none && (
                <CommandItem value={NONE} onSelect={() => choose(NONE)}>
                  <Check size={15} className={value === null && !pending ? "" : "is-hidden"} aria-hidden="true" />
                  Not a season
                </CommandItem>
              )}
              {rows.series.map((option) => (
                <CommandItem key={option.id} value={option.id} onSelect={() => choose(option.id)}>
                  <Check size={15} className={value === option.id ? "" : "is-hidden"} aria-hidden="true" />
                  {option.title}
                </CommandItem>
              ))}
              {creating && (
                <CommandItem value={CREATE} onSelect={() => { onCreate(creating); close() }}>
                  <Plus size={15} aria-hidden="true" />
                  Create series “{creating}”
                </CommandItem>
              )}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
