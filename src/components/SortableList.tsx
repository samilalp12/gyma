import {
  closestCenter,
  DndContext,
  type DragEndEvent,
  MouseSensor,
  TouchSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import { restrictToParentElement, restrictToVerticalAxis } from '@dnd-kit/modifiers';
import { arrayMove, SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical } from 'lucide-react';
import { createContext, useContext, type HTMLAttributes, type ReactNode } from 'react';
import { cn } from './ui';

/**
 * Basılı tutup yukarı/aşağı sürükleyerek sıralanabilen liste.
 * Fare: 6px hareketle başlar (tık/checkbox bozulmaz). Dokunmatik: ~0,2 sn basılı tut.
 */
export function SortableList<T extends { id: string }>({
  items,
  onReorder,
  children,
  className,
}: {
  items: T[];
  onReorder: (ids: string[]) => void;
  children: (item: T) => ReactNode;
  className?: string;
}) {
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 6 } }),
  );

  const onDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return;
    const ids = items.map((i) => i.id);
    onReorder(arrayMove(ids, ids.indexOf(String(active.id)), ids.indexOf(String(over.id))));
  };

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd} modifiers={[restrictToVerticalAxis, restrictToParentElement]}>
      <SortableContext items={items.map((i) => i.id)} strategy={verticalListSortingStrategy}>
        <ul className={className}>{items.map((item) => children(item))}</ul>
      </SortableContext>
    </DndContext>
  );
}

const HandleContext = createContext<HTMLAttributes<HTMLElement>>({});

/**
 * Listenin bir satırı. handle=false (varsayılan) → satırın tamamı tutulup sürüklenir.
 * handle=true → yalnızca <DragHandle /> ile sürüklenir (input içeren satırlar için).
 */
export function SortableItem({ id, children, className, handle = false }: { id: string; children: ReactNode; className?: string; handle?: boolean }) {
  const { listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  // Sadece fare/dokunmatik dinleyicileri; satır odaklanabilir olmasın (checkbox'larla çakışmasın)
  const dragProps = (listeners ?? {}) as HTMLAttributes<HTMLElement>;
  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      className={cn(className, 'relative', isDragging && 'z-10 opacity-90 shadow-xl ring-1 ring-accent/40', !handle && 'cursor-grab active:cursor-grabbing')}
      {...(handle ? {} : dragProps)}
    >
      <HandleContext.Provider value={handle ? dragProps : {}}>{children}</HandleContext.Provider>
    </li>
  );
}

/** Sürükleme tutamacı. Satır modunda sadece görsel ipucu. */
export function DragHandle({ className }: { className?: string }) {
  const props = useContext(HandleContext);
  return (
    <span
      {...props}
      className={cn('flex shrink-0 cursor-grab touch-none items-center text-muted/60 hover:text-muted active:cursor-grabbing', className)}
      aria-label="Sürükleyerek sırala"
      title="Sürükleyerek sırala"
    >
      <GripVertical size={15} />
    </span>
  );
}
