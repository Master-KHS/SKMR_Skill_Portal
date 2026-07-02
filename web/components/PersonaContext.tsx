"use client";
import { createContext, useContext, useEffect, useRef, useState, useCallback } from "react";
import type { PersonaCode } from "@/lib/types";

export interface CurrentMember {
  employee_id: string;
  name: string;
  team: string | null;
  division: string | null;
  role_level: string | null;
  position: string | null;
}

interface Ctx {
  persona: PersonaCode;
  setPersona: (p: PersonaCode) => void;
  members: CurrentMember[]; // 이 페르소나(권한)에 매핑된 사람들
  currentMember: CurrentMember | null; // 2단계에서 선택된 "지금 로그인된 사람"
  setCurrentMemberId: (id: string) => void;
  loadingMembers: boolean;
}

const PersonaCtx = createContext<Ctx>({
  persona: "hr_admin",
  setPersona: () => {},
  members: [],
  currentMember: null,
  setCurrentMemberId: () => {},
  loadingMembers: false,
});

export function PersonaProvider({ children }: { children: React.ReactNode }) {
  const [persona, setPersonaState] = useState<PersonaCode>("hr_admin");
  const [members, setMembers] = useState<CurrentMember[]>([]);
  const [currentMember, setCurrentMemberState] = useState<CurrentMember | null>(null);
  const [loadingMembers, setLoadingMembers] = useState(false);
  const loadSeq = useRef(0);

  useEffect(() => {
    const saved = localStorage.getItem("persona") as PersonaCode | null;
    if (saved) setPersonaState(saved);
  }, []);

  // 페르소나(권한)가 바뀔 때마다 그 권한에 매핑된 사람 목록을 다시 불러옴 (원본: get_members_for_persona)
  const loadMembers = useCallback(async (p: PersonaCode) => {
    const seq = loadSeq.current + 1;
    loadSeq.current = seq;
    setLoadingMembers(true);
    try {
      const res = await fetch(`/api/persona-members?persona=${p}`);
      const data = await res.json();
      if (seq !== loadSeq.current) return;
      const list: CurrentMember[] = data.members ?? [];
      setMembers(list);
      const savedId = localStorage.getItem(`current_member_${p}`);
      const found = list.find((m) => m.employee_id === savedId);
      setCurrentMemberState(found ?? list[0] ?? null);
    } finally {
      if (seq === loadSeq.current) setLoadingMembers(false);
    }
  }, []);

  useEffect(() => {
    loadMembers(persona);
  }, [persona, loadMembers]);

  const setPersona = (p: PersonaCode) => {
    setPersonaState(p);
    localStorage.setItem("persona", p);
  };

  const setCurrentMemberId = (id: string) => {
    const found = members.find((m) => m.employee_id === id) ?? null;
    setCurrentMemberState(found);
    localStorage.setItem(`current_member_${persona}`, id);
  };

  return (
    <PersonaCtx.Provider
      value={{ persona, setPersona, members, currentMember, setCurrentMemberId, loadingMembers }}
    >
      {children}
    </PersonaCtx.Provider>
  );
}

export const usePersona = () => useContext(PersonaCtx);
