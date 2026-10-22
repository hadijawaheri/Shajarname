"use client";

import { useCallback, useId, useMemo, useRef, useState } from "react";
import {
  Button,
  Checkbox,
  CheckboxGroup,
  Input,
  Label,
  ListBox,
  Select,
  TextArea,
  TextField,
} from "@heroui/react";
import type { FamilyMember, MarriageNode } from "../lib/types";
import { formatMemberLabel } from "../lib/memberLabel";

function FilePickField({
  label,
  accept,
  onFile,
  pickLabel,
  existingUrl,
  onDeleteExisting,
}: {
  label: string;
  accept: string;
  onFile: (f: File | null) => void;
  pickLabel: string;
  existingUrl?: string | null;
  onDeleteExisting?: () => void;
}) {
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState<string | null>(null);

  return (
    <div className="space-y-2">
      {label ? <Label className="text-xs font-bold text-gray-500">{label}</Label> : null}
      <input
        id={inputId}
        ref={inputRef}
        type="file"
        accept={accept}
        className="sr-only"
        onChange={(e) => {
          const f = e.target.files?.[0] ?? null;
          setFileName(f?.name ?? null);
          onFile(f);
        }}
      />
      {Boolean(existingUrl) && (
        <div className="flex items-center gap-2 mb-2 bg-slate-100/50 p-2 rounded-lg border border-slate-200">
          {/* Blob/API preview URLs must render directly; image optimization cannot handle local blobs. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={existingUrl || ""} alt="" className="w-8 h-8 object-cover rounded-md" />
          <span className="text-[11px] text-slate-500 truncate flex-1 min-w-0">عکس فعلی</span>
          <Button type="button" size="sm" variant="danger-soft" isIconOnly aria-label="Delete" onPress={onDeleteExisting}>
            <i className="fa-solid fa-trash"></i>
          </Button>
        </div>
      )}
      <div className="flex items-center gap-2">
        <Button
          type="button"
          size="sm"
          variant="secondary"
          onPress={() => inputRef.current?.click()}
        >
          <i className="fa-solid fa-paperclip me-1.5"></i>
          {pickLabel}
        </Button>
        <span className="text-[11px] text-slate-500 truncate flex-1 min-w-0">
          {fileName || "—"}
        </span>
      </div>
    </div>
  );
}

export interface MemberEditorLabels {
  titleEdit: string;
  titleNew: string;
  nameAr: string;
  nameEn: string;
  birth: string;
  death: string;
  deathPlaceholder: string;
  gender: string;
  genderMale: string;
  genderFemale: string;
  privacy: string;
  privacyOn: string;
  privacyOff: string;
  father: string;
  mother: string;
  noFather: string;
  noMother: string;
  bio: string;
  mobile: string;
  avatar: string;
  gallery: string;
  audio: string;
  audioTitle: string;
  spouses: string;
  spousesFemaleHint: string;
  noSpouseCandidates: string;
  cancel: string;
  save: string;
  delete: string;
  deleteConfirm: string;
  deleteChildrenWarn: string;
}

export interface MemberEditorFormProps {
  editId: string | null;
  existingAvatar?: string | null;
  onDeleteAvatar?: () => void;
  existingGallery?: string | null;
  onDeleteGallery?: () => void;
  labels: MemberEditorLabels;
  lang: "fa" | "ar" | "en";
  maxYear: number;
  isSaving: boolean;
  deleteConfirmOpen: boolean;
  hasChildren: boolean;
  nameAr: string;
  nameEn: string;
  birth: number;
  death: string;
  gender: "m" | "f";
  privacy: boolean;
  bio: string;
  mobile: string;
  audioTitle: string;
  fatherId: string;
  motherId: string;
  spouses: string[];
  fatherOptions: FamilyMember[];
  motherOptions: FamilyMember[];
  spouseCandidates: FamilyMember[];
  /** Full tree context for disambiguated labels (father name). */
  labelMembers: FamilyMember[];
  labelMarriages: MarriageNode[];
  onNameAr: (v: string) => void;
  onNameEn: (v: string) => void;
  onBirth: (v: number) => void;
  onDeath: (v: string) => void;
  onGender: (v: "m" | "f") => void;
  onPrivacy: (v: boolean) => void;
  onBio: (v: string) => void;
  onMobile: (v: string) => void;
  onAudioTitle: (v: string) => void;
  onFatherId: (v: string) => void;
  onMotherId: (v: string) => void;
  onSpouses: (v: string[]) => void;
  onAvatarFile: (f: File | null) => void;
  onGalleryFile: (f: File | null) => void;
  onAudioFile: (f: File | null) => void;
  onClose: () => void;
  onSubmit: (e: React.FormEvent) => void;
  onDeleteRequest: () => void;
  onDeleteCancel: () => void;
  onDeleteConfirm: () => void;
  onSpouseLimitToast?: () => void;
}

function digitsOnly(raw: string): string {
  return raw.replace(/[^\d]/g, "").slice(0, 4);
}

export default function MemberEditorForm(props: MemberEditorFormProps) {
  const {
    editId,
    labels: t,
    lang,
    maxYear,
    isSaving,
    deleteConfirmOpen,
    hasChildren,
    nameAr,
    nameEn,
    birth,
    death,
    gender,
    privacy,
    bio,
    mobile,
    audioTitle,
    fatherId,
    motherId,
    spouses,
    fatherOptions,
    motherOptions,
    spouseCandidates,
    labelMembers,
    labelMarriages,
  } = props;

  const labelCtx = { members: labelMembers, marriages: labelMarriages };
  const memberLabel = (m: FamilyMember) => formatMemberLabel(m, lang, labelCtx);

  const formRef = useRef<HTMLFormElement>(null);

  const setYearBirth = (raw: string) => {
    const d = digitsOnly(raw);
    if (!d) {
      props.onBirth(0);
      return;
    }
    const n = parseInt(d, 10);
    props.onBirth(Math.min(Math.max(n, 0), maxYear));
  };

  const setYearDeath = (raw: string) => {
    props.onDeath(digitsOnly(raw));
  };

  const handleSpouseChange = (next: string[]) => {
    if (gender === "f" && next.length > 1) {
      props.onSpouses([next[next.length - 1]]);
      props.onSpouseLimitToast?.();
      return;
    }
    props.onSpouses(next);
  };

  const getSpouseIds = useCallback((mId: string): string[] => {
    if (!mId) return [];
    const set = new Set<string>();
    const mem = (labelMembers || []).find((m) => m.id === mId);
    mem?.spouses?.forEach((sId) => {
      if (sId) set.add(sId);
    });
    (labelMarriages || []).forEach((mn) => {
      if (mn.husband === mId && mn.wife) set.add(mn.wife);
      if (mn.wife === mId && mn.husband) set.add(mn.husband);
    });
    return Array.from(set);
  }, [labelMembers, labelMarriages]);

  const handleFatherChange = (val: unknown) => {
    const nextFatherId = !val || val === "__none__" ? "" : String(val);
    props.onFatherId(nextFatherId);

    if (!nextFatherId) {
      if (motherId) {
        props.onMotherId("");
      }
      return;
    }

    const spouses = getSpouseIds(nextFatherId);
    if (spouses.length === 1) {
      props.onMotherId(spouses[0]);
    } else if (spouses.length > 1) {
      if (motherId && !spouses.includes(motherId)) {
        props.onMotherId("");
      }
    } else {
      if (motherId) {
        props.onMotherId("");
      }
    }
  };

  const handleMotherChange = (val: unknown) => {
    const nextMotherId = !val || val === "__none__" ? "" : String(val);
    props.onMotherId(nextMotherId);

    if (!nextMotherId) {
      return;
    }

    const spouses = getSpouseIds(nextMotherId);
    if (spouses.length === 1) {
      props.onFatherId(spouses[0]);
    } else if (spouses.length > 1) {
      if (fatherId && !spouses.includes(fatherId)) {
        props.onFatherId("");
      }
    } else {
      if (fatherId) {
        props.onFatherId("");
      }
    }
  };

  const filteredMotherOptions = useMemo(() => {
    if (!fatherId) {
      return motherOptions;
    }
    const spouseIds = getSpouseIds(fatherId);
    if (spouseIds.length === 0) {
      return motherOptions;
    }
    const candidates = (labelMembers || []).filter(
      (m) => m.gender === "f" && m.id !== editId && (spouseIds.includes(m.id) || m.id === motherId),
    );
    return candidates.length > 0 ? candidates : motherOptions;
  }, [fatherId, motherId, motherOptions, labelMembers, editId, getSpouseIds]);

  const filteredFatherOptions = useMemo(() => {
    if (!motherId) {
      return fatherOptions;
    }
    const spouseIds = getSpouseIds(motherId);
    if (spouseIds.length === 0) {
      return fatherOptions;
    }
    const candidates = (labelMembers || []).filter(
      (f) => f.gender === "m" && f.id !== editId && (spouseIds.includes(f.id) || f.id === fatherId),
    );
    return candidates.length > 0 ? candidates : fatherOptions;
  }, [fatherId, motherId, fatherOptions, labelMembers, editId, getSpouseIds]);

  return (
    <form ref={formRef} onSubmit={props.onSubmit} className="space-y-4">
      {editId && !deleteConfirmOpen ? (
        <div className="flex justify-end">
          <Button
            type="button"
            variant="danger"
            size="sm"
            onPress={props.onDeleteRequest}
          >
            {t.delete}
          </Button>
        </div>
      ) : null}

      {deleteConfirmOpen && editId && (
        <div className="neo-debossed rounded-xl p-3 text-xs text-rose-800 space-y-2">
          <p className="font-bold">{t.deleteConfirm.replace("{name}", nameAr)}</p>
          {hasChildren && <p className="text-amber-800">{t.deleteChildrenWarn}</p>}
          <div className="flex gap-2">
            <Button type="button" variant="secondary" className="flex-1" onPress={props.onDeleteCancel}>
              {t.cancel}
            </Button>
            <Button
              type="button"
              variant="danger"
              className="flex-1"
              isDisabled={isSaving}
              onPress={props.onDeleteConfirm}
            >
              {isSaving ? "..." : t.delete}
            </Button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <TextField name="nameAr" isRequired className="w-full" value={nameAr} onChange={props.onNameAr}>
          <Label>{t.nameAr}</Label>
          <Input className="neo-debossed rounded-xl" />
        </TextField>
        <TextField name="nameEn" isRequired className="w-full" value={nameEn} onChange={props.onNameEn}>
          <Label>{t.nameEn}</Label>
          <Input className="neo-debossed rounded-xl" dir="ltr" />
        </TextField>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <TextField
          name="birth"
          isRequired
          className="w-full"
          value={birth ? String(birth) : ""}
          onChange={setYearBirth}
        >
          <Label>{t.birth}</Label>
          <Input
            className="neo-debossed rounded-xl font-mono"
            inputMode="numeric"
            pattern="[0-9]*"
            dir="ltr"
            maxLength={4}
          />
        </TextField>
        <TextField name="death" className="w-full" value={death} onChange={setYearDeath}>
          <Label>{t.death}</Label>
          <Input
            className="neo-debossed rounded-xl font-mono"
            inputMode="numeric"
            pattern="[0-9]*"
            dir="ltr"
            maxLength={4}
            placeholder={t.deathPlaceholder}
          />
        </TextField>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Select
          className="w-full"
          value={gender}
          onChange={(v) => {
            const g = (v as "m" | "f") || "m";
            props.onGender(g);
            if (g === "f" && spouses.length > 1) props.onSpouses(spouses.slice(0, 1));
          }}
        >
          <Label>{t.gender}</Label>
          <Select.Trigger className="neo-debossed rounded-xl h-11">
            <Select.Value />
            <Select.Indicator />
          </Select.Trigger>
          <Select.Popover>
            <ListBox>
              <ListBox.Item id="m" textValue={t.genderMale}>
                {t.genderMale}
                <ListBox.ItemIndicator />
              </ListBox.Item>
              <ListBox.Item id="f" textValue={t.genderFemale}>
                {t.genderFemale}
                <ListBox.ItemIndicator />
              </ListBox.Item>
            </ListBox>
          </Select.Popover>
        </Select>

        <Select
          className="w-full"
          value={privacy ? "true" : "false"}
          onChange={(v) => props.onPrivacy(v === "true")}
        >
          <Label>{t.privacy}</Label>
          <Select.Trigger className="neo-debossed rounded-xl h-11">
            <Select.Value />
            <Select.Indicator />
          </Select.Trigger>
          <Select.Popover>
            <ListBox>
              <ListBox.Item id="true" textValue={t.privacyOn}>
                {t.privacyOn}
                <ListBox.ItemIndicator />
              </ListBox.Item>
              <ListBox.Item id="false" textValue={t.privacyOff}>
                {t.privacyOff}
                <ListBox.ItemIndicator />
              </ListBox.Item>
            </ListBox>
          </Select.Popover>
        </Select>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Select
          className="w-full"
          value={fatherId || "__none__"}
          onChange={handleFatherChange}
          placeholder={t.noFather}
        >
          <Label>{t.father}</Label>
          <Select.Trigger className="neo-debossed rounded-xl h-11">
            <Select.Value />
            <Select.Indicator />
          </Select.Trigger>
          <Select.Popover>
            <ListBox>
              <ListBox.Item id="__none__" textValue={t.noFather}>
                {t.noFather}
                <ListBox.ItemIndicator />
              </ListBox.Item>
              {filteredFatherOptions.map((f) => (
                <ListBox.Item key={f.id} id={f.id} textValue={memberLabel(f)}>
                  {memberLabel(f)}
                  <ListBox.ItemIndicator />
                </ListBox.Item>
              ))}
            </ListBox>
          </Select.Popover>
        </Select>

        <Select
          className="w-full"
          value={motherId || "__none__"}
          onChange={handleMotherChange}
          placeholder={t.noMother}
        >
          <Label>{t.mother}</Label>
          <Select.Trigger className="neo-debossed rounded-xl h-11">
            <Select.Value />
            <Select.Indicator />
          </Select.Trigger>
          <Select.Popover>
            <ListBox>
              <ListBox.Item id="__none__" textValue={t.noMother}>
                {t.noMother}
                <ListBox.ItemIndicator />
              </ListBox.Item>
              {filteredMotherOptions.map((f) => (
                <ListBox.Item key={f.id} id={f.id} textValue={memberLabel(f)}>
                  {memberLabel(f)}
                  <ListBox.ItemIndicator />
                </ListBox.Item>
              ))}
            </ListBox>
          </Select.Popover>
        </Select>
      </div>

      <TextField name="bio" className="w-full" value={bio} onChange={props.onBio}>
        <Label>{t.bio}</Label>
        <TextArea className="neo-debossed rounded-xl min-h-16" rows={2} />
      </TextField>

      <TextField name="mobile" className="w-full" value={mobile} onChange={props.onMobile}>
        <Label>{t.mobile}</Label>
        <Input className="neo-debossed rounded-xl font-mono" dir="ltr" placeholder="09xxxxxxxxx" />
      </TextField>

      <FilePickField
        label={t.avatar}
        accept="image/jpeg,image/png,image/webp"
        onFile={props.onAvatarFile}
        existingUrl={props.existingAvatar}
        onDeleteExisting={props.onDeleteAvatar}
        pickLabel={lang === "fa" ? "انتخاب تصویر" : lang === "ar" ? "اختيار صورة" : "Choose image"}
      />
      <FilePickField
        label={t.gallery}
        accept="image/jpeg,image/png,image/webp"
        onFile={props.onGalleryFile}
        existingUrl={props.existingGallery}
        onDeleteExisting={props.onDeleteGallery}
        
        pickLabel={lang === "fa" ? "افزودن به گالری" : lang === "ar" ? "إضافة للمعرض" : "Add to gallery"}
      />
      <div className="space-y-2">
        <Label className="text-xs font-bold text-gray-500">{t.audio}</Label>
        <TextField name="audioTitle" className="w-full" value={audioTitle} onChange={props.onAudioTitle}>
          <Input className="surface-inset rounded-xl" placeholder={t.audioTitle} />
        </TextField>
        <FilePickField
          label=""
          accept="audio/mpeg,audio/mp3,audio/wav,audio/ogg,audio/webm"
          onFile={props.onAudioFile}
          pickLabel={lang === "fa" ? "انتخاب صدا" : lang === "ar" ? "اختيار صوت" : "Choose audio"}
        />
      </div>

      <div className="space-y-2">
        {gender === "f" ? (
          <div className="space-y-1.5">
            <Select
              className="w-full"
              value={spouses[0] || "__none__"}
              onChange={(v) => {
                const key = v == null ? null : String(v);
                if (!key || key === "__none__") {
                  props.onSpouses([]);
                  return;
                }
                props.onSpouses([key]);
              }}
              placeholder={t.noSpouseCandidates}
            >
              <Label>{t.spouses}</Label>
              <Select.Trigger className="neo-debossed rounded-xl h-11">
                <Select.Value />
                <Select.Indicator />
              </Select.Trigger>
              <Select.Popover>
                <ListBox>
                  <ListBox.Item
                    id="__none__"
                    textValue={lang === "fa" ? "بدون همسر" : lang === "ar" ? "بدون زوج" : "No spouse"}
                  >
                    {lang === "fa" ? "بدون همسر" : lang === "ar" ? "بدون زوج" : "No spouse"}
                    <ListBox.ItemIndicator />
                  </ListBox.Item>
                  {spouseCandidates.map((f) => (
                    <ListBox.Item key={f.id} id={f.id} textValue={memberLabel(f)}>
                      {memberLabel(f)}
                      <ListBox.ItemIndicator />
                    </ListBox.Item>
                  ))}
                </ListBox>
              </Select.Popover>
            </Select>
            <p className="text-[10px] text-slate-500 px-1">{t.spousesFemaleHint}</p>
          </div>
        ) : (
          <CheckboxGroup
            className="neo-debossed p-3 rounded-xl max-h-36 overflow-y-auto"
            value={spouses}
            onChange={handleSpouseChange}
            name="spouses"
          >
            <Label>{t.spouses}</Label>
            {spouseCandidates.length === 0 ? (
              <span className="text-xs text-slate-400">{t.noSpouseCandidates}</span>
            ) : (
              spouseCandidates.map((f) => (
                <Checkbox key={f.id} value={f.id} className="py-1">
                  <Checkbox.Content>
                    <Checkbox.Control>
                      <Checkbox.Indicator />
                    </Checkbox.Control>
                    <span className="text-xs truncate">{memberLabel(f)}</span>
                  </Checkbox.Content>
                </Checkbox>
              ))
            )}
          </CheckboxGroup>
        )}
      </div>

      <div className="flex justify-end items-center gap-3 pt-4 border-t border-gray-300/40">
        <Button type="button" variant="secondary" onPress={props.onClose} isDisabled={isSaving}>
          {t.cancel}
        </Button>
        <Button
          type="button"
          variant="primary"
          isDisabled={isSaving || deleteConfirmOpen}
          onPress={() => {
            // requestSubmit after Select commits; spouses also mirrored in a ref on parent
            formRef.current?.requestSubmit();
          }}
        >
          {isSaving ? "..." : t.save}
        </Button>
      </div>
    </form>
  );
}
