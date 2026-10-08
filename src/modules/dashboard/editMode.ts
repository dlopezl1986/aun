import { create } from 'zustand';

/** Whether Inicio is in "Personalizar" mode (shared so Settings can open it). */
export const useDashboardEditMode = create<{ editing: boolean; setEditing: (editing: boolean) => void }>()((set) => ({
  editing: false,
  setEditing: (editing) => set({ editing }),
}));
