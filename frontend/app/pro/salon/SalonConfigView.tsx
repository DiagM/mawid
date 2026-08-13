"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { Skeleton } from "@/components/Skeleton";
import { CloseIcon, PlusIcon } from "@/components/icons";
import {
  ApiError,
  api,
  type CreatePrestationInput,
  type ManagerPrestation,
  type ManagerSalon,
  type OpeningHours,
  type UpdatePrestationInput,
  type Weekday,
} from "@/lib/api";
import { getToken, logout } from "@/lib/auth";
import { WEEKDAY_ORDER, formatDuration, formatPrice, weekdayLabel } from "@/lib/format";

interface SalonFormValues {
  name: string;
  description: string;
  addressLine: string;
  district: string;
  openingHours: OpeningHours;
  photos: string[];
}

function toFormValues(salon: ManagerSalon): SalonFormValues {
  return {
    name: salon.name,
    description: salon.description ?? "",
    addressLine: salon.addressLine,
    district: salon.district,
    openingHours: salon.openingHours,
    photos: salon.photos,
  };
}

interface ConfigState {
  loading: boolean;
  error: string | null;
  salon: ManagerSalon | null;
  prestations: ManagerPrestation[];
}

export function SalonConfigView() {
  const router = useRouter();
  const [retryTick, setRetryTick] = useState(0);
  const [config, setConfig] = useState<ConfigState>({
    loading: true,
    error: null,
    salon: null,
    prestations: [],
  });
  const [form, setForm] = useState<SalonFormValues | null>(null);

  useEffect(() => {
    async function load() {
      setConfig({ loading: true, error: null, salon: null, prestations: [] });
      const token = getToken();
      if (!token) return;
      try {
        const [salon, prestations] = await Promise.all([
          api.getMySalon(token),
          api.getMyPrestations(token),
        ]);
        setConfig({ loading: false, error: null, salon, prestations });
        setForm(toFormValues(salon));
      } catch (error) {
        if (error instanceof ApiError && error.status === 401) {
          logout();
          router.replace("/pro/connexion");
          return;
        }
        const message =
          error instanceof ApiError
            ? error.message
            : "Impossible de charger ton salon. Réessaie.";
        setConfig({ loading: false, error: message, salon: null, prestations: [] });
      }
    }
    void load();
  }, [retryTick, router]);

  if (config.loading) {
    return (
      <main className="mx-auto w-full max-w-lg flex-1 space-y-4 px-5 py-6">
        <Skeleton className="h-7 w-1/2" />
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-64 w-full" />
      </main>
    );
  }

  if (config.error || !form || !config.salon) {
    return (
      <main className="mx-auto flex w-full max-w-lg flex-1 flex-col items-center justify-center gap-4 px-6 py-16 text-center">
        <p className="text-sm text-danger">{config.error}</p>
        <Button variant="ghost" onClick={() => setRetryTick((c) => c + 1)}>
          Réessayer
        </Button>
      </main>
    );
  }

  return (
    <main className="mx-auto w-full max-w-lg flex-1 space-y-8 px-5 py-6 pb-10">
      <SalonFieldsSection
        form={form}
        setForm={setForm}
        onSaved={(updated) => {
          setConfig((prev) => ({ ...prev, salon: updated }));
          setForm(toFormValues(updated));
        }}
      />

      <PrestationsSection
        prestations={config.prestations}
        onListChange={(prestations) =>
          setConfig((prev) => ({ ...prev, prestations }))
        }
      />
    </main>
  );
}

// ============================================
// Section 1 — Fiche salon
// ============================================

