"use client";
import { createContext, useContext, useEffect, useState } from "react";
import type { PersonaCode } from "@/lib/types";

interface Ctx {
  persona: PersonaCode;
  setPersona: (p: PersonaCode) => void;
}

const PersonaCtx = createContext<Ctx>({
  persona: "hr_admin",
  setPersona: () => {},
});

export function PersonaProvider({ children }: { children: React.ReactNode }) {
  const [persona, setPersonaState] = useState<PersonaCode>("hr_admin");

  useEffect(() => {
    const saved = localStorage.getItem("persona") as PersonaCode | null;
    if (saved) setPersonaState(saved);
  }, []);

  const setPersona = (p: PersonaCode) => {
    setPersonaState(p);
    localStorage.setItem("persona", p);
  };

  return (
    <PersonaCtx.Provider value={{ persona, setPersona }}>
      {children}
    </PersonaCtx.Provider>
  );
}

export const usePersona = () => useContext(PersonaCtx);
