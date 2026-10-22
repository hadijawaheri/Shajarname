"use client";

import { useState } from "react";
import { Button, CloseButton, Label, ListBox, Modal, Select } from "@heroui/react";
import type { FamilyMember, MarriageNode } from "../lib/types";
import { getRelationship } from "../lib/api";
import { formatMemberLabel } from "../lib/memberLabel";

interface KinshipPanelProps {
  members: FamilyMember[];
  marriages: MarriageNode[];
  lang: "fa" | "ar" | "en";
  onClose: () => void;
  labels: {
    title: string;
    personA: string;
    personB: string;
    btnCalculate: string;
    result: string;
    selectPlaceholder: string;
  };
}

export default function KinshipPanel({
  members,
  marriages,
  lang,
  onClose,
  labels,
}: KinshipPanelProps) {
  const [personA, setPersonA] = useState<string>("");
  const [personB, setPersonB] = useState<string>("");
  const [result, setResult] = useState("");
  const [loading, setLoading] = useState(false);

  const assigned = members.filter((m) => m.assigned);
  const apiLang = lang === "ar" ? "ar" : "fa";
  const labelCtx = { members, marriages };
  const displayName = (m: FamilyMember) => formatMemberLabel(m, lang, labelCtx);

  const handleCalculate = async () => {
    if (!personA || !personB) return;
    setLoading(true);
    try {
      const rel = await getRelationship(personA, personB, apiLang);
      setResult(rel);
    } catch {
      setResult(lang === "fa" ? "خطا در محاسبه نسبت" : "خطأ في حساب القرابة");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal.Backdrop
      isOpen
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      variant="blur"
    >
      <Modal.Container placement="center" size="md">
        <Modal.Dialog className="surface-panel border border-white/50 rounded-3xl">
          <Modal.Header className="flex flex-row items-center gap-2">
            <Modal.Heading className="font-display flex items-center gap-2 flex-1 min-w-0">
              <i className="fa-solid fa-diagram-project text-teal-700 shrink-0"></i>
              <span className="truncate">{labels.title}</span>
            </Modal.Heading>
            <CloseButton
              aria-label={lang === "fa" ? "بستن" : lang === "ar" ? "إغلاق" : "Close"}
              className="shrink-0"
              onPress={onClose}
            />
          </Modal.Header>
          <Modal.Body className="space-y-4">
            <Select
              className="w-full"
              value={personA || null}
              onChange={(v) => setPersonA(v ? String(v) : "")}
              placeholder={labels.selectPlaceholder}
            >
              <Label>{labels.personA}</Label>
              <Select.Trigger className="surface-inset rounded-xl h-11">
                <Select.Value />
                <Select.Indicator />
              </Select.Trigger>
              <Select.Popover>
                <ListBox>
                  {assigned.map((m) => (
                    <ListBox.Item key={m.id} id={m.id} textValue={displayName(m)}>
                      {displayName(m)}
                      <ListBox.ItemIndicator />
                    </ListBox.Item>
                  ))}
                </ListBox>
              </Select.Popover>
            </Select>

            <Select
              className="w-full"
              value={personB || null}
              onChange={(v) => setPersonB(v ? String(v) : "")}
              placeholder={labels.selectPlaceholder}
            >
              <Label>{labels.personB}</Label>
              <Select.Trigger className="surface-inset rounded-xl h-11">
                <Select.Value />
                <Select.Indicator />
              </Select.Trigger>
              <Select.Popover>
                <ListBox>
                  {assigned.map((m) => (
                    <ListBox.Item key={m.id} id={m.id} textValue={displayName(m)}>
                      {displayName(m)}
                      <ListBox.ItemIndicator />
                    </ListBox.Item>
                  ))}
                </ListBox>
              </Select.Popover>
            </Select>

            {result && (
              <div className="surface-inset p-4 rounded-xl text-center">
                <p className="text-[10px] font-bold text-gray-500 mb-1">{labels.result}</p>
                <p className="text-base font-bold text-teal-800">{result}</p>
              </div>
            )}
          </Modal.Body>
          <Modal.Footer>
            <Button
              className="w-full"
              isDisabled={!personA || !personB || loading}
              onPress={handleCalculate}
            >
              {labels.btnCalculate}
            </Button>
          </Modal.Footer>
        </Modal.Dialog>
      </Modal.Container>
    </Modal.Backdrop>
  );
}