function SalonFieldsSection({
  form,
  setForm,
  onSaved,
}: {
  form: SalonFormValues;
  setForm: (updater: (prev: SalonFormValues | null) => SalonFormValues | null) => void;
  onSaved: (salon: ManagerSalon) => void;
}) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [photoInput, setPhotoInput] = useState("");

  function updateField<K extends "name" | "description" | "addressLine" | "district">(
    key: K,
    value: string,
  ) {
    setSaved(false);
    setForm((prev) => (prev ? { ...prev, [key]: value } : prev));
  }

  function toggleClosed(day: Weekday, closed: boolean) {
    setSaved(false);
    setForm((prev) =>
      prev
        ? {
            ...prev,
            openingHours: {
              ...prev.openingHours,
              [day]: closed ? null : { open: "09:00", close: "18:00" },
            },
          }
        : prev,
    );
  }

  function updateHours(day: Weekday, field: "open" | "close", value: string) {
    setSaved(false);
    setForm((prev) => {
      if (!prev) return prev;
      const current = prev.openingHours[day];
      if (!current) return prev;
      return {
        ...prev,
        openingHours: { ...prev.openingHours, [day]: { ...current, [field]: value } },
      };
    });
  }

  function addPhoto() {
    const trimmed = photoInput.trim();
    if (!trimmed) return;
    setSaved(false);
    setForm((prev) => (prev ? { ...prev, photos: [...prev.photos, trimmed] } : prev));
    setPhotoInput("");
  }

  function removePhoto(index: number) {
    setSaved(false);
    setForm((prev) =>
      prev ? { ...prev, photos: prev.photos.filter((_, i) => i !== index) } : prev,
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaved(false);

    const name = form.name.trim();
    const addressLine = form.addressLine.trim();
    const district = form.district.trim();
    if (name.length < 2) {
      setError("Le nom du salon doit faire au moins 2 caractères.");
      return;
    }
    if (addressLine.length < 5) {
      setError("L'adresse doit être plus précise.");
      return;
    }
    if (district.length < 2) {
      setError("Le quartier doit faire au moins 2 caractères.");
      return;
    }

    const token = getToken();
    if (!token) return;
    setSaving(true);
    try {
      const updated = await api.updateMySalon(token, {
        name,
        description: form.description.trim() || null,
        addressLine,
        district,
        openingHours: form.openingHours,
        photos: form.photos,
      });
      onSaved(updated);
      setSaved(true);
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : "Impossible d'enregistrer ces changements. Réessaie.",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <section>
      <h2 className="text-sm font-semibold tracking-wide text-sand uppercase">
        Mon salon
      </h2>

      <form onSubmit={handleSubmit} className="mt-3 space-y-5">
        <div>
          <label htmlFor="salon-name" className="block text-sm font-medium text-navy">
            Nom du salon
          </label>
          <input
            id="salon-name"
            type="text"
            value={form.name}
            onChange={(e) => updateField("name", e.target.value)}
            className="mt-1 w-full rounded-xl border border-navy/15 bg-white px-4 py-3 text-base text-navy outline-none focus:border-sand"
          />
        </div>

        <div>
          <label
            htmlFor="salon-description"
            className="block text-sm font-medium text-navy"
          >
            Description
          </label>
          <textarea
            id="salon-description"
            rows={3}
            value={form.description}
            onChange={(e) => updateField("description", e.target.value)}
            placeholder="Présente ton salon en quelques mots"
            className="mt-1 w-full rounded-xl border border-navy/15 bg-white px-4 py-3 text-base text-navy outline-none focus:border-sand"
          />
        </div>

        <div>
          <label
            htmlFor="salon-address"
            className="block text-sm font-medium text-navy"
          >
            Adresse
          </label>
          <input
            id="salon-address"
            type="text"
            value={form.addressLine}
            onChange={(e) => updateField("addressLine", e.target.value)}
            className="mt-1 w-full rounded-xl border border-navy/15 bg-white px-4 py-3 text-base text-navy outline-none focus:border-sand"
          />
        </div>

        <div>
          <label
            htmlFor="salon-district"
            className="block text-sm font-medium text-navy"
          >
            Quartier
          </label>
          <input
            id="salon-district"
            type="text"
            value={form.district}
            onChange={(e) => updateField("district", e.target.value)}
            className="mt-1 w-full rounded-xl border border-navy/15 bg-white px-4 py-3 text-base text-navy outline-none focus:border-sand"
          />
        </div>

        <div>
          <p className="text-sm font-medium text-navy">Horaires d&apos;ouverture</p>
          <ul className="mt-2 space-y-2">
            {WEEKDAY_ORDER.map((day) => {
              const hours = form.openingHours[day];
              const closed = hours === null;
              return (
                <li
                  key={day}
                  className="rounded-xl bg-white px-4 py-3 ring-1 ring-navy/10"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-navy">
                      {weekdayLabel(day)}
                    </span>
                    <label className="flex items-center gap-2 text-xs text-navy/60">
                      <input
                        type="checkbox"
                        checked={closed}
                        onChange={(e) => toggleClosed(day, e.target.checked)}
                      />
                      Fermé
                    </label>
                  </div>
                  {!closed && hours && (
                    <div className="mt-2 flex items-center gap-2">
                      <input
                        type="time"
                        value={hours.open}
                        onChange={(e) => updateHours(day, "open", e.target.value)}
                        className="flex-1 rounded-lg border border-navy/15 bg-white px-2 py-1.5 text-sm text-navy outline-none focus:border-sand"
                      />
                      <span className="text-navy/40">–</span>
                      <input
                        type="time"
                        value={hours.close}
                        onChange={(e) => updateHours(day, "close", e.target.value)}
                        className="flex-1 rounded-lg border border-navy/15 bg-white px-2 py-1.5 text-sm text-navy outline-none focus:border-sand"
                      />
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </div>

        <div>
          <p className="text-sm font-medium text-navy">Photos</p>
          <ul className="mt-2 space-y-2">
            {form.photos.map((url, index) => (
              <li
                key={`${url}-${index}`}
                className="flex items-center gap-2 rounded-xl bg-white px-3 py-2 ring-1 ring-navy/10"
              >
                <span className="flex-1 truncate text-sm text-navy/70">{url}</span>
                <button
                  type="button"
                  onClick={() => removePhoto(index)}
                  aria-label="Retirer cette photo"
                  className="shrink-0 rounded-full p-1.5 text-navy/50 hover:bg-navy/5"
                >
                  <CloseIcon className="h-4 w-4" />
                </button>
              </li>
            ))}
          </ul>
          <div className="mt-2 flex gap-2">
            <input
              type="url"
              value={photoInput}
              onChange={(e) => setPhotoInput(e.target.value)}
              placeholder="https://…"
              className="flex-1 rounded-xl border border-navy/15 bg-white px-3 py-2 text-sm text-navy outline-none focus:border-sand"
            />
            <Button type="button" variant="ghost" fullWidth={false} onClick={addPhoto}>
              Ajouter
            </Button>
          </div>
        </div>

        {error && <p className="text-sm text-danger">{error}</p>}
        {saved && !error && (
          <p className="text-sm text-success">Modifications enregistrées.</p>
        )}

        <Button type="submit" loading={saving}>
          Enregistrer
        </Button>
      </form>
    </section>
  );
}

// ============================================
// Section 2 — Prestations
// ============================================

interface PrestationFormValues {
  name: string;
  description: string;
  durationMinutes: string;
  priceDzd: string;
  displayOrder: string;
}

function prestationToFormValues(p: ManagerPrestation): PrestationFormValues {
  return {
    name: p.name,
    description: p.description ?? "",
    durationMinutes: String(p.durationMinutes),
    priceDzd: String(Math.round(p.priceCents / 100)),
    displayOrder: String(p.displayOrder),
  };
}

function emptyPrestationForm(nextDisplayOrder: number): PrestationFormValues {
  return {
    name: "",
    description: "",
    durationMinutes: "30",
    priceDzd: "",
    displayOrder: String(nextDisplayOrder),
  };
}

function PrestationsSection({
  prestations,
  onListChange,
}: {
  prestations: ManagerPrestation[];
  onListChange: (prestations: ManagerPrestation[]) => void;
}) {
  const [creating, setCreating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [rowError, setRowError] = useState<{ id: string; message: string } | null>(
    null,
  );

  async function handleCreate(values: PrestationFormValues) {
    const input = parsePrestationForm(values);
    if ("error" in input) return input.error;
    const token = getToken();
    if (!token) return "Session expirée, reconnecte-toi.";
    try {
      const created = await api.createPrestation(token, input.value);
      onListChange([...prestations, created]);
      setCreating(false);
      return null;
    } catch (err) {
      return err instanceof ApiError
        ? err.message
        : "Impossible de créer cette prestation. Réessaie.";
    }
  }

  async function handleUpdate(id: string, values: PrestationFormValues) {
    const input = parsePrestationForm(values);
    if ("error" in input) return input.error;
    const token = getToken();
    if (!token) return "Session expirée, reconnecte-toi.";
    try {
      const updated = await api.updatePrestation(token, id, input.value);
      onListChange(prestations.map((p) => (p.id === id ? updated : p)));
      setEditingId(null);
      return null;
    } catch (err) {
      return err instanceof ApiError
        ? err.message
        : "Impossible d'enregistrer cette prestation. Réessaie.";
    }
  }

  async function handleToggleActive(p: ManagerPrestation) {
    setBusyId(p.id);
    setRowError(null);
    const token = getToken();
    if (!token) return;
    try {
      if (p.isActive) {
        await api.archivePrestation(token, p.id);
        onListChange(
          prestations.map((item) =>
            item.id === p.id ? { ...item, isActive: false } : item,
          ),
        );
      } else {
        const updated = await api.updatePrestation(token, p.id, { isActive: true });
        onListChange(prestations.map((item) => (item.id === p.id ? updated : item)));
      }
    } catch (err) {
      setRowError({
        id: p.id,
        message:
          err instanceof ApiError
            ? err.message
            : "Action impossible. Réessaie.",
      });
    } finally {
      setBusyId(null);
    }
  }

  const nextDisplayOrder = prestations.length + 1;

  return (
    <section>
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold tracking-wide text-sand uppercase">
          Prestations
        </h2>
        {!creating && (
          <button
            type="button"
            onClick={() => setCreating(true)}
            className="flex items-center gap-1 text-sm font-medium text-navy"
          >
            <PlusIcon className="h-4 w-4" />
            Ajouter
          </button>
        )}
      </div>

      {creating && (
        <div className="mt-3">
          <PrestationForm
            initial={emptyPrestationForm(nextDisplayOrder)}
            submitLabel="Créer la prestation"
            onCancel={() => setCreating(false)}
            onSubmit={handleCreate}
          />
        </div>
      )}

      <ul className="mt-3 space-y-2">
        {prestations.length === 0 && !creating && (
          <p className="rounded-xl bg-navy/5 px-4 py-6 text-center text-sm text-navy/50">
            Aucune prestation pour le moment.
          </p>
        )}
        {prestations.map((p) =>
          editingId === p.id ? (
            <li key={p.id}>
              <PrestationForm
                initial={prestationToFormValues(p)}
                submitLabel="Enregistrer"
                onCancel={() => setEditingId(null)}
                onSubmit={(values) => handleUpdate(p.id, values)}
              />
            </li>
          ) : (
            <li key={p.id}>
              <Card className={p.isActive ? "" : "opacity-60"}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-medium text-navy">
                      {p.name}
                      {!p.isActive && (
                        <span className="ml-2 rounded-full bg-navy/10 px-2 py-0.5 text-[11px] font-semibold text-navy/50">
                          Archivée
                        </span>
                      )}
                    </p>
                    {p.description && (
                      <p className="truncate text-xs text-navy/50">
                        {p.description}
                      </p>
                    )}
                    <p className="mt-1 text-xs text-navy/60">
                      {formatDuration(p.durationMinutes)} ·{" "}
                      {formatPrice(p.priceCents)}
                    </p>
                  </div>
                </div>
                <div className="mt-3 flex gap-2">
                  <Button
                    variant="ghost"
                    fullWidth={false}
                    onClick={() => setEditingId(p.id)}
                  >
                    Modifier
                  </Button>
                  <Button
                    variant={p.isActive ? "danger" : "secondary"}
                    fullWidth={false}
                    loading={busyId === p.id}
                    onClick={() => handleToggleActive(p)}
                  >
                    {p.isActive ? "Archiver" : "Réactiver"}
                  </Button>
                </div>
                {rowError?.id === p.id && (
                  <p className="mt-2 text-xs text-danger">{rowError.message}</p>
                )}
              </Card>
            </li>
          ),
        )}
      </ul>
    </section>
  );
}

function parsePrestationForm(
  values: PrestationFormValues,
):
  | { value: CreatePrestationInput & UpdatePrestationInput }
  | { error: string } {
  const name = values.name.trim();
  if (name.length < 2) {
    return { error: "Le nom doit faire au moins 2 caractères." };
  }
  const durationMinutes = Number(values.durationMinutes);
  if (!Number.isInteger(durationMinutes) || durationMinutes < 5 || durationMinutes > 480) {
    return { error: "La durée doit être un entier entre 5 et 480 minutes." };
  }
  const priceDzd = Number(values.priceDzd);
  if (!Number.isFinite(priceDzd) || priceDzd < 0) {
    return { error: "Le prix doit être un nombre positif." };
  }
  const priceCents = Math.round(priceDzd * 100);
  const displayOrder = values.displayOrder.trim()
    ? Number(values.displayOrder)
    : undefined;
  if (displayOrder !== undefined && (!Number.isInteger(displayOrder) || displayOrder < 0)) {
    return { error: "L'ordre d'affichage doit être un entier positif." };
  }

  return {
    value: {
      name,
      description: values.description.trim() || undefined,
      durationMinutes,
      priceCents,
      displayOrder,
    },
  };
}

function PrestationForm({
  initial,
  submitLabel,
  onCancel,
  onSubmit,
}: {
  initial: PrestationFormValues;
  submitLabel: string;
  onCancel: () => void;
  onSubmit: (values: PrestationFormValues) => Promise<string | null>;
}) {
  const [values, setValues] = useState(initial);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function update<K extends keyof PrestationFormValues>(key: K, value: string) {
    setValues((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    const message = await onSubmit(values);
    setSubmitting(false);
    if (message) setError(message);
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-3 rounded-2xl border border-navy/10 bg-white p-4"
    >
      <div>
        <label className="block text-xs font-medium text-navy/60">Nom</label>
        <input
          type="text"
          value={values.name}
          onChange={(e) => update("name", e.target.value)}
          className="mt-1 w-full rounded-xl border border-navy/15 bg-white px-3 py-2 text-sm text-navy outline-none focus:border-sand"
        />
      </div>
      <div>
        <label className="block text-xs font-medium text-navy/60">
          Description (optionnel)
        </label>
        <input
          type="text"
          value={values.description}
          onChange={(e) => update("description", e.target.value)}
          className="mt-1 w-full rounded-xl border border-navy/15 bg-white px-3 py-2 text-sm text-navy outline-none focus:border-sand"
        />
      </div>
      <div className="flex gap-3">
        <div className="flex-1">
          <label className="block text-xs font-medium text-navy/60">
            Durée (min)
          </label>
          <input
            type="number"
            min={5}
            max={480}
            value={values.durationMinutes}
            onChange={(e) => update("durationMinutes", e.target.value)}
            className="mt-1 w-full rounded-xl border border-navy/15 bg-white px-3 py-2 text-sm text-navy outline-none focus:border-sand"
          />
        </div>
        <div className="flex-1">
          <label className="block text-xs font-medium text-navy/60">
            Prix (DA)
          </label>
          <input
            type="number"
            min={0}
            value={values.priceDzd}
            onChange={(e) => update("priceDzd", e.target.value)}
            className="mt-1 w-full rounded-xl border border-navy/15 bg-white px-3 py-2 text-sm text-navy outline-none focus:border-sand"
          />
        </div>
        <div className="flex-1">
          <label className="block text-xs font-medium text-navy/60">Ordre</label>
          <input
            type="number"
            min={0}
            value={values.displayOrder}
            onChange={(e) => update("displayOrder", e.target.value)}
            className="mt-1 w-full rounded-xl border border-navy/15 bg-white px-3 py-2 text-sm text-navy outline-none focus:border-sand"
          />
        </div>
      </div>

      {error && <p className="text-sm text-danger">{error}</p>}

      <div className="flex gap-3">
        <Button type="button" variant="ghost" onClick={onCancel}>
          Annuler
        </Button>
        <Button type="submit" loading={submitting}>
          {submitLabel}
        </Button>
      </div>
    </form>
  );
}
