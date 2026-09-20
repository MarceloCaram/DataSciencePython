import { createNativeStackNavigator } from "@react-navigation/native-stack";
import React from "react";

import { TaskDetailScreen } from "../screens/child/TaskDetailScreen";
import { TaskListScreen } from "../screens/child/TaskListScreen";
import { TaskSubmissionProvider } from "../state/taskSubmissions";
import { childColors } from "../theme";
import type { ChildTasksStackParamList } from "./types";

const Stack = createNativeStackNavigator<ChildTasksStackParamList>();

export function ChildTasksStack() {
  return (
    <TaskSubmissionProvider>
      <Stack.Navigator
        screenOptions={{
          headerStyle: { backgroundColor: childColors.primary },
          headerTintColor: childColors.onPrimary,
          headerTitleStyle: { fontWeight: "800" },
        }}
      >
        <Stack.Screen name="TaskList" component={TaskListScreen} options={{ title: "Minhas tarefas" }} />
        <Stack.Screen name="TaskDetail" component={TaskDetailScreen} options={{ title: "Tarefa" }} />
      </Stack.Navigator>
    </TaskSubmissionProvider>
  );
}
