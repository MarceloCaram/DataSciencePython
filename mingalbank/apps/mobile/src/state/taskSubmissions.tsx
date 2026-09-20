import React, { createContext, useCallback, useContext, useMemo, useState } from "react";

/**
 * Estado efêmero (só nesta sessão do app) de "tarefas já enviadas para
 * aprovação pelo filho". O contrato de API não expõe um endpoint dedicado
 * para listar `TaskCompletion`s de um filho (só o dashboard do pai agrega
 * isso), então a lista de tarefas do filho (`GET /tasks?childId=`) devolve
 * só `Task[]`. Para a UI não deixar o filho reenviar a mesma tarefa depois
 * de marcá-la como concluída, guardamos localmente quais tarefas foram
 * enviadas nesta sessão — é reconciliado com a realidade a cada nova busca
 * de tarefas vinda do backend (que deixará de listar/à parte tarefas já
 * aprovadas, quando o backend implementar isso).
 */
interface TaskSubmissionContextValue {
  submittedIds: Set<string>;
  markSubmitted: (taskId: string) => void;
}

const TaskSubmissionContext = createContext<TaskSubmissionContextValue | null>(null);

export function TaskSubmissionProvider({ children }: { children: React.ReactNode }) {
  const [submittedIds, setSubmittedIds] = useState<Set<string>>(new Set());

  const markSubmitted = useCallback((taskId: string) => {
    setSubmittedIds((current) => new Set(current).add(taskId));
  }, []);

  const value = useMemo(() => ({ submittedIds, markSubmitted }), [submittedIds, markSubmitted]);

  return <TaskSubmissionContext.Provider value={value}>{children}</TaskSubmissionContext.Provider>;
}

export function useTaskSubmissions(): TaskSubmissionContextValue {
  const ctx = useContext(TaskSubmissionContext);
  if (!ctx) throw new Error("useTaskSubmissions precisa estar dentro de <TaskSubmissionProvider>");
  return ctx;
}
