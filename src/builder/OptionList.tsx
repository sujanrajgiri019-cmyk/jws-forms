import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { restrictToVerticalAxis, restrictToParentElement } from "@dnd-kit/modifiers";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Icon } from "../components/Icons";
import { Button } from "../components/ui";
import { uid } from "../lib/questionTypes";
import type { Choice } from "../types";

/**
 * The editable list of options / grid rows / grid columns.
 * `marker` draws the same control the respondent will see, so the editor
 * previews the real thing rather than a generic list.
 */
export function OptionList({
  items,
  onChange,
  marker,
  addLabel,
  namePrefix,
  minItems = 1,
}: {
  items: Choice[];
  onChange: (next: Choice[]) => void;
  marker: "radio" | "checkbox" | "number" | "none";
  addLabel: string;
  namePrefix: string;
  minItems?: number;
}) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  function onDragEnd(e: DragEndEvent) {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const from = items.findIndex((i) => i.id === active.id);
    const to = items.findIndex((i) => i.id === over.id);
    if (from < 0 || to < 0) return;
    const next = [...items];
    const [m] = next.splice(from, 1);
    next.splice(to, 0, m);
    onChange(next);
  }

  const set = (id: string, label: string) =>
    onChange(items.map((i) => (i.id === id ? { ...i, label } : i)));

  const add = () =>
    onChange([...items, { id: uid(), label: `${addLabel} ${items.length + 1}` }]);

  return (
    <div>
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={onDragEnd}
        modifiers={[restrictToVerticalAxis, restrictToParentElement]}
      >
        <SortableContext items={items.map((i) => i.id)} strategy={verticalListSortingStrategy}>
          {items.map((o, i) => (
            <Row
              key={o.id}
              item={o}
              index={i}
              marker={marker}
              namePrefix={namePrefix}
              canRemove={items.length > minItems}
              onLabel={(v) => set(o.id, v)}
              onRemove={() => onChange(items.filter((x) => x.id !== o.id))}
              onEnter={() => {
                const next = [...items];
                next.splice(i + 1, 0, { id: uid(), label: "" });
                onChange(next);
              }}
            />
          ))}
        </SortableContext>
      </DndContext>

      <Button size="sm" icon="plus" onClick={add} style={{ marginTop: 4, marginLeft: 24 }}>
        Add {addLabel.toLowerCase()}
      </Button>
    </div>
  );
}

function Row({
  item,
  index,
  marker,
  namePrefix,
  canRemove,
  onLabel,
  onRemove,
  onEnter,
}: {
  item: Choice;
  index: number;
  marker: "radio" | "checkbox" | "number" | "none";
  namePrefix: string;
  canRemove: boolean;
  onLabel: (v: string) => void;
  onRemove: () => void;
  onEnter: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: item.id,
  });

  return (
    <div
      ref={setNodeRef}
      className="optrow"
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.4 : 1,
        position: "relative",
        zIndex: isDragging ? 2 : undefined,
      }}
    >
      <span
        className="handle"
        {...attributes}
        {...listeners}
        style={{ cursor: "grab", touchAction: "none" }}
        aria-label="Reorder"
      >
        <Icon name="drag" size={16} />
      </span>

      {marker === "radio" && <input type="radio" name={namePrefix} disabled readOnly />}
      {marker === "checkbox" && <input type="checkbox" disabled readOnly />}
      {marker === "number" && (
        <span style={{ color: "var(--ink-3)", fontSize: 13.5, width: 18 }}>{index + 1}.</span>
      )}

      <input
        className="bare grow"
        value={item.label}
        placeholder={`Option ${index + 1}`}
        onChange={(e) => onLabel(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            onEnter();
          }
        }}
      />

      <Button
        size="sm"
        icon="x"
        aria-label="Remove"
        onClick={onRemove}
        disabled={!canRemove}
      />
    </div>
  );
}
