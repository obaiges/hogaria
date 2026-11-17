import { useState } from "react";

import { Button } from "@/components/ui/Button";
import { Checkbox } from "@/components/ui/Checkbox";
import { Chip } from "@/components/ui/Chip";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/Dialog";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { FormField } from "@/components/ui/FormField";
import { Input } from "@/components/ui/Input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/Select";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/Sheet";
import { Skeleton } from "@/components/ui/Skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/Tabs";
import { Textarea } from "@/components/ui/Textarea";
import { ToastViewport, useToast } from "@/components/ui/Toast";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-[14px] font-semibold tracking-[0.06em] text-[var(--ink-muted)]" style={{ fontFamily: "var(--font-sign)" }}>{title.toUpperCase()}</h2>
      {children}
    </section>
  );
}

export function DevUiPage() {
  const [chip, setChip] = useState(true);
  const [checked, setChecked] = useState(false);
  const { toast } = useToast();
  return (
    <main className="mx-auto min-h-screen max-w-[375px] space-y-6 bg-[var(--bg)] p-4 text-[var(--ink)]">
      <h1 className="text-[22px]" style={{ fontFamily: "var(--font-sign)" }}>UI / Piscina</h1>

      <Section title="Button">
        <div className="flex flex-wrap gap-2">
          <Button variant="primary">Primario</Button>
          <Button variant="secondary">Secundario</Button>
          <Button variant="ghost">Ghost</Button>
          <Button variant="danger">Danger</Button>
          <Button loading>Loading</Button>
        </div>
      </Section>

      <Section title="Inputs">
        <FormField label="Nombre" hint="Visible siempre">
          <Input placeholder="Escribe..." />
        </FormField>
        <FormField label="Con error" error="Este campo es obligatorio">
          <Input placeholder="Error" />
        </FormField>
        <FormField label="Descripción">
          <Textarea placeholder="Texto largo" />
        </FormField>
        <FormField label="Select">
          <Select defaultValue="a">
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="a">Opción A</SelectItem>
              <SelectItem value="b">Opción B</SelectItem>
            </SelectContent>
          </Select>
        </FormField>
      </Section>

      <Section title="Checkbox y Chip">
        <label className="flex min-h-[44px] items-center gap-3">
          <Checkbox checked={checked} onCheckedChange={(v) => setChecked(v === true)} />
          <span>Marcado: {String(checked)}</span>
        </label>
        <div className="flex gap-2"><Chip active={chip} onClick={() => setChip((c) => !c)}>Filtro</Chip><Chip>Otro</Chip></div>
      </Section>

      <Section title="Tabs">
        <Tabs defaultValue="1">
          <TabsList>
            <TabsTrigger value="1">Mis tareas</TabsTrigger>
            <TabsTrigger value="2">Todas</TabsTrigger>
          </TabsList>
          <TabsContent value="1" className="pt-2">Contenido 1</TabsContent>
          <TabsContent value="2" className="pt-2">Contenido 2</TabsContent>
        </Tabs>
      </Section>

      <Section title="Overlays y Toast">
        <div className="flex gap-2">
          <Dialog>
            <DialogTrigger asChild><Button variant="secondary">Dialog</Button></DialogTrigger>
            <DialogContent title="Confirmar" description="Acción destructiva"><Button variant="danger">Borrar</Button></DialogContent>
          </Dialog>
          <Sheet>
            <SheetTrigger asChild><Button variant="secondary">Sheet</Button></SheetTrigger>
            <SheetContent title="Editar"><FormField label="Campo"><Input /></FormField></SheetContent>
          </Sheet>
          <Button onClick={() => toast("Producto añadido", { actionLabel: "Deshacer", onAction: () => {} })}>Toast</Button>
        </div>
      </Section>

      <Section title="Estados">
        <Skeleton className="h-12 w-full" />
        <EmptyState title="Aún no hay listas. Crea la primera" actionLabel="Crear" onAction={() => {}} />
        <ErrorState message="No se ha podido cargar" onRetry={() => {}} />
      </Section>
      <ToastViewport />
    </main>
  );
}
